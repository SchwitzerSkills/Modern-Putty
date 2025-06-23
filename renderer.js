;(function(){
  const ssh   = window.sshAPI;
  const clip  = window.clipAPI;
  const tabs  = {};
  const panes = {};
  const terms = {};
  let activeId = null;

  const tabsEl = document.getElementById('tabs');
  const panesEl= document.getElementById('panes');
  const dialog = document.getElementById('conn-dialog');
  const hostIn = document.getElementById('host-input');
  const userIn = document.getElementById('user-input');
  const passIn = document.getElementById('pass-input');
  const cancelBtn = document.getElementById('cancel-btn');
  const connectBtn= document.getElementById('connect-btn');

  cancelBtn.onclick = () => dialog.close();
  document.getElementById('new-tab').onclick = () => {
    hostIn.value=''; passIn.value=''; dialog.showModal();
  };

  connectBtn.onclick = () => {
    if (!hostIn.value.trim()) return;
    const connId = Date.now().toString();
    const host   = hostIn.value.trim();
    const user   = userIn.value.trim() || 'root';
    const pass   = passIn.value || null;
    dialog.close();

    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.textContent = host;
    const close = document.createElement('span');
    close.className = 'close'; close.textContent = '×';
    tab.append(close);
    tabsEl.append(tab);
    tabs[connId] = tab;

    const container = document.createElement('div');
    panesEl.append(container);
    panes[connId] = container;

    const term = new window.Terminal({
      theme: { background: '#1e1e1e', foreground: '#ffffff' },
      allowProposedApi: true
    });
    term.open(container);
    term.write('\r\nConnecting…\r\n');
    terms[connId] = term;

    function activate(id){
      if (activeId === id) return;
      activeId = id;
      Object.entries(tabs).forEach(([k,t])=>{
        t.classList.toggle('active', k===id);
      });
      Object.entries(panes).forEach(([k,p])=>{
        p.style.display = (k===id ? 'block' : 'none');
      });
    }
    tab.onclick = () => activate(connId);

    close.onclick = e => {
      e.stopPropagation();
      ssh.close(connId);
      tab.remove();
      container.remove();
      delete tabs[connId];
      delete panes[connId];
      delete terms[connId];
      const ids = Object.keys(tabs);
      if (ids.length) activate(ids[ids.length-1]);
    };

term.attachCustomKeyEventHandler(e => {
  if (e.ctrlKey && !e.shiftKey && e.key === 'c' && term.hasSelection()) {
    clip.writeText(term.getSelection());
    return false; 
  }
  if (e.ctrlKey && !e.shiftKey && e.key === 'v') {
    const txt = clip.readText();
    term.paste(txt);
    return false;
  }
  return true;
});


    ssh.connect({ connId, host, port:22, username:user, password:pass })
      .then(()=>{
        term.onData(d=>ssh.sendInput(connId,d));
        ssh.onData(({connId:id,data})=>{
          if (id===connId) term.write(data);
        });
        activate(connId);
      })
      .catch(err=>{
        term.write('\r\nSSH-Error: '+err.message+'\r\n');
        activate(connId);
      });
  };
})();
