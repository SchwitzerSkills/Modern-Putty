const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Client } = require('ssh2');
const sshpk = require('sshpk');
require('@electron/remote/main').initialize();

const SAVE_PATH = path.join(app.getPath('userData'), 'servers.json');
const KEY_DIR = path.join(app.getPath('userData'), 'keys');
const ENC_KEY = crypto.createHash('sha256').update('fixed-key-for-local').digest();
const IV = Buffer.alloc(16, 0);

let sessions = {};
if (!fs.existsSync(KEY_DIR)) fs.mkdirSync(KEY_DIR);

function encrypt(text) {
  const cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, IV);
  return cipher.update(text, 'utf8', 'base64') + cipher.final('base64');
}

function decrypt(enc) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, IV);
  return decipher.update(enc, 'base64', 'utf8') + decipher.final('utf8');
}

function loadServers() {
  if (!fs.existsSync(SAVE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(SAVE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveServer(entry) {
  const list = loadServers();
  const exists = list.find(s => s.host === entry.host && s.username === entry.username);
  if (!exists) {
    list.push(entry);
    fs.writeFileSync(SAVE_PATH, JSON.stringify(list, null, 2));
  }
}

ipcMain.handle('generate-keypair', async () => {
  const { generateKeyPairSync } = require('crypto');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  });

  const id = Date.now();
  const privPath = path.join(KEY_DIR, `id_${id}`);
  const pubPath = privPath + '.pub';

  fs.writeFileSync(privPath, privateKey);
  const sshKey = sshpk.parseKey(publicKey, 'pem');
  const sshFormatted = sshKey.toString('ssh').replace('(unnamed)', `key-${id}`);
  fs.writeFileSync(pubPath, sshFormatted);

  return { privateKeyPath: privPath, publicKey: sshFormatted };
});

ipcMain.handle('list-keypairs', () => {
  const files = fs.readdirSync(KEY_DIR).filter(f => f.endsWith('.pub'));
  return files.map(file => {
    const key = fs.readFileSync(path.join(KEY_DIR, file), 'utf8');
    return { publicKey: key };
  });
});

ipcMain.handle('delete-keypair', (event, index) => {
  const files = fs.readdirSync(KEY_DIR).filter(f => f.endsWith('.pub'));
  if (index >= 0 && index < files.length) {
    const base = files[index].replace('.pub', '');
    fs.unlinkSync(path.join(KEY_DIR, base));
    fs.unlinkSync(path.join(KEY_DIR, base + '.pub'));
  }
});

ipcMain.handle('ssh-connect', async (event, opts) => {
  const { connId, host, port = 22, username, password } = opts;
  const conn = new Client();
  sessions[connId] = { conn, stream: null };

  return new Promise((resolve, reject) => {
    conn.on('ready', () => {
      conn.shell({ term: 'xterm-color', cols: 80, rows: 24 }, (err, stream) => {
        if (err) return reject(err);
        sessions[connId].stream = stream;
        stream.on('data', data => {
          event.sender.send('ssh-data', { connId, data: data.toString() });
        });
        stream.on('close', () => conn.end());
        resolve();
      });
    });

    conn.on('error', err => reject(err));
    const cfg = { host, port, username };

    try {
      if (password) cfg.password = password;
      else {
        const keys = fs.readdirSync(KEY_DIR).filter(f => !f.endsWith('.pub'));
        if (keys.length) cfg.privateKey = fs.readFileSync(path.join(KEY_DIR, keys[0]), 'utf8');
      }
    } catch (e) {
      return reject(new Error('Key-Fehler: ' + e.message));
    }

    conn.connect(cfg);
  });
});

ipcMain.handle('get-servers', () => {
  return loadServers().map(s => ({
    host: s.host,
    username: s.username,
    password: decrypt(s.password)
  }));
});

ipcMain.handle('save-server', (event, { host, username, password }) => {
  if (host && username && password) saveServer({ host, username, password: encrypt(password) });
});

ipcMain.on('ssh-input', (event, { connId, data }) => {
  const session = sessions[connId];
  if (session?.stream) session.stream.write(data);
});

ipcMain.handle('ssh-close', (event, connId) => {
  const session = sessions[connId];
  if (session) {
    session.stream?.close();
    session.conn.end();
    delete sessions[connId];
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
