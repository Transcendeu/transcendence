const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, './database.sqlite'); // será inutilizada - se conectar na porta 5000 com o db

const db = new sqlite3.Database(dbPath, (err) => { // passar esse bloco para que o auth 'index.js' se conecte diretamente com o banco de dados
												  // todas as partes do back que terão conexão com o banco deverão ter uma nova instância
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => { // tabela usuario
      db.run(`CREATE TABLE IF NOT EXISTS USER (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        two_factor_secret TEXT,
        two_factor_enabled BOOLEAN DEFAULT 0,
        status TEXT DEFAULT 'offline',
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
		// tabela auth
      db.run(`CREATE TABLE IF NOT EXISTS AUTH (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        access_token TEXT NOT NULL UNIQUE,
        refresh_token TEXT,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        revoked BOOLEAN DEFAULT 0,
        auth_provider TEXT DEFAULT 'local',
        FOREIGN KEY (user_id) REFERENCES USER(id) ON DELETE CASCADE
      )`, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
};

module.exports = {
  db,
  initDatabase
}; 