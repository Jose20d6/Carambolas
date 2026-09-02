const cheerio = require('cheerio');
const { parsePrice } = require('./priceParser');

const FETCH_TIMEOUT_MS = 15000;
const USER_AGENT =
  'Mozilla/5.0 (compatible; CarambolasPriceBot/1.0; +https://github.com/)';

/**
 * Descarga la página del proveedor y extrae un valor numérico usando un
 * selector CSS. Se usa tanto para el precio de compra como, opcionalmente,
 * para la cantidad que trae el producto.
 */
async function fetchValueFromPage(url, selector) {
  if (!url || !selector) {
    throw new Error('Se requiere una URL y un selector CSS.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al contactar al proveedor.');
    }
    throw new Error(`No se pudo acceder a la página del proveedor: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`El proveedor respondió con estado ${response.status}.`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const element = $(selector).first();
  if (element.length === 0) {
    throw new Error(`No se encontró ningún elemento para el selector "${selector}".`);
  }

  const rawText = element.attr('content') || element.text();
  const value = parsePrice(rawText);
  if (value === null) {
    throw new Error(`No se pudo interpretar un número en el texto: "${rawText.trim()}".`);
  }

  return value;
}

module.exports = { fetchValueFromPage };
