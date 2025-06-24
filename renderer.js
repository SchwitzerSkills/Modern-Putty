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
  const errorDialog = document.getElementById('error-dialog');
  const errorMsg    = document.getElementById('error-msg');
  const errorOkBtn  = document.getElementById('error-ok-btn');

  const { keyAPI } = window;

  const termView = document.getElementById('terminal-view');
  const keyView = document.getElementById('key-view');
  const genKeyBtn = document.getElementById('gen-key-btn');
  const keyList = document.getElementById('key-list');


  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-terminal').onclick = () => {
      termView.style.visibility = 'visible';
      termView.style.position = 'relative';
      termView.style.zIndex = '1';
      keyView.style.display = 'none';
    };

    document.getElementById('btn-sshkeys').onclick = () => {
      termView.style.visibility = 'hidden';
      termView.style.position = 'absolute';
      termView.style.zIndex = '-1';
      keyView.style.display = 'block';
      loadKeys();
    };

    genKeyBtn.onclick = () => {
      keyAPI.generate().then(loadKeys);
    };

    loadStartView();
  });


  function loadKeys() {
    keyAPI.list().then(keys => {
      keyList.innerHTML = '';
      keys.forEach((entry, index) => {
        const div = document.createElement('div');
        div.className = 'key-row';

        const pub = document.createElement('div');
        pub.className = 'key-pub';
        pub.textContent = entry.publicKey;
        pub.ondblclick = () => {
          navigator.clipboard.writeText(entry.publicKey).catch(err => {
            alert('Kopieren fehlgeschlagen: ' + err.message);
          });
        };

        const del = document.createElement('button');
        del.textContent = '🗑️';
        del.onclick = () => {
          keyAPI.remove(index).then(loadKeys);
        };

        div.appendChild(pub);
        div.appendChild(del);
        keyList.appendChild(div);
      });
    });
  }

  function loadStartView() {
    const container = document.getElementById('startview');
    container.innerHTML = '';
    window.storeAPI.getServers().then(list => {
      list.forEach(entry => {
        const btn = document.createElement('button');
        btn.textContent = `${entry.username}@${entry.host}`;
        btn.style.cssText = 'background:#333;color:#fff;padding:8px 12px;border:none;border-radius:4px;cursor:pointer;';
        btn.onclick = () => {
          const connId = Date.now().toString();
          createTab(connId, entry.host);
          startSSH(connId, entry.host, entry.username, entry.password);
        };
        container.appendChild(btn);
      });
    });
  }

  cancelBtn.onclick = () => dialog.close();
  newTabBtn.onclick = () => {
    hostIn.value = '';
    userIn.value = 'root';
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
    const options = {
      connId,
      host,
      port: 22,
      username: user
    };
    if (pass) {
      options.password = pass;
    }

    ssh.connect(options)
      .then(() => {
        const term = terms[connId];
        term.onData(d => ssh.sendInput(connId, d));
        ssh.onData(({ connId: id, data }) => {
          if (id === connId) term.write(data);
        });
        window.storeAPI.saveServer({ host, username: user, password: pass });
        loadStartView();
        ssh.onClose((closedId) => {
          if (closedId === connId) removeSession(connId);
        });

      })
      .catch(err => {
        if (err.message.includes('getaddrinfo')) {
          showError('Server konnte nicht aufgelöst werden.', connId);
        } else if (err.message.includes('All configured authentication methods failed')) {
          showError('Username oder Passwort falsch.', connId);
        } else {
          showError(`Verbindungsfehler: ${err.message}`, connId);
        }
      });
  }

  function showError(msg, connIdToClose) {
    errorMsg.textContent = msg;
    errorDialog.showModal();
    errorOkBtn.onclick = () => {
      errorDialog.close();
      if (connIdToClose) removeSession(connIdToClose);
    };
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
