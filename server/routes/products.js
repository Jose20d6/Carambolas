const express = require('express');
const db = require('../db');

const router = express.Router();

function getProductWithMaterials(id) {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return null;

  const materials = db
    .prepare(
      `SELECT pm.id AS product_material_id, pm.quantity_used,
              m.id AS material_id, m.name, m.unit, m.unit_value
         FROM product_materials pm
         JOIN materials m ON m.id = pm.material_id
        WHERE pm.product_id = ?
        ORDER BY m.name COLLATE NOCASE ASC`
    )
    .all(id);

  const total_cost = materials.reduce(
    (sum, m) => sum + m.unit_value * m.quantity_used,
    0
  );

  return { ...product, materials, total_cost };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY name COLLATE NOCASE ASC').all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const product = getProductWithMaterials(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });
  res.json(product);
});

router.post('/', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'El nombre del producto es obligatorio.' });
  const info = db.prepare('INSERT INTO products (name) VALUES (?)').run(name);
  res.status(201).json(getProductWithMaterials(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado.' });
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'El nombre del producto es obligatorio.' });
  db.prepare('UPDATE products SET name = ? WHERE id = ?').run(name, req.params.id);
  res.json(getProductWithMaterials(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado.' });
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Agrega (o actualiza cantidad de) un material al producto.
router.post('/:id/materials', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });

  const material_id = Number(req.body.material_id);
  const quantity_used = Number(req.body.quantity_used);
  if (!Number.isFinite(material_id)) {
    return res.status(400).json({ error: 'Debe seleccionar un material.' });
  }
  if (!Number.isFinite(quantity_used) || quantity_used <= 0) {
    return res.status(400).json({ error: 'La cantidad usada debe ser mayor a 0.' });
  }

  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(material_id);
  if (!material) return res.status(404).json({ error: 'Material no encontrado.' });

  const existingLink = db
    .prepare('SELECT id FROM product_materials WHERE product_id = ? AND material_id = ?')
    .get(req.params.id, material_id);

  if (existingLink) {
    db.prepare('UPDATE product_materials SET quantity_used = ? WHERE id = ?').run(
      quantity_used,
      existingLink.id
    );
  } else {
    db.prepare(
      'INSERT INTO product_materials (product_id, material_id, quantity_used) VALUES (?, ?, ?)'
    ).run(req.params.id, material_id, quantity_used);
  }

  res.status(201).json(getProductWithMaterials(req.params.id));
});

router.put('/:id/materials/:materialId', (req, res) => {
  const link = db
    .prepare('SELECT * FROM product_materials WHERE product_id = ? AND material_id = ?')
    .get(req.params.id, req.params.materialId);
  if (!link) return res.status(404).json({ error: 'El material no está asignado a este producto.' });

  const quantity_used = Number(req.body.quantity_used);
  if (!Number.isFinite(quantity_used) || quantity_used <= 0) {
    return res.status(400).json({ error: 'La cantidad usada debe ser mayor a 0.' });
  }

  db.prepare('UPDATE product_materials SET quantity_used = ? WHERE id = ?').run(
    quantity_used,
    link.id
  );
  res.json(getProductWithMaterials(req.params.id));
});

router.delete('/:id/materials/:materialId', (req, res) => {
  const link = db
    .prepare('SELECT * FROM product_materials WHERE product_id = ? AND material_id = ?')
    .get(req.params.id, req.params.materialId);
  if (!link) return res.status(404).json({ error: 'El material no está asignado a este producto.' });

  db.prepare('DELETE FROM product_materials WHERE id = ?').run(link.id);
  res.json(getProductWithMaterials(req.params.id));
});

module.exports = router;
