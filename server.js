const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicialização do Banco de Dados SQLite
const dbFile = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Erro ao abrir o banco de dados', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite.');
    db.run(`CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      data TEXT,
      hora TEXT,
      ponto TEXT,
      cloro REAL,
      ph REAL,
      operador TEXT,
      acao TEXT,
      criadoEm TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);
  }
});

// Rotas da API
app.get('/api/data', (req, res) => {
  db.all(`SELECT * FROM entries`, [], (err, entries) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.all(`SELECT * FROM config`, [], (err, configs) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const configObj = {};
      configs.forEach(c => { configObj[c.key] = c.value; });
      
      // Extrair pontos únicos dos registros ou configs
      const pontos = [...new Set(entries.map(e => e.ponto))];

      res.json({ entries, pontos, config: configObj });
    });
  });
});

app.post('/api/entries', (req, res) => {
  const { id, data, hora, ponto, cloro, ph, operador, acao, criadoEm } = req.body;
  const query = `INSERT INTO entries (id, data, hora, ponto, cloro, ph, operador, acao, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(query, [id, data, hora, ponto, cloro, ph, operador, acao, criadoEm], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id });
  });
});

app.delete('/api/entries/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM entries WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post('/api/config', (req, res) => {
  const { empresa, responsavel } = req.body;
  db.serialize(() => {
    db.run(`INSERT OR REPLACE INTO config (key, value) VALUES ('empresa', ?)`, [empresa || '']);
    db.run(`INSERT OR REPLACE INTO config (key, value) VALUES ('responsavel', ?)`, [responsavel || ''], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});