const express = require('express');
const db = require('../db');
const { fetchValueFromPage } = require('../scraper');

const router = express.Router();

function computeUnitValue(purchaseCost, purchaseQuantity) {
  if (!purchaseQuantity || purchaseQuantity <= 0) return 0;
  return purchaseCost / purchaseQuantity;
}

function validateMaterialInput(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  if (!partial || body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('El nombre es obligatorio.');
    } else {
      data.name = body.name.trim();
    }
  }

  if (!partial || body.purchase_cost !== undefined) {
    const cost = Number(body.purchase_cost);
    if (!Number.isFinite(cost) || cost < 0) {
      errors.push('El costo de compra debe ser un número mayor o igual a 0.');
    } else {
      data.purchase_cost = cost;
    }
  }

  if (!partial || body.purchase_quantity !== undefined) {
    const qty = Number(body.purchase_quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push('La cantidad que trae debe ser un número mayor a 0.');
    } else {
      data.purchase_quantity = qty;
    }
  }

  if (body.unit !== undefined) {
    data.unit = String(body.unit || 'unidades').trim() || 'unidades';
  }
  if (body.supplier_url !== undefined) {
    data.supplier_url = body.supplier_url ? String(body.supplier_url).trim() : null;
  }
  if (body.supplier_price_selector !== undefined) {
    data.supplier_price_selector = body.supplier_price_selector
      ? String(body.supplier_price_selector).trim()
      : null;
  }
  if (body.supplier_quantity_selector !== undefined) {
    data.supplier_quantity_selector = body.supplier_quantity_selector
      ? String(body.supplier_quantity_selector).trim()
      : null;
  }

  return { data, errors };
}

// Listado, ordenado alfabéticamente por nombre (usado por la calculadora).
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM materials ORDER BY name COLLATE NOCASE ASC')
    .all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Material no encontrado.' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { data, errors } = validateMaterialInput(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const unit_value = computeUnitValue(data.purchase_cost, data.purchase_quantity);
  try {
    const info = db
      .prepare(
        `INSERT INTO materials
          (name, unit, purchase_cost, purchase_quantity, unit_value,
           supplier_url, supplier_price_selector, supplier_quantity_selector)
         VALUES (@name, @unit, @purchase_cost, @purchase_quantity, @unit_value,
                 @supplier_url, @supplier_price_selector, @supplier_quantity_selector)`
      )
      .run({
        unit: 'unidades',
        supplier_url: null,
        supplier_price_selector: null,
        supplier_quantity_selector: null,
        ...data,
        unit_value,
      });
    const created = db.prepare('SELECT * FROM materials WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Ya existe un material con ese nombre.' });
    }
    res.status(500).json({ error: 'Error al crear el material.' });
  }
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Material no encontrado.' });

  const { data, errors } = validateMaterialInput(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const merged = { ...existing, ...data };
  merged.unit_value = computeUnitValue(merged.purchase_cost, merged.purchase_quantity);

  try {
    db.prepare(
      `UPDATE materials SET
        name = @name, unit = @unit, purchase_cost = @purchase_cost,
        purchase_quantity = @purchase_quantity, unit_value = @unit_value,
        supplier_url = @supplier_url,
        supplier_price_selector = @supplier_price_selector,
        supplier_quantity_selector = @supplier_quantity_selector,
        updated_at = datetime('now')
       WHERE id = @id`
    ).run(merged);
    const updated = db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Ya existe un material con ese nombre.' });
    }
    res.status(500).json({ error: 'Error al actualizar el material.' });
  }
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Material no encontrado.' });

  const inUse = db
    .prepare('SELECT COUNT(*) AS c FROM product_materials WHERE material_id = ?')
    .get(req.params.id).c;
  if (inUse > 0) {
    return res
      .status(409)
      .json({ error: 'No se puede eliminar: el material está usado en uno o más productos.' });
  }

  db.prepare('DELETE FROM materials WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Actualiza costo de compra (y opcionalmente la cantidad) tomando los
// valores desde la página web del proveedor configurada en el material.
router.post('/:id/refresh-price', async (req, res) => {
  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
  if (!material) return res.status(404).json({ error: 'Material no encontrado.' });
  if (!material.supplier_url || !material.supplier_price_selector) {
    return res.status(400).json({
      error: 'Configurá la URL del proveedor y el selector de precio en el material primero.',
    });
  }

  try {
    const purchase_cost = await fetchValueFromPage(
      material.supplier_url,
      material.supplier_price_selector
    );

    let purchase_quantity = material.purchase_quantity;
    if (material.supplier_quantity_selector) {
      purchase_quantity = await fetchValueFromPage(
        material.supplier_url,
        material.supplier_quantity_selector
      );
    }

    const unit_value = computeUnitValue(purchase_cost, purchase_quantity);
    db.prepare(
      `UPDATE materials SET purchase_cost = ?, purchase_quantity = ?, unit_value = ?,
        last_price_update = datetime('now'), updated_at = datetime('now') WHERE id = ?`
    ).run(purchase_cost, purchase_quantity, unit_value, material.id);

    const updated = db.prepare('SELECT * FROM materials WHERE id = ?').get(material.id);
    res.json(updated);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Actualiza todos los materiales que tengan proveedor configurado.
router.post('/refresh-all', async (req, res) => {
  const materials = db
    .prepare(
      'SELECT * FROM materials WHERE supplier_url IS NOT NULL AND supplier_price_selector IS NOT NULL'
    )
    .all();

  const results = [];
  for (const material of materials) {
    try {
      const purchase_cost = await fetchValueFromPage(
        material.supplier_url,
        material.supplier_price_selector
      );
      let purchase_quantity = material.purchase_quantity;
      if (material.supplier_quantity_selector) {
        purchase_quantity = await fetchValueFromPage(
          material.supplier_url,
          material.supplier_quantity_selector
        );
      }
      const unit_value = computeUnitValue(purchase_cost, purchase_quantity);
      db.prepare(
        `UPDATE materials SET purchase_cost = ?, purchase_quantity = ?, unit_value = ?,
          last_price_update = datetime('now'), updated_at = datetime('now') WHERE id = ?`
      ).run(purchase_cost, purchase_quantity, unit_value, material.id);
      results.push({ id: material.id, name: material.name, ok: true });
    } catch (err) {
      results.push({ id: material.id, name: material.name, ok: false, error: err.message });
    }
  }
  res.json(results);
});

module.exports = router;
