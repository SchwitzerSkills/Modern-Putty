const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sshAPI', {
  connect: (opts) => ipcRenderer.invoke('ssh-connect', opts),
  sendInput: (connId, data) => ipcRenderer.send('ssh-input', { connId, data }),
  onData: (cb) => ipcRenderer.on('ssh-data', (_, data) => cb(data)),
  onClose: (cb) => ipcRenderer.on('ssh-close', (_, id) => cb(id)),
  close: (connId) => ipcRenderer.send('ssh-close', connId)
});

contextBridge.exposeInMainWorld('storeAPI', {
  getServers: () => ipcRenderer.invoke('get-servers'),
  saveServer: (opts) => ipcRenderer.invoke('save-server', opts),
});

contextBridge.exposeInMainWorld('keyAPI', {
  generate: () => ipcRenderer.invoke('generate-keypair'),
  list: () => ipcRenderer.invoke('list-keypairs'),
  remove: (index) => ipcRenderer.invoke('delete-keypair', index)
});

contextBridge.exposeInMainWorld('clipAPI', {
  writeText: (txt) => navigator.clipboard.writeText(txt),
  readText: () => navigator.clipboard.readText()
});
