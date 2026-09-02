const Api = (() => {
  async function request(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (res.status === 204) return null;
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error((body && body.error) || `Error ${res.status}`);
    }
    return body;
  }

  return {
    listMaterials: () => request('/api/materials'),
    getMaterial: (id) => request(`/api/materials/${id}`),
    createMaterial: (data) =>
      request('/api/materials', { method: 'POST', body: JSON.stringify(data) }),
    updateMaterial: (id, data) =>
      request(`/api/materials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteMaterial: (id) => request(`/api/materials/${id}`, { method: 'DELETE' }),
    refreshMaterialPrice: (id) =>
      request(`/api/materials/${id}/refresh-price`, { method: 'POST' }),
    refreshAllPrices: () => request('/api/materials/refresh-all', { method: 'POST' }),

    listProducts: () => request('/api/products'),
    getProduct: (id) => request(`/api/products/${id}`),
    createProduct: (data) =>
      request('/api/products', { method: 'POST', body: JSON.stringify(data) }),
    updateProduct: (id, data) =>
      request(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteProduct: (id) => request(`/api/products/${id}`, { method: 'DELETE' }),
    addProductMaterial: (productId, data) =>
      request(`/api/products/${productId}/materials`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    removeProductMaterial: (productId, materialId) =>
      request(`/api/products/${productId}/materials/${materialId}`, { method: 'DELETE' }),
  };
})();
