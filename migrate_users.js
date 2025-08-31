// migrate_users.js
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const DB_FILE = process.env.DB_FILE || path.join(__dirname, "db.sqlite");
const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// users tablosunda hangi sütunlar var, kontrol et
const cols = db.prepare(`PRAGMA table_info(users)`).all().map(c => c.name);

if (!cols.includes("password_hash") && cols.includes("password")) {
  // Yeni tablo oluştur
  db.exec(`
    CREATE TABLE IF NOT EXISTS users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Eski kullanıcıları çek
  const rows = db.prepare(`SELECT id, username, password, created_at FROM users`).all();

  // Eski parolaları hash'le ve yeni tabloya yaz
  const insert = db.prepare(`INSERT INTO users_new (id, username, password_hash, created_at) VALUES (?,?,?,?)`);
  const tx = db.transaction(() => {
    for (const r of rows) {
      const hash = bcrypt.hashSync(String(r.password || ""), 10);
      insert.run(r.id, r.username, hash, r.created_at || new Date().toISOString());
    }
  });
  tx();

  // Eski tabloyu değiştir
  db.exec(`
    ALTER TABLE users RENAME TO users_old;
    ALTER TABLE users_new RENAME TO users;
    DROP TABLE users_old;
  `);

  console.log("✅ Migration complete: users.password -> users.password_hash");
} else if (cols.includes("password_hash")) {
  console.log("ℹ️ No migration needed (password_hash already exists).");
} else {
  console.error("❌ Unexpected schema. users tablosunda password yok.");
  process.exit(1);
}

db.close();
