;(function(){
  const ssh = window.sshAPI;
  const terms = {};

  const dialog    = document.getElementById('conn-dialog');
  const hostIn    = document.getElementById('host-input');
  const userIn    = document.getElementById('user-input');
  const passIn    = document.getElementById('pass-input');
  const cancelBtn = document.getElementById('cancel-btn');
  const connectBtn= document.getElementById('connect-btn');

  cancelBtn.addEventListener('click', () => dialog.close());

  document.getElementById('new-tab').addEventListener('click', () => {
    hostIn.value = '';
    passIn.value = '';
    dialog.showModal();
  });

  connectBtn.addEventListener('click', () => {
    if (!hostIn.value.trim()) return;
    const connId = Date.now().toString();
    const host   = hostIn.value.trim();
    const user   = userIn.value.trim() || 'root';
    const pass   = passIn.value || null;
    dialog.close();

    const container = document.createElement('div');
    document.getElementById('panes').append(container);

    const term = new window.Terminal();
    term.open(container);
    term.write('\r\nConnecting…\r\n');
    terms[connId] = term;

    ssh.connect({ connId, host, port:22, username:user, password:pass })
      .then(() => {
        term.onData(d => ssh.sendInput(connId, d));
        ssh.onData(({ connId:id, data }) => {
          if (id === connId) term.write(data);
        });
      })
      .catch(err => term.write('\r\nSSH-Error: ' + err.message + '\r\n'));
  });
})();
