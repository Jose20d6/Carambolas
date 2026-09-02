const Materials = (() => {
  const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

  const els = {
    form: document.getElementById('material-form'),
    id: document.getElementById('material-id'),
    name: document.getElementById('material-name'),
    cost: document.getElementById('material-cost'),
    quantity: document.getElementById('material-quantity'),
    unit: document.getElementById('material-unit'),
    supplierUrl: document.getElementById('material-supplier-url'),
    priceSelector: document.getElementById('material-price-selector'),
    quantitySelector: document.getElementById('material-quantity-selector'),
    preview: document.getElementById('unit-value-preview'),
    formTitle: document.getElementById('material-form-title'),
    submitBtn: document.getElementById('material-submit-btn'),
    cancelBtn: document.getElementById('material-cancel-btn'),
    error: document.getElementById('material-form-error'),
    tbody: document.getElementById('materials-tbody'),
    refreshAllBtn: document.getElementById('refresh-all-btn'),
    refreshAllStatus: document.getElementById('refresh-all-status'),
  };

  let cache = [];

  function updatePreview() {
    const cost = Number(els.cost.value);
    const qty = Number(els.quantity.value);
    const value = qty > 0 ? cost / qty : 0;
    els.preview.textContent = fmt(value);
  }

  function resetForm() {
    els.form.reset();
    els.id.value = '';
    els.formTitle.textContent = 'Nuevo material';
    els.submitBtn.textContent = 'Guardar material';
    els.cancelBtn.hidden = true;
    els.error.textContent = '';
    updatePreview();
  }

  function fillForm(material) {
    els.id.value = material.id;
    els.name.value = material.name;
    els.cost.value = material.purchase_cost;
    els.quantity.value = material.purchase_quantity;
    els.unit.value = material.unit || '';
    els.supplierUrl.value = material.supplier_url || '';
    els.priceSelector.value = material.supplier_price_selector || '';
    els.quantitySelector.value = material.supplier_quantity_selector || '';
    els.formTitle.textContent = `Editar: ${material.name}`;
    els.submitBtn.textContent = 'Guardar cambios';
    els.cancelBtn.hidden = false;
    updatePreview();
    els.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function readForm() {
    return {
      name: els.name.value,
      purchase_cost: els.cost.value,
      purchase_quantity: els.quantity.value,
      unit: els.unit.value || 'unidades',
      supplier_url: els.supplierUrl.value || null,
      supplier_price_selector: els.priceSelector.value || null,
      supplier_quantity_selector: els.quantitySelector.value || null,
    };
  }

  function renderRow(material) {
    const tr = document.createElement('tr');

    const supplierLabel = material.supplier_url
      ? `<a href="${material.supplier_url}" target="_blank" rel="noopener">Ver</a>`
      : '<span class="hint">No configurado</span>';

    tr.innerHTML = `
      <td>${material.name}</td>
      <td>${fmt(material.purchase_cost)}</td>
      <td>${material.purchase_quantity} ${material.unit || ''}</td>
      <td>${fmt(material.unit_value)}</td>
      <td>${supplierLabel}</td>
      <td class="row-actions"></td>
    `;

    const actions = tr.querySelector('.row-actions');

    const editBtn = document.createElement('button');
    editBtn.className = 'secondary small';
    editBtn.textContent = 'Editar';
    editBtn.onclick = () => fillForm(material);
    actions.appendChild(editBtn);

    if (material.supplier_url && material.supplier_price_selector) {
      const refreshBtn = document.createElement('button');
      refreshBtn.className = 'secondary small';
      refreshBtn.textContent = 'Actualizar precio';
      refreshBtn.onclick = async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Actualizando...';
        try {
          await Api.refreshMaterialPrice(material.id);
          await load();
        } catch (err) {
          alert(`No se pudo actualizar el precio: ${err.message}`);
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.textContent = 'Actualizar precio';
        }
      };
      actions.appendChild(refreshBtn);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'danger small';
    deleteBtn.textContent = 'Eliminar';
    deleteBtn.onclick = async () => {
      if (!confirm(`¿Eliminar el material "${material.name}"?`)) return;
      try {
        await Api.deleteMaterial(material.id);
        await load();
      } catch (err) {
        alert(err.message);
      }
    };
    actions.appendChild(deleteBtn);

    return tr;
  }

  function render() {
    els.tbody.innerHTML = '';
    cache.forEach((m) => els.tbody.appendChild(renderRow(m)));
  }

  async function load() {
    cache = await Api.listMaterials();
    render();
    document.dispatchEvent(new CustomEvent('materials:updated', { detail: cache }));
    return cache;
  }

  function getCache() {
    return cache;
  }

  els.cost.addEventListener('input', updatePreview);
  els.quantity.addEventListener('input', updatePreview);
  els.cancelBtn.addEventListener('click', resetForm);

  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    els.error.textContent = '';
    const payload = readForm();
    try {
      if (els.id.value) {
        await Api.updateMaterial(els.id.value, payload);
      } else {
        await Api.createMaterial(payload);
      }
      resetForm();
      await load();
    } catch (err) {
      els.error.textContent = err.message;
    }
  });

  els.refreshAllBtn.addEventListener('click', async () => {
    els.refreshAllBtn.disabled = true;
    els.refreshAllStatus.textContent = 'Actualizando precios desde los proveedores...';
    try {
      const results = await Api.refreshAllPrices();
      const ok = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);
      let msg = `Actualizados: ${ok}/${results.length}.`;
      if (failed.length) {
        msg += ` Fallaron: ${failed.map((f) => f.name).join(', ')}.`;
      }
      if (results.length === 0) {
        msg = 'Ningún material tiene proveedor configurado todavía.';
      }
      els.refreshAllStatus.textContent = msg;
      await load();
    } catch (err) {
      els.refreshAllStatus.textContent = `Error: ${err.message}`;
    } finally {
      els.refreshAllBtn.disabled = false;
    }
  });

  return { load, getCache, fmt };
})();
