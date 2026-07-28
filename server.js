const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexão com o PostgreSQL do Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Inicialização das tabelas no PostgreSQL
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        data TEXT,
        hora TEXT,
        ponto TEXT,
        cloro REAL,
        ph REAL,
        operador TEXT,
        acao TEXT,
        criadoEm TEXT
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    console.log('Conectado e tabelas verificadas no PostgreSQL do Neon.');
  } catch (err) {
    console.error('Erro ao inicializar o banco PostgreSQL:', err.message);
  }
};

initDb();

// Rotas da API
app.get('/api/data', async (req, res) => {
  try {
    const entriesRes = await pool.query('SELECT * FROM entries');
    const configsRes = await pool.query('SELECT * FROM config');

    const entries = entriesRes.rows;
    const configs = configsRes.rows;

    const configObj = {};
    configs.forEach(c => { configObj[c.key] = c.value; });

    const pontos = [...new Set(entries.map(e => e.ponto))];

    res.json({ entries, pontos, config: configObj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/entries', async (req, res) => {
  const { id, data, hora, ponto, cloro, ph, operador, acao, criadoEm } = req.body;
  const query = `
    INSERT INTO entries (id, data, hora, ponto, cloro, ph, operador, acao, criadoEm) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `;
  try {
    await pool.query(query, [id, data, hora, ponto, cloro, ph, operador, acao, criadoEm]);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/entries/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM entries WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config', async (req, res) => {
  const { empresa, responsavel } = req.body;
  const query = `
    INSERT INTO config (key, value) 
    VALUES ($1, $2)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  try {
    await pool.query(query, ['empresa', empresa || '']);
    await pool.query(query, ['responsavel', responsavel || '']);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
