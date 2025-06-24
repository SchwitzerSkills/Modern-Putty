;(function(){
  const ssh    = window.sshAPI;
  const clip   = window.clipAPI;
  const tabs   = {};
  const panes  = {};
  const terms  = {};
  let activeId = null;

  const tabbar    = document.getElementById('tabbar');
  const panesEl   = document.getElementById('panes');
  const dialog    = document.getElementById('conn-dialog');
  const hostIn    = document.getElementById('host-input');
  const userIn    = document.getElementById('user-input');
  const passIn    = document.getElementById('pass-input');
  const cancelBtn = document.getElementById('cancel-btn');
  const connectBtn= document.getElementById('connect-btn');
  const newTabBtn = document.getElementById('new-tab');

  cancelBtn.onclick = () => dialog.close();
  newTabBtn.onclick = () => {
    hostIn.value = '';
    passIn.value = '';
    dialog.showModal();
  };

  connectBtn.onclick = () => {
    const host = hostIn.value.trim();
    if (!host) return;
    const connId = Date.now().toString();
    createTab(connId, host);
    dialog.close();
    startSSH(connId, host, userIn.value.trim()||'root', passIn.value||null);
  };

  function createTab(connId, title) {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.hosts = title;
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = title;
    tab.append(label);
    const close = document.createElement('span');
    close.className = 'close';
    close.textContent = '×';
    tab.append(close);
    tabbar.append(tab);
    tabs[connId] = tab;

    const pane = document.createElement('div');
    pane.className = 'pane';
    pane.dataset.connId = connId;
    pane.tabIndex = 0;
    panesEl.append(pane);
    panes[connId] = pane;

    const term = new window.Terminal({
      theme: { background:'#1e1e1e', foreground:'#ffffff' },
      allowProposedApi: true
    });
    term.open(pane);
    term.write('\r\nConnecting…\r\n');
    term.attachCustomKeyEventHandler(e => {
      if (e.ctrlKey && !e.shiftKey && e.key==='c' && term.hasSelection()) {
        clip.writeText(term.getSelection());
        return false;
      }
      if (e.ctrlKey && !e.shiftKey && e.key==='v') {
        term.paste(clip.readText());
        return false;
      }
      return true;
    });
    terms[connId] = term;

    tab.onclick = () => activate(connId);
    close.onclick = e => {
      e.stopPropagation();
      removeSession(connId);
    };

    activate(connId);
  }

  function startSSH(connId, host, user, pass) {
    const term = terms[connId];
    ssh.connect({ connId, host, port:22, username:user, password:pass })
      .then(()=>{
        term.onData(d => ssh.sendInput(connId, d));
        ssh.onData(({ connId:id, data }) => {
          if (id===connId) term.write(data);
        });
      })
      .catch(err => term.write('\r\nSSH-Error: '+err.message+'\r\n'));
  }

  function activate(connId) {
    if (activeId === connId) return;
    activeId = connId;
    Object.entries(tabs).forEach(([id,el])=>
      el.classList.toggle('active', id===connId)
    );
    Object.entries(panes).forEach(([id,el])=>
      el.classList.toggle('active', id===connId)
    );
    panes[connId]?.focus();
    terms[connId]?.focus();
  }

  function removeSession(connId) {
    tabs[connId]?.remove(); delete tabs[connId];
    panes[connId]?.remove(); delete panes[connId];
    delete terms[connId];
    ssh.close(connId);
    const ids = Object.keys(tabs);
    if (ids.length) activate(ids[ids.length-1]);
  }
})();
