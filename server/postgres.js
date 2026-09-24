const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const path = require('path');

function portOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(400);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

function databaseTarget() {
  const url = new URL(process.env.DATABASE_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  };
}

function isLocalHost(host) {
  return host === '127.0.0.1' || host === 'localhost';
}

async function ensureLocalPostgres() {
  const target = databaseTarget();
  if (!isLocalHost(target.host)) return null;
  if (await portOpen(target.host, target.port)) return null;

  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const dataDir = path.join(__dirname, '..', '.pgdata');
  fs.mkdirSync(dataDir, { recursive: true });

  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: target.user,
    password: target.password,
    port: target.port,
    persistent: true,
    onLog: () => {},
    onError: (message) => console.error(message),
  });

  const initialised = fs.existsSync(path.join(dataDir, 'PG_VERSION'));
  if (!initialised) await postgres.initialise();
  await postgres.start();

  try {
    await postgres.createDatabase(target.database);
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (!/already exists/i.test(message)) throw error;
  }

  return postgres;
}

function randomCode(prefix) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let code = prefix;
  for (let i = 0; i < bytes.length; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

function createReference() {
  return randomCode('ALE-');
}

function createGiftCode() {
  return randomCode('GIFT-');
}

module.exports = { ensureLocalPostgres, createReference, createGiftCode };
