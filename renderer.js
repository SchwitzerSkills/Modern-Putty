function arrangeLayout(){
  panesEl.innerHTML = '';
  const ids = order.slice();
  if(ids.length === 0) return;

  if(ids.length === 1){
    // … unverändert …
  }
  else if(ids.length === 2){
    // … unverändert …
  }
  else if(ids.length === 3){
    // 2 Spalten × 2 Reihen, dritter Pane unten full-width
    const w = document.createElement('div');
    w.style.cssText =
      'position:absolute;top:0;left:0;right:0;bottom:0;' +
      'display:grid;' +
      'grid-template-columns:1fr 1fr;' +
      'grid-template-rows:1fr 1fr;' +
      'background:#1e1e1e;';

    const [id1, id2, id3] = ids;
    const p1 = panes[id1], p2 = panes[id2], p3 = panes[id3];

    [p1, p2, p3].forEach(p => {
      if (p) {
        p.style.cssText = 'position:relative;width:100%;height:100%;display:block;';
        w.append(p);
      }
    });

    // Positionierungen:
    if (p1) { p1.style.gridColumn = '1';         p1.style.gridRow = '1'; }
    if (p2) { p2.style.gridColumn = '2';         p2.style.gridRow = '1'; }
    if (p3) { p3.style.gridColumn = '1 / span 2'; p3.style.gridRow = '2'; }

    panesEl.append(w);
  }
  else {
    // … fallback full-screen …
  }

  activate(activeId || ids[ids.length-1]);
}
