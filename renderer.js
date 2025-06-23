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
    // TAB
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.draggable = true;
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

    // PANE
    const pane = document.createElement('div');
    pane.className = 'pane';
    pane.dataset.connId = connId;
    pane.tabIndex = 0;                  // Pane focusable machen
    panesEl.append(pane);
    panes[connId] = pane;

    // XTERM
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

    // Events
    tab.onclick = () => activate(connId);
    close.onclick = e => {
      e.stopPropagation();
      removeSession(connId);
    };
    tab.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', connId);
      e.dataTransfer.effectAllowed = 'move';
      showOverlay();
    });
    tab.addEventListener('dragend', () => hideOverlay());

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
    // Fokus aufs Terminal
    const pane = panes[connId];
    pane?.focus();
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

  // OVERLAY & DROP
  const ZONES = ['tl','bl','tr','br','top','bottom','left','right'];
  let overlay = null;

  function showOverlay() {
    hideOverlay();
    overlay = document.createElement('div');
    overlay.className = 'overlay';
    ZONES.forEach(pos => {
      const z = document.createElement('div');
      z.className = `zone zone-${pos}`;
      z.dataset.pos = pos;
      z.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      z.addEventListener('drop', onDrop);
      overlay.append(z);
    });
    panes[activeId].append(overlay);
  }
  function hideOverlay() {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
  }

  function onDrop(e) {
    e.preventDefault();
    const pos    = e.currentTarget.dataset.pos;
    const fromId = e.dataTransfer.getData('text/plain');
    const toId   = activeId;
    if (!tabs[fromId] || !panes[toId] || fromId===toId) {
      return hideOverlay();
    }

    // Merge Tab-Labels
    const toTab   = tabs[toId];
    const fromTab = tabs[fromId];
    const hosts   = `${toTab.dataset.hosts}, ${fromTab.dataset.hosts}`;
    toTab.dataset.hosts = hosts;
    toTab.querySelector('.label').textContent = hosts;

    // Entferne Tab-Button
    fromTab.remove();
    delete tabs[fromId];

    // Prüfe auf genau 3 Pane → Spezial-Layout
    const paneElems = Array.from(panesEl.querySelectorAll('.pane'));
    if (paneElems.length === 3) {
      layoutThree(paneElems);
      hideOverlay();
      activate(toId);
      return;
    }

    // Normales Split
    const fromPane = panes[fromId];
    const toPane   = panes[toId];
    delete panes[fromId];
    if (['left','right','top','bottom'].includes(pos)) {
      splitHalf(toPane, fromPane, pos);
    } else {
      splitQuarter(toPane, fromPane, pos);
    }

    hideOverlay();
    activate(toId);
  }

  function splitHalf(targetEl, newEl, pos) {
    const parent = targetEl.parentElement;
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position:absolute; top:0; left:0; right:0; bottom:0;
      display:flex;
      flex-direction:${(pos==='left'||pos==='right')?'row':'column'};
    `;
    parent.replaceChild(wrapper, targetEl);
    if (pos==='left'||pos==='top') {
      wrapper.append(newEl, targetEl);
    } else {
      wrapper.append(targetEl, newEl);
    }
    [newEl, targetEl].forEach(ch=>{
      ch.style.cssText = 'flex:1; width:100%; height:100%; position:relative; display:block;';
    });
  }

  function splitQuarter(targetEl, newEl, pos) {
    const parent = targetEl.parentElement;
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position:absolute; top:0; left:0; right:0; bottom:0;
      display:grid;
      grid-template-columns:1fr 1fr;
      grid-template-rows:1fr 1fr;
    `;
    const cells = Array.from({length:4}, () => {
      const c = document.createElement('div');
      c.style.cssText = 'position:relative; width:100%; height:100%;';
      wrapper.append(c);
      return c;
    });
    parent.replaceChild(wrapper, targetEl);
    const idxMap = { tl:0, tr:1, bl:2, br:3 };
    const oppMap = { tl:2, tr:3, bl:0, br:1 };
    cells[idxMap[pos]].append(newEl);
    cells[oppMap[pos]].append(targetEl);
    [newEl, targetEl].forEach(ch=>{
      ch.style.cssText = 'width:100%; height:100%; position:relative; display:block;';
    });
    cells.forEach(c=>{ if (!c.hasChildNodes()) c.style.background='#1e1e1e'; });
  }

  function layoutThree(paneElems) {
    // 3×2 Grid, Pane1 top-left, Pane2 top-right, Pane3 bottom-center
    panesEl.innerHTML = '';
    const [p1,p2,p3] = paneElems;
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position:absolute; top:0; left:0; right:0; bottom:0;
      display:grid;
      grid-template-columns:1fr 1fr 1fr;
      grid-template-rows:1fr 1fr;
      background:#1e1e1e;
    `;
    // Anhängen
    wrapper.append(p1, p2, p3);
    // Positionieren
    p1.style.cssText = 'grid-column:1; grid-row:1; position:relative; width:100%; height:100%;';
    p2.style.cssText = 'grid-column:3; grid-row:1; position:relative; width:100%; height:100%;';
    p3.style.cssText = 'grid-column:2; grid-row:2; position:relative; width:100%; height:100%;';
    panesEl.append(wrapper);
  }

})();
