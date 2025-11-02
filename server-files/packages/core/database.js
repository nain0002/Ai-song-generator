const fs = require('fs');
const path = require('path');

let mysql;

try {
  mysql = require('mysql2/promise');
} catch (error) {
  console.error('[core] Missing dependency: mysql2. Run "npm install" inside server-files/packages/core.');
  throw error;
}

let pool = null;
let isReady = false;

const CONFIG_DIR = path.join(__dirname, 'config');
const CONFIG_PATH = path.join(CONFIG_DIR, 'database.json');
const SCHEMA_PATH = path.join(__dirname, '../../..', 'database', 'schema.sql');

function ensureConfigFile() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const examplePath = path.join(CONFIG_DIR, 'database.example.json');
    throw new Error(`Database config missing. Copy ${examplePath} to ${CONFIG_PATH} and update credentials.`);
  }
}

async function runSchemaMigrations(connection) {
  if (!fs.existsSync(SCHEMA_PATH)) {
    throw new Error(`Schema file missing at ${SCHEMA_PATH}`);
  }

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const statements = schema
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await connection.query(statement);
  }
}

async function initDatabase() {
  if (isReady && pool) {
    return pool;
  }

  ensureConfigFile();

  const configBuffer = fs.readFileSync(CONFIG_PATH, 'utf8');
  const config = JSON.parse(configBuffer);

  pool = mysql.createPool({
    host: config.host,
    port: config.port ?? 3306,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: config.connectionLimit ?? 10,
    waitForConnections: true,
    namedPlaceholders: true
  });

  await runSchemaMigrations(pool);
  isReady = true;
  return pool;
}

function getPool() {
  if (!pool) {
    throw new Error('Database has not been initialised. Call initDatabase() first.');
  }
  return pool;
}

async function getUserByUsername(username) {
  const connection = getPool();
  const [rows] = await connection.query(
    'SELECT id, username, password_salt, password_hash, created_at, last_seen_at FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1',
    [username]
  );

  return rows[0] ?? null;
}

async function createUser(username, password) {
  const connection = getPool();
  const [result] = await connection.execute(
    'INSERT INTO users (username, password_salt, password_hash) VALUES (?, ?, ?)',
    [username, password.salt, password.hash]
  );

  return result.insertId;
}

async function updateLastSeen(userId) {
  const connection = getPool();
  await connection.execute('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
}

async function getInventoryForUser(userId) {
  const connection = getPool();
  const [rows] = await connection.query(
    'SELECT item_identifier AS id, name, description FROM inventory_items WHERE user_id = ? ORDER BY id ASC',
    [userId]
  );

  return rows;
}

async function addInventoryItem(userId, item) {
  const connection = getPool();
  await connection.execute(
    'INSERT INTO inventory_items (user_id, item_identifier, name, description) VALUES (?, ?, ?, ?)',
    [userId, item.id, item.name, item.description]
  );
}

async function addInventoryItems(userId, items) {
  for (const item of items) {
    // eslint-disable-next-line no-await-in-loop
    await addInventoryItem(userId, item);
  }
}

async function removeInventoryItem(userId, itemIdentifier) {
  const connection = getPool();
  const [result] = await connection.execute(
    'DELETE FROM inventory_items WHERE user_id = ? AND item_identifier = ? LIMIT 1',
    [userId, itemIdentifier]
  );

  return result.affectedRows > 0;
}

module.exports = {
  initDatabase,
  getUserByUsername,
  createUser,
  updateLastSeen,
  getInventoryForUser,
  addInventoryItem,
  addInventoryItems,
  removeInventoryItem
};
