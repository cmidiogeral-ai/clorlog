const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexão com o PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Inicialização e adequação das tabelas
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        unidade TEXT,
        data TEXT,
        hora TEXT,
        ponto TEXT,
        cloro NUMERIC,
        ph NUMERIC,
        operador TEXT,
        acao TEXT,
        criadoEm TEXT
      );
    `);

    await pool.query(`ALTER TABLE entries ADD COLUMN IF NOT EXISTS unidade TEXT;`);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    console.log('Banco de dados pronto para operacao!');
  } catch (err) {
    console.error('Erro ao inicializar o banco:', err.message);
  }
};

initDb();

// ROTAS DA API

// 1. Obter dados e configurações
app.get('/api/data', async (req, res) => {
  try {
    const configsRes = await pool.query('SELECT * FROM config');
    const entriesRes = await pool.query('SELECT * FROM entries ORDER BY criadoEm DESC');

    const configObj = { empresa: '', responsavel: '', unidades: '' };
    configsRes.rows.forEach(c => { configObj[c.key] = c.value; });

    res.json({
      entries: entriesRes.rows,
      config: configObj
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Salvar registro com validação reforçada
app.post('/api/entries', async (req, res) => {
  const { id, unidade, data, hora, ponto, cloro, ph, operador, acao, criadoEm } = req.body;

  const cloroNum = isNaN(parseFloat(cloro)) ? 0 : parseFloat(cloro);
  const phNum = (ph !== null && ph !== undefined && !isNaN(parseFloat(ph))) ? parseFloat(ph) : null;

  const query = `
    INSERT INTO entries (id, unidade, data, hora, ponto, cloro, ph, operador, acao, criadoEm) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (id) DO UPDATE SET
      unidade = EXCLUDED.unidade,
      data = EXCLUDED.data,
      hora = EXCLUDED.hora,
      ponto = EXCLUDED.ponto,
      cloro = EXCLUDED.cloro,
      ph = EXCLUDED.ph,
      operador = EXCLUDED.operador,
      acao = EXCLUDED.acao,
      criadoEm = EXCLUDED.criadoEm
  `;
  try {
    await pool.query(query, [id, unidade || '', data, hora, ponto, cloroNum, phNum, operador, acao || '', criadoEm]);
    res.json({ success: true, id });
  } catch (err) {
    console.error("Erro ao salvar no banco:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3. Excluir registro
app.delete('/api/entries/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM entries WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Salvar Configurações
app.post('/api/config', async (req, res) => {
  const { empresa, responsavel, unidades } = req.body;
  const query = `
    INSERT INTO config (key, value) 
    VALUES ($1, $2)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  try {
    await pool.query(query, ['empresa', empresa || '']);
    await pool.query(query, ['responsavel', responsavel || '']);
    await pool.query(query, ['unidades', unidades || '']);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
