const { contextBridge, ipcRenderer, clipboard } = require('electron');
contextBridge.exposeInMainWorld('sshAPI', {
  connect: opts    => ipcRenderer.invoke('ssh-connect', opts),
  sendInput: (id,d)=> ipcRenderer.send('ssh-input',{connId:id,data:d}),
  close: connId    => ipcRenderer.invoke('ssh-close', connId),
  onData: cb       => ipcRenderer.on('ssh-data',(_,msg)=>cb(msg))
});
contextBridge.exposeInMainWorld('clipAPI', {
  writeText: txt => clipboard.writeText(txt),
  readText: ()=> clipboard.readText()
});
