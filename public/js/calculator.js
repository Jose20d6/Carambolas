const Calculator = (() => {
  const fmt = Materials.fmt;

  const els = {
    productSelect: document.getElementById('product-select'),
    productName: document.getElementById('product-name'),
    productSaveBtn: document.getElementById('product-save-btn'),
    productDeleteBtn: document.getElementById('product-delete-btn'),
    productFormError: document.getElementById('product-form-error'),
    materialSelect: document.getElementById('calc-material-select'),
    materialQty: document.getElementById('calc-material-qty'),
    addMaterialBtn: document.getElementById('calc-add-material-btn'),
    calcFormError: document.getElementById('calc-form-error'),
    productMaterialsTbody: document.getElementById('product-materials-tbody'),
    totalCost: document.getElementById('product-total-cost'),
  };

  let currentProduct = null;

  function populateMaterialSelect(materials) {
    // Orden alfabético por nombre para encontrar el material fácilmente.
    const sorted = [...materials].sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );
    els.materialSelect.innerHTML = sorted
      .map((m) => `<option value="${m.id}">${m.name} (${fmt(m.unit_value)}/${m.unit})</option>`)
      .join('');
  }

  async function populateProductSelect(selectedId) {
    const products = await Api.listProducts();
    els.productSelect.innerHTML =
      '<option value="">-- Nuevo producto --</option>' +
      products
        .map((p) => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.name}</option>`)
        .join('');
  }

  function renderProduct() {
    els.productMaterialsTbody.innerHTML = '';
    if (!currentProduct) {
      els.totalCost.textContent = fmt(0);
      return;
    }

    currentProduct.materials.forEach((pm) => {
      const tr = document.createElement('tr');
      const subtotal = pm.unit_value * pm.quantity_used;
      tr.innerHTML = `
        <td>${pm.name}</td>
        <td>${fmt(pm.unit_value)}</td>
        <td>${pm.quantity_used} ${pm.unit || ''}</td>
        <td>${fmt(subtotal)}</td>
        <td class="row-actions"></td>
      `;
      const actions = tr.querySelector('.row-actions');
      const removeBtn = document.createElement('button');
      removeBtn.className = 'danger small';
      removeBtn.textContent = 'Quitar';
      removeBtn.onclick = async () => {
        try {
          currentProduct = await Api.removeProductMaterial(currentProduct.id, pm.material_id);
          renderProduct();
        } catch (err) {
          els.calcFormError.textContent = err.message;
        }
      };
      actions.appendChild(removeBtn);
      els.productMaterialsTbody.appendChild(tr);
    });

    els.totalCost.textContent = fmt(currentProduct.total_cost);
  }

  async function selectProduct(id) {
    els.productFormError.textContent = '';
    els.calcFormError.textContent = '';
    if (!id) {
      currentProduct = null;
      els.productName.value = '';
      els.productDeleteBtn.hidden = true;
      renderProduct();
      return;
    }
    currentProduct = await Api.getProduct(id);
    els.productName.value = currentProduct.name;
    els.productDeleteBtn.hidden = false;
    renderProduct();
  }

  els.productSelect.addEventListener('change', () => selectProduct(els.productSelect.value));

  els.productSaveBtn.addEventListener('click', async () => {
    els.productFormError.textContent = '';
    const name = els.productName.value.trim();
    if (!name) {
      els.productFormError.textContent = 'El nombre del producto es obligatorio.';
      return;
    }
    try {
      if (currentProduct) {
        currentProduct = await Api.updateProduct(currentProduct.id, { name });
      } else {
        currentProduct = await Api.createProduct({ name });
      }
      await populateProductSelect(currentProduct.id);
      els.productSelect.value = currentProduct.id;
      els.productDeleteBtn.hidden = false;
      renderProduct();
    } catch (err) {
      els.productFormError.textContent = err.message;
    }
  });

  els.productDeleteBtn.addEventListener('click', async () => {
    if (!currentProduct || !confirm(`¿Eliminar el producto "${currentProduct.name}"?`)) return;
    try {
      await Api.deleteProduct(currentProduct.id);
      await populateProductSelect(null);
      await selectProduct(null);
    } catch (err) {
      els.productFormError.textContent = err.message;
    }
  });

  els.addMaterialBtn.addEventListener('click', async () => {
    els.calcFormError.textContent = '';
    if (!currentProduct) {
      els.calcFormError.textContent = 'Primero guardá o seleccioná un producto.';
      return;
    }
    const material_id = els.materialSelect.value;
    const quantity_used = els.materialQty.value;
    if (!material_id) {
      els.calcFormError.textContent = 'Seleccioná un material.';
      return;
    }
    try {
      currentProduct = await Api.addProductMaterial(currentProduct.id, {
        material_id,
        quantity_used,
      });
      els.materialQty.value = '';
      renderProduct();
    } catch (err) {
      els.calcFormError.textContent = err.message;
    }
  });

  async function load() {
    await populateProductSelect(currentProduct ? currentProduct.id : null);
    populateMaterialSelect(Materials.getCache());
  }

  document.addEventListener('materials:updated', (e) => populateMaterialSelect(e.detail));

  return { load, selectProduct };
})();
