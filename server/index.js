const path = require('path');
const express = require('express');

const materialsRouter = require('./routes/materials');
const productsRouter = require('./routes/products');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/materials', materialsRouter);
app.use('/api/products', productsRouter);
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`Carambolas escuchando en http://localhost:${PORT}`);
});

module.exports = app;
