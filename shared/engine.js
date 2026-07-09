/* ===================================================================
   Haakhuis Carnaval Atelier — engine v2 (echte kledingstukken)

   - modellen én jassen zijn foto-sheets met 4 aanzichten
   - kalibratie (crops + lichaamsbreedtes) komt uit calibration.js,
     zodat het prototype ook zonder webserver werkt (file://);
     ontbreekt een entry, dan wordt runtime gemeten (vereist server)
   - jassen worden per onderdeel (kraag/mouwen/midden/zoom) als
     foto-regio met zachte randen op het lichaam gecomponeerd
   - multiply-blending laat de witte fotoachtergrond wegvallen
   - niveau 1: onderdelen verslepen/schalen · niveau 2: pose-detectie
   =================================================================== */

const Engine = (() => {

  /* ---------- state ---------- */
  const state = {
    model: MODELS[4],
    viewIdx: 0,
    keuze: { kraag: 'prins', mouwen: 'prins', midden: 'prins', zoom: 'prins' },
    kleur: { kraag: 0, mouwen: 0, midden: 0, zoom: 0 },
    adj: {},                 // `${slot}|${viewId}` -> {dx,dy,s}
    selected: null,          // geselecteerd slot (niveau 1)
    manual: false,
    pose: false,
  };

  const imgCache = new Map();     // src -> Promise<HTMLImageElement>
  const cropCache = new Map();    // `${kind}:${id}` -> crops[]
  const spriteCache = new Map();  // sprite-canvas cache
  const poseCache = new Map();

  function loadImage(src) {
    if (!imgCache.has(src)) {
      imgCache.set(src, new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error('Kan afbeelding niet laden: ' + src));
        im.src = src;
      }));
    }
    return imgCache.get(src);
  }

  /* crops: eerst uit de gebakken kalibratie, anders runtime meten */
  function cropsFor(kind, id, img) {
    const key = `${kind}:${id}`;
    if (cropCache.has(key)) return cropCache.get(key);
    let crops = (typeof CAL !== 'undefined' && CAL[kind] && CAL[kind][id]) || null;
    if (!crops) crops = segment(img);   // vereist same-origin (webserver)
    cropCache.set(key, crops);
    return crops;
  }

  /* ---------- segmentatie (alleen fallback / bake) ---------- */
  function segment(img) {
    const W = 700, H = Math.round(img.height / img.width * W);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, W, H);
    const d = cx.getImageData(0, 0, W, H).data;
    const dark = (x, y) => {
      const i = (y * W + x) * 4;
      return (d[i] + d[i + 1] + d[i + 2]) / 3 < 238;
    };
    const colMass = new Array(W).fill(0);
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (dark(x, y)) colMass[x]++;
    const segs = [];
    let start = -1, gap = 0;
    for (let x = 0; x < W; x++) {
      if (colMass[x] > 2) { if (start < 0) start = x; gap = 0; }
      else if (start >= 0 && ++gap > 10) { segs.push([start, x - gap]); start = -1; }
    }
    if (start >= 0) segs.push([start, W - 1]);
    segs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
    let four = segs.slice(0, 4).sort((a, b) => a[0] - b[0]);
    if (four.length !== 4) four = [0, 1, 2, 3].map(i => [i * W / 4 + 8, (i + 1) * W / 4 - 8]);
    const sc = img.width / W;
    return four.map(([x0, x1]) => {
      let top = H, bot = 0;
      for (let y = 0; y < H; y++) {
        for (let x = x0; x <= x1; x += 2) {
          if (dark(x, y)) { if (y < top) top = y; if (y > bot) bot = y; break; }
        }
      }
      if (top >= bot) { top = H * .04; bot = H * .96; }
      const yCut = top + (bot - top) * .92;
      let left = x1, right = x0;
      for (let y = top; y < yCut; y++) {
        for (let x = x0; x <= x1; x += 2) {
          if (dark(x, y)) { if (x < left) left = x; break; }
        }
        for (let x = x1; x >= x0; x -= 2) {
          if (dark(x, y)) { if (x > right) right = x; break; }
        }
      }
      if (right > left) { x0 = left; x1 = right; }
      const meas = (fr) => {
        const yy = Math.round(top + (bot - top) * fr);
        let l = x1, r = x0;
        for (let y = Math.max(top, yy - 4); y <= Math.min(bot, yy + 4); y++) {
          for (let x = x0; x <= x1; x++) if (dark(x, y)) { if (x < l) l = x; break; }
          for (let x = x1; x >= x0; x--) if (dark(x, y)) { if (x > r) r = x; break; }
        }
        if (r <= l) { l = x0; r = x1; }
        return { w: Math.round((r - l) * sc), c: Math.round(((l + r) / 2) * sc) };
      };
      const bands = { head: meas(.06), chest: meas(.30), hip: meas(.52), leg: meas(.70) };
      const mx = (x1 - x0) * .06, my = (bot - top) * .015;
      return {
        x: Math.round(Math.max(0, (x0 - mx) * sc)), y: Math.round(Math.max(0, (top - my) * sc)),
        w: Math.round((x1 - x0 + 2 * mx) * sc), h: Math.round((bot - top + 2 * my) * sc),
        bands,
      };
    });
  }

  /* ---------- stage ---------- */
  let stageEl, modelCv, svgEl, hintEl;
  let SW = 0, SH = 0;
  let figRect = null, curCrop = null, poseLm = null;

  const view = () => VIEWS[state.viewIdx];
  const adjKey = (slot) => `${slot}|${view().id}`;
  const getAdj = (slot) => state.adj[adjKey(slot)] || { dx: 0, dy: 0, s: 1 };

  function paintStageBg(ctx, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#fdf3fa');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const sh = ctx.createRadialGradient(W / 2, H * .953, 4, W / 2, H * .953, W * .3);
    sh.addColorStop(0, 'rgba(65,64,64,.20)');
    sh.addColorStop(1, 'rgba(65,64,64,0)');
    ctx.save();
    ctx.translate(0, H * .953); ctx.scale(1, .1); ctx.translate(0, -H * .953);
    ctx.fillStyle = sh;
    ctx.fillRect(0, H * .85, W, H * 2);
    ctx.restore();
  }

  /* schaal/positie van het figuur binnen de stage (ongespiegelde ruimte) */
  function layout(crop, W, H) {
    const dh = H * .88;
    const k = dh / crop.h;
    const dw = crop.w * k;
    const chestCx = (crop.bands.chest.c - crop.x) * k;   // borst-middelpunt binnen crop
    const x = W / 2 - chestCx;                           // borst gecentreerd op stage
    return { x, y: H * .945 - dh, w: dw, h: dh, k };
  }

  /* ---------- de complete scène tekenen (stage én export) ---------- */
  async function renderScene(ctx, W, H) {
    const v = view();
    const mImg = await loadImage(state.model.img);
    const crops = cropsFor('models', state.model.id, mImg);
    const crop = crops[v.crop];
    curCrop = crop;
    figRect = layout(crop, W, H);

    paintStageBg(ctx, W, H);

    /* pose-detectie (niveau 2) */
    poseLm = null;
    if (state.pose && window.poseProvider) {
      const key = `${state.model.id}|${v.crop}`;
      if (!poseCache.has(key)) {
        setPoseStatus('busy', 'Pose detecteren…');
        try { poseCache.set(key, await window.poseProvider(mImg, crop)); }
        catch (e) { console.warn('pose mislukt', e); poseCache.set(key, null); }
      }
      poseLm = poseCache.get(key);
      setPoseStatus(poseLm ? 'ok' : 'err',
        poseLm ? `Pose gedetecteerd — ${poseLm.n} lichaamspunten` : 'Geen pose — terugval op fotokalibratie');
    }

    /* alles binnen dezelfde (eventueel gespiegelde) transform tekenen */
    ctx.save();
    if (v.mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.globalCompositeOperation = 'multiply';
    ctx.filter = 'brightness(1.035)';
    ctx.drawImage(mImg, crop.x, crop.y, crop.w, crop.h, figRect.x, figRect.y, figRect.w, figRect.h);
    ctx.filter = 'none';

    /* kledingdelen */
    for (const slot of DRAW_ORDER) {
      await drawPart(ctx, slot);
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';

    /* lichaamspunten (niveau 2, demo) */
    if (state.pose && poseLm && window.showPoseDots && poseLm.raw) {
      ctx.fillStyle = '#ED0BF0';
      ctx.strokeStyle = '#fff';
      for (const p of poseLm.raw) {
        const x = figRect.x + (v.mirror ? 1 - p.x : p.x) * figRect.w;
        const y = figRect.y + p.y * figRect.h;
        ctx.beginPath();
        ctx.arc(v.mirror ? W - x : x, y, 3.2, 0, 7);
        ctx.fill(); ctx.stroke();
      }
    }
  }

  /* rechthoek (ongespiegelde stage-ruimte) waar een jas landt */
  async function garmentRect(g) {
    const v = view();
    const gImg = await loadImage(g.img);
    const gc = cropsFor('garments', g.id, gImg)[v.crop];
    const mb = curCrop.bands;
    const k = figRect.k;

    /* schaal: borst-breedte jas ↦ borst-breedte model (jas iets ruimer);
       verticaal per leeftijdstype ingekort (kind heeft kortere romp) */
    const s = (mb.chest.w * k * 1.16) / gc.bands.chest.w;
    const vf = { child: .78, teen: .92, adult: 1 }[state.model.type] || 1;

    /* verticaal: bovenkant jas (kraag) net boven de schouderlijn */
    const f = FRACTIONS[state.model.type];
    let shoulderY = figRect.y + f.shoulder * figRect.h;
    if (poseLm) {
      const shC = (poseLm.lShoulder.y + poseLm.rShoulder.y) / 2;
      shoulderY = figRect.y + shC * figRect.h;
    }
    const y = shoulderY - .055 * figRect.h;

    /* horizontaal: borst-middelpunten uitlijnen */
    const chestCx = figRect.x + (mb.chest.c - curCrop.x) * k;
    const x = chestCx - (gc.bands.chest.c - gc.x) * s;

    const base = { x, y, w: gc.w * s, h: gc.h * s * vf, gc, img: gImg };

    /* handmatige aanpassing (per slot, per aanzicht) toepassen kan
       hier niet — die is per onderdeel; zie drawPart */
    return base;
  }

  async function drawPart(ctx, slot) {
    const g = garmentById(state.keuze[slot]);
    if (!g) return;
    const R = await garmentRect(g);
    const adj = getAdj(slot);
    const regs = regionsFor(view().id)[slot];
    const kleur = state.kleur[slot] || 0;

    for (let ri = 0; ri < regs.length; ri++) {
      const sprite = await getSprite(g, view().crop, slot, ri, kleur);
      if (!sprite) continue;
      const r = regs[ri];
      /* doelrect + slot-aanpassing (schaal om het midden van de jas) */
      const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
      const sx = (x) => cx + (x - cx) * adj.s + adj.dx;
      const sy = (y) => cy + (y - cy) * adj.s + adj.dy;
      const tx = sx(R.x + r.x0 * R.w), ty = sy(R.y + r.y0 * R.h);
      const tw = (r.x1 - r.x0) * R.w * adj.s, th = (r.y1 - r.y0) * R.h * adj.s;
      ctx.globalCompositeOperation = sprite.mode;
      ctx.drawImage(sprite.cv, tx, ty, tw, th);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* onderdeel-sprite: foto-regio + hue-kleur + zachte randen */
  async function getSprite(g, cropIdx, slot, ri, kleurIdx) {
    const key = `${g.id}|${cropIdx}|${slot}|${ri}|${kleurIdx}`;
    if (spriteCache.has(key)) return spriteCache.get(key);

    const img = await loadImage(g.img);
    const gc = cropsFor('garments', g.id, img)[cropIdx];
    const r = regionsFor(VIEWS.find(v => v.crop === cropIdx && !v.mirror).id)[slot][ri];

    const rx = gc.x + r.x0 * gc.w, ry = gc.y + r.y0 * gc.h;
    const rw = (r.x1 - r.x0) * gc.w, rh = (r.y1 - r.y0) * gc.h;
    const cap = Math.min(1, 1100 / rh);
    const cw = Math.max(2, Math.round(rw * cap)), ch = Math.max(2, Math.round(rh * cap));

    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.filter = ('brightness(1.035) ' + (KLEUREN[kleurIdx].filter || '')).trim();
    try {
      c.drawImage(img, rx, ry, rw, rh, 0, 0, cw, ch);
    } catch (e) { console.warn(e); return null; }
    c.filter = 'none';

    /* witte fotoachtergrond → transparant (veilig: de stoffen zijn
       verzadigd, dus alleen neutrale bijna-witte pixels verdwijnen).
       Lukt dat niet (file://, canvas taint) dan vallen we terug op
       multiply-blending. */
    let mode = 'source-over';
    try {
      const id = c.getImageData(0, 0, cw, ch);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const rP = d[i], gP = d[i + 1], bP = d[i + 2];
        const mx = Math.max(rP, gP, bP), mn = Math.min(rP, gP, bP);
        const lum = (rP + gP + bP) / 3, sat = mx - mn;
        if (sat < 28 && lum > 231) {
          d[i + 3] = lum >= 246 ? 0 : Math.round(255 * (246 - lum) / 15);
        }
      }
      c.putImageData(id, 0, 0);
    } catch (e) {
      mode = 'multiply';
    }

    /* zachte naadranden (alpha-verloop) */
    const F = .07;
    c.globalCompositeOperation = 'destination-out';
    for (const edge of (r.feather || [])) {
      let grad;
      const fw = Math.round(cw * F), fh = Math.round(ch * F);
      if (edge === 'l') grad = c.createLinearGradient(fw, 0, 0, 0);
      if (edge === 'r') grad = c.createLinearGradient(cw - fw, 0, cw, 0);
      if (edge === 't') grad = c.createLinearGradient(0, fh, 0, 0);
      if (edge === 'b') grad = c.createLinearGradient(0, ch - fh, 0, ch);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,1)');
      c.fillStyle = grad;
      if (edge === 'l') c.fillRect(0, 0, fw, ch);
      if (edge === 'r') c.fillRect(cw - fw, 0, fw, ch);
      if (edge === 't') c.fillRect(0, 0, cw, fh);
      if (edge === 'b') c.fillRect(0, ch - fh, cw, fh);
    }
    c.globalCompositeOperation = 'source-over';

    const sprite = { cv, mode };
    spriteCache.set(key, sprite);
    return sprite;
  }

  /* ---------- stage renderen + interactie-overlay ---------- */
  let renderBusy = false, renderQueued = false;
  async function renderStage() {
    if (renderBusy) { renderQueued = true; return; }
    renderBusy = true;
    try {
      SW = stageEl.clientWidth; SH = stageEl.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      modelCv.width = SW * dpr; modelCv.height = SH * dpr;
      const ctx = modelCv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      await renderScene(ctx, SW, SH);
      syncOverlay();
    } catch (e) {
      const loading = document.getElementById('stageLoading');
      if (loading) {
        loading.style.display = 'grid';
        loading.innerHTML = `<div>⚠️ Laden mislukt.<br><small>${e.message || e}</small><br>
          <small>Tip: open het prototype via een webserver (bijv. <code>npx serve</code>).</small></div>`;
      }
      console.error(e);
    }
    renderBusy = false;
    if (renderQueued) { renderQueued = false; renderStage(); }
  }

  /* selectie/drag-overlay: onzichtbare rects per onderdeel */
  async function syncOverlay() {
    svgEl.setAttribute('viewBox', `0 0 ${SW} ${SH}`);
    if (!state.manual) { svgEl.innerHTML = ''; return; }
    const v = view();
    let html = '';
    for (const slot of [...DRAW_ORDER].reverse()) {
      const g = garmentById(state.keuze[slot]);
      const R = await garmentRect(g);
      const adj = getAdj(slot);
      const regs = regionsFor(v.id)[slot];
      /* omsluitende box van alle regio's van dit slot */
      let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
      regs.forEach(r => { x0 = Math.min(x0, r.x0); y0 = Math.min(y0, r.y0); x1 = Math.max(x1, r.x1); y1 = Math.max(y1, r.y1); });
      const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
      const sx = (x) => cx + (x - cx) * adj.s + adj.dx;
      const sy = (y) => cy + (y - cy) * adj.s + adj.dy;
      let bx = sx(R.x + x0 * R.w), by = sy(R.y + y0 * R.h);
      const bw = (x1 - x0) * R.w * adj.s, bh = (y1 - y0) * R.h * adj.s;
      if (v.mirror) bx = SW - bx - bw;
      const sel = state.selected === slot;
      html += `
        <g class="part" data-slot="${slot}">
          <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="transparent"
                ${sel ? 'class="sel-outline-on"' : ''}/>
          ${sel ? `
            <rect class="sel-outline" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="8"/>
            <circle class="sel-handle" data-h="scale" cx="${bx + bw}" cy="${by + bh}" r="8"/>
            <text x="${bx + 6}" y="${by - 7}" font-size="11" font-family="Poppins,sans-serif"
                  fill="#086ABD" font-weight="700">${GSLOTS.find(s => s.id === slot).naam}</text>` : ''}
        </g>`;
    }
    svgEl.innerHTML = html;
    svgEl.querySelectorAll('g.part').forEach(gEl => {
      gEl.addEventListener('pointerdown', (e) => startDrag(e, gEl), { once: true });
    });
  }

  function svgPoint(e) {
    const rect = svgEl.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width * SW, y: (e.clientY - rect.top) / rect.height * SH };
  }

  function startDrag(e, gEl) {
    e.preventDefault(); e.stopPropagation();
    const slot = gEl.dataset.slot;
    if (state.selected !== slot) {
      state.selected = slot;
      renderStage(); ui.syncTune();
      return;
    }
    const v = view();
    const mir = v.mirror ? -1 : 1;
    const key = adjKey(slot);
    const a0 = { ...getAdj(slot) };
    const pt0 = svgPoint(e);
    const handle = e.target.dataset && e.target.dataset.h;
    const box = gEl.querySelector('rect').getBBox();
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    const move = (ev) => {
      const pt = svgPoint(ev);
      const adj = { ...a0 };
      if (handle === 'scale') {
        const d0 = Math.hypot(pt0.x - center.x, pt0.y - center.y);
        const d1 = Math.hypot(pt.x - center.x, pt.y - center.y);
        adj.s = Math.min(1.8, Math.max(.55, a0.s * (d1 / Math.max(d0, 1))));
      } else {
        adj.dx = a0.dx + (pt.x - pt0.x) * mir;
        adj.dy = a0.dy + (pt.y - pt0.y);
      }
      state.adj[key] = adj;
      renderStage(); ui.syncTune();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /* ---------- CSS-crop thumbnails (werkt ook onder file://) ---------- */
  function cssCrop(el, src, rect, pad = 0) {
    const apply = () => {
      const w = el.clientWidth || 60;
      const rw = rect.w * (1 + pad * 2);
      const sc = w / rw;
      el.style.backgroundImage = `url("${src}")`;
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundSize = `${SHEET.w * sc}px auto`;
      el.style.backgroundPosition = `${-(rect.x - rect.w * pad) * sc}px ${-(rect.y - rect.h * pad * .3) * sc}px`;
    };
    requestAnimationFrame(apply);
  }

  /* regio-rect (sheet-px) van een onderdeel in het vooraanzicht */
  function regionSheetRect(g, slot) {
    const gc = (CAL.garments[g.id] || cropsFor('garments', g.id, null))[0];
    const r = REGIONS.front[slot][0];
    return { x: gc.x + r.x0 * gc.w, y: gc.y + r.y0 * gc.h, w: (r.x1 - r.x0) * gc.w, h: (r.y1 - r.y0) * gc.h };
  }

  /* ---------- prijs & export ---------- */
  const totaal = () => GSLOTS.reduce((s, sl) => {
    const g = garmentById(state.keuze[sl.id]);
    return s + (g ? g.prijzen[sl.id] : 0);
  }, 0);

  async function downloadPNG() {
    try {
      const scale = 2;
      const W = SW * scale, H = SH * scale, FOOT = 130;
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H + FOOT;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H + FOOT);
      await renderScene(ctx, W, H);
      ctx.fillStyle = '#FFF0FA'; ctx.fillRect(0, H, W, FOOT);
      ctx.fillStyle = '#414040';
      ctx.font = `700 ${15 * scale}px Poppins, sans-serif`;
      ctx.fillText('Haakhuis · Naai Atelier', 24 * scale, H + 56);
      ctx.font = `400 ${10.5 * scale}px "Open Sans", sans-serif`;
      ctx.fillStyle = '#7a6f76';
      ctx.fillText(`Mijn ontwerp — ${state.model.naam} · ${view().label}`, 24 * scale, H + 100);
      ctx.font = `800 ${16 * scale}px Poppins, sans-serif`;
      ctx.fillStyle = '#ED0BF0';
      ctx.textAlign = 'right';
      ctx.fillText(euro(totaal()), W - 24 * scale, H + 80);
      ctx.textAlign = 'left';
      const a = document.createElement('a');
      a.download = `haakhuis-ontwerp-${state.model.id}.png`;
      a.href = cv.toDataURL('image/png');
      a.click();
      /* stage opnieuw tekenen (renderScene zette figRect op exportmaat) */
      renderStage();
    } catch (e) {
      alert('Downloaden lukt alleen als het prototype via een webserver draait (niet via file://).');
      console.warn(e);
      renderStage();
    }
  }

  function setPoseStatus(kind, txt) {
    const el = document.getElementById('poseStatus');
    if (!el) return;
    el.className = 'pose-status ' + (kind === 'ok' ? '' : kind === 'busy' ? 'busy' : 'err');
    el.innerHTML = (kind === 'ok' ? '✓ ' : kind === 'busy' ? '⏳ ' : '⚠ ') + txt;
  }

  /* ---------- UI ---------- */
  const ui = {
    build() {
      /* modellen */
      const mg = document.getElementById('modelGrid');
      mg.innerHTML = MODELS.map(m => `
        <button class="model-card ${m.id === state.model.id ? 'active' : ''}" data-model="${m.id}">
          <div class="thumb" data-thumb="${m.id}"></div>
          <span class="naam">${m.naam}</span><br><span class="leeftijd">${m.sub}</span>
        </button>`).join('');
      mg.addEventListener('click', (e) => {
        const b = e.target.closest('[data-model]');
        if (!b) return;
        state.model = MODELS.find(m => m.id === b.dataset.model);
        mg.querySelectorAll('.model-card').forEach(c => c.classList.toggle('active', c.dataset.model === state.model.id));
        renderStage();
      });
      MODELS.forEach(m => {
        const crop = (CAL.models[m.id] || [])[0];
        const t = mg.querySelector(`[data-thumb="${m.id}"]`);
        if (crop && t) cssCrop(t, m.img, crop);
      });

      /* jassen (presets: alle 4 onderdelen van dezelfde jas) */
      const pr = document.getElementById('presetRow');
      pr.innerHTML = GARMENTS.map(g => `
        <button class="preset-card garment ${state.keuze.midden === g.id ? 'active' : ''}" data-garment="${g.id}">
          <div class="jas-thumb" data-gthumb="${g.id}"></div>
          <span class="nm">${g.naam}</span>
          <span class="sub2">${g.sub}</span>
        </button>`).join('');
      pr.addEventListener('click', (e) => {
        const b = e.target.closest('[data-garment]');
        if (!b) return;
        GSLOTS.forEach(s => { state.keuze[s.id] = b.dataset.garment; });
        pr.querySelectorAll('.preset-card').forEach(c => c.classList.toggle('active', c.dataset.garment === b.dataset.garment));
        ui.buildSlots(); ui.price(); renderStage();
      });
      GARMENTS.forEach(g => {
        const crop = (CAL.garments[g.id] || [])[0];
        const t = pr.querySelector(`[data-gthumb="${g.id}"]`);
        if (crop && t) cssCrop(t, g.img, crop, .08);
      });

      ui.buildSlots(); ui.price();

      /* rotatie */
      const dots = document.getElementById('rotDots');
      dots.innerHTML = VIEWS.map((v, i) => `<button class="rot-dot ${i === 0 ? 'active' : ''}" data-v="${i}" title="${v.label}"></button>`).join('');
      dots.addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]');
        if (b) setView(+b.dataset.v);
      });
      document.getElementById('rotL').addEventListener('click', () => setView((state.viewIdx + VIEWS.length - 1) % VIEWS.length));
      document.getElementById('rotR').addEventListener('click', () => setView((state.viewIdx + 1) % VIEWS.length));
      window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') setView((state.viewIdx + VIEWS.length - 1) % VIEWS.length);
        if (e.key === 'ArrowRight') setView((state.viewIdx + 1) % VIEWS.length);
      });

      document.getElementById('btnDownload').addEventListener('click', downloadPNG);
      const reset = document.getElementById('btnReset');
      if (reset) reset.addEventListener('click', () => {
        state.adj = {}; state.selected = null;
        renderStage(); ui.syncTune();
      });

      svgEl.addEventListener('pointerdown', (e) => {
        if (state.manual && !e.target.closest('g.part')) {
          state.selected = null; renderStage(); ui.syncTune();
        }
      });

      window.addEventListener('resize', () => renderStage());
    },

    buildSlots() {
      const holder = document.getElementById('slotList');
      holder.innerHTML = GSLOTS.map(slot => {
        const cur = garmentById(state.keuze[slot.id]);
        return `
          <div class="slot" data-slot="${slot.id}">
            <div class="slot-head">
              <span class="slot-naam">${slot.naam}</span>
              <span class="slot-sub">${cur.naam}</span>
              <span class="slot-prijs">${euro(cur.prijzen[slot.id])}</span>
            </div>
            <div class="opt-row">
              ${GARMENTS.map(g => `
                <button class="opt-chip ${state.keuze[slot.id] === g.id ? 'active' : ''}"
                        data-part-slot="${slot.id}" data-part-g="${g.id}" title="${g.naam} — ${euro(g.prijzen[slot.id])}">
                  <span class="chip-img" data-chip="${slot.id}:${g.id}"></span>
                </button>`).join('')}
              <span class="kleur-group">
                ${KLEUREN.map((kl, i) => `
                  <button class="swatch kleur ${(state.kleur[slot.id] || 0) === i ? 'active' : ''}"
                          data-kleur-slot="${slot.id}" data-kleur="${i}" title="${kl.naam}">
                    <span class="chip-img" data-chipk="${slot.id}:${i}" style="filter:${kl.filter || 'none'}"></span>
                  </button>`).join('')}
              </span>
            </div>
          </div>`;
      }).join('');

      /* thumbnails van de échte foto-regio's */
      GSLOTS.forEach(slot => {
        GARMENTS.forEach(g => {
          const el = holder.querySelector(`[data-chip="${slot.id}:${g.id}"]`);
          if (el && CAL.garments[g.id]) cssCrop(el, g.img, regionSheetRect(g, slot.id));
        });
        const cur = garmentById(state.keuze[slot.id]);
        KLEUREN.forEach((kl, i) => {
          const el = holder.querySelector(`[data-chipk="${slot.id}:${i}"]`);
          if (el && CAL.garments[cur.id]) cssCrop(el, cur.img, regionSheetRect(cur, slot.id));
        });
      });

      holder.onclick = (e) => {
        const kb = e.target.closest('[data-kleur-slot]');
        if (kb) {
          state.kleur[kb.dataset.kleurSlot] = +kb.dataset.kleur;
          ui.buildSlots(); renderStage();
          return;
        }
        const b = e.target.closest('[data-part-slot]');
        if (!b) return;
        state.keuze[b.dataset.partSlot] = b.dataset.partG;
        state.selected = state.manual ? b.dataset.partSlot : null;
        document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
        ui.buildSlots(); ui.price(); renderStage(); ui.syncTune();
      };
    },

    price() {
      const lines = document.getElementById('priceLines');
      lines.innerHTML = GSLOTS.map(s => {
        const g = garmentById(state.keuze[s.id]);
        return `<div><span>${s.naam} — ${g.naam}</span><span>${euro(g.prijzen[s.id])}</span></div>`;
      }).join('');
      document.getElementById('priceTotal').innerHTML = `${euro(totaal())} <small>indicatie</small>`;
    },

    syncTune() {
      const box = document.getElementById('tuneBox');
      if (!box) return;
      const slot = state.selected;
      box.style.opacity = slot ? 1 : .5;
      const nm = box.querySelector('.tune-part');
      if (nm) nm.textContent = slot ? GSLOTS.find(s => s.id === slot).naam : 'klik op een onderdeel op het model';
      const inp = box.querySelector('[data-t="s"]');
      if (inp && slot) inp.value = getAdj(slot).s;
    },
  };

  function setView(i) {
    state.viewIdx = i;
    document.querySelectorAll('.rot-dot').forEach((d, k) => d.classList.toggle('active', k === i));
    document.getElementById('rotLabel').textContent = VIEWS[i].label;
    renderStage();
  }

  function bindTune() {
    const box = document.getElementById('tuneBox');
    if (!box) return;
    box.querySelectorAll('input[type=range]').forEach(inp => {
      inp.addEventListener('input', () => {
        if (!state.selected) return;
        const adj = { ...getAdj(state.selected) };
        if (inp.dataset.t === 's') adj.s = +inp.value;
        state.adj[adjKey(state.selected)] = adj;
        renderStage();
      });
    });
  }

  /* ---------- init ---------- */
  async function init(opts = {}) {
    state.manual = !!opts.manual;
    state.pose = !!opts.pose;
    stageEl = document.getElementById('stage');
    modelCv = document.getElementById('modelLayer');
    svgEl = document.getElementById('garmentLayer');
    hintEl = document.getElementById('stageHint');

    ui.build(); bindTune();
    document.getElementById('rotLabel').textContent = VIEWS[0].label;

    const loading = document.getElementById('stageLoading');
    try {
      await renderStage();
      loading.style.display = 'none';
      if (hintEl) {
        hintEl.classList.add('show');
        setTimeout(() => hintEl.classList.remove('show'), 4500);
      }
    } catch (e) {
      loading.innerHTML = `<div>⚠️ Laden mislukt.<br><small>${e.message || e}</small></div>`;
      console.error(e);
    }
  }

  return { init, state, renderStage, renderGarments: renderStage, setView,
           invalidatePose: () => poseCache.clear(),
           _segment: segment, _loadImage: loadImage };
})();
