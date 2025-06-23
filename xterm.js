// renderer.js
const { Terminal } = require('@xterm/xterm');

const terms = {};
function newTab(connId, hostCfg) {
  const term = new Terminal();
  const container = document.createElement('div');
  document.body.append(container);
  term.open(container);

  // erst SSH-Verbindung aufbauen
  window.sshAPI.connect({ connId, ...hostCfg }).then(() => {
    term.onData(d => window.sshAPI.sendInput(connId, d));
    window.sshAPI.onData(({ connId: id, data }) => {
      if (id === connId) term.write(data);
    });
  });
}
