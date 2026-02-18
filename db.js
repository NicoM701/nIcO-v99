/**
 * db.js — SQLite helper for visitor stats (using sql.js — pure JavaScript)
 * Stores total_visitors count in ./data/visitors.sqlite
 */

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'visitors.sqlite');

let db = null;
let dbReady = null;

function initDb() {
  if (dbReady) return dbReady;

  dbReady = (async () => {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const SQL = await initSqlJs();

    // Load existing database or create new
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    // Create table if not exists
    db.run(`
      CREATE TABLE IF NOT EXISTS stats (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Initialize total_visitors if not present
    const result = db.exec("SELECT value FROM stats WHERE key = 'total_visitors'");
    if (result.length === 0 || result[0].values.length === 0) {
      db.run("INSERT OR IGNORE INTO stats (key, value) VALUES ('total_visitors', 0)");
      saveDb();
    }

    return db;
  })();

  return dbReady;
}

function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('DB save error:', err.message);
  }
}

/**
 * Get total visitor count
 */
async function getTotalVisitors() {
  try {
    await initDb();
    const result = db.exec("SELECT value FROM stats WHERE key = 'total_visitors'");
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0];
    }
    return 0;
  } catch (err) {
    console.error('DB error (getTotalVisitors):', err.message);
    return null;
  }
}

/**
 * Atomically increment and return the new total
 */
async function incrementTotalVisitors() {
  try {
    await initDb();
    db.run("UPDATE stats SET value = value + 1 WHERE key = 'total_visitors'");
    saveDb();
    return await getTotalVisitors();
  } catch (err) {
    console.error('DB error (incrementTotalVisitors):', err.message);
    return null;
  }
}

/**
 * Close the database connection gracefully
 */
function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
    dbReady = null;
  }
}

// Initialize DB eagerly
initDb().catch(err => console.error('DB init error:', err));

module.exports = { getTotalVisitors, incrementTotalVisitors, closeDb };
