/**
 * Convierte un texto de precio (con símbolos de moneda, separadores de miles
 * en formato latino "1.234,56" o anglosajón "1,234.56") a un número.
 */
function parsePrice(text) {
  if (typeof text !== 'string') return null;
  const cleaned = text.replace(/[^0-9.,-]/g, '').trim();
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized;
  if (lastComma !== -1 && lastDot !== -1) {
    // El separador decimal es el que aparece más a la derecha.
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const decimals = cleaned.length - lastComma - 1;
    normalized = decimals === 3
      ? cleaned.replace(/,/g, '') // "1,234" -> separador de miles
      : cleaned.replace(',', '.');
  } else {
    normalized = cleaned;
  }

  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

module.exports = { parsePrice };
