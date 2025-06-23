const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sshAPI', {
  connect: opts => ipcRenderer.invoke('ssh-connect', opts),
  sendInput: (connId, data) => ipcRenderer.send('ssh-input', { connId, data }),
  onData: cb => ipcRenderer.on('ssh-data', (_, msg) => cb(msg))
});
