const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Client } = require('ssh2');
require('@electron/remote/main').initialize();

let sessions = {};

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', ()=> app.quit());
app.on('activate', ()=> {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('ssh-connect', (event, opts) => {
  const { connId, host, port = 22, username, password, privateKey } = opts;
  const conn = new Client();
  sessions[connId] = { conn, stream: null };

  conn.on('ready', () => {
    conn.shell(
      { term: 'xterm-color', cols: 80, rows: 24 },
      (err, stream) => {
        if (err) {
          event.sender.send('ssh-data', {
            connId,
            data: `\r\nShell-Fehler: ${err.message}\r\n`
          });
          return;
        }
        sessions[connId].stream = stream;
        stream.on('data', data => {
          event.sender.send('ssh-data', { connId, data: data.toString() });
        });
        stream.on('close', () => conn.end());
      }
    );
  });

  const cfg = { host, port, username };
  if (password)     cfg.password   = password;
  else if (privateKey) cfg.privateKey = privateKey;

  conn.connect(cfg);
});

ipcMain.on('ssh-input', (event, { connId, data }) => {
  const s = sessions[connId]?.stream;
  if (s) s.write(data);
});
ipcMain.handle('ssh-close', (event, connId) => {
  const session = sessions[connId];
  if (session) {
    session.stream?.close();
    session.conn.end();
    delete sessions[connId];
  }
});