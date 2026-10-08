// Photo editor (drag, zoom, rotate, shape, size, border, black & white) with a live CV preview.
// openPhotoEditor({ file, style, crop }) resolves to { blob, original, crop, style } or null if cancelled.
import { S } from '../main.js';
import { html, api, fail, esc } from '../lib.js';

const SHAPES = [['rond', 'Ronde'], ['carre', 'Carrée'], ['arrondi', 'Arrondie'], ['portrait', 'Portrait'], ['portraitArrondi', 'Portrait arrondi']];
const SIZES = [['xs', 'XS'], ['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']];
const VIEW_W = 280;
const EXPORT_W = 600;

const loadImage = (src) =>
  new Promise((ok, ko) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => ko(new Error('Image illisible.'));
    im.src = src;
  });

const blobToDataUrl = (blob) =>
  new Promise((ok) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.readAsDataURL(blob);
  });

export async function openPhotoEditor({ file = null, style = {}, crop = null } = {}) {
  let img;
  let url;
  try {
    if (file) url = URL.createObjectURL(file);
    else {
      const res = await fetch('/api/profile/photo?original=1&v=' + Date.now());
      if (!res.ok) throw new Error('Aucune photo.');
      url = URL.createObjectURL(await res.blob());
    }
    img = await loadImage(url);
  } catch (e) {
    fail(e);
    return null;
  }

  const st = { zoom: 1, ox: 0, oy: 0, rot: 0, gray: false, ...(file ? {} : crop || {}) };
  const look = { photoShape: style.photoShape || 'portrait', photoSize: style.photoSize || 'm', photoBorder: !!style.photoBorder };

  const root = document.createElement('div');
  root.className = 'pe-overlay';
  const chips = (key, list) => list.map(([v, l]) => `<button type="button" class="" data-k="${key}" data-v="${v}">${esc(l)}</button>`).join('');
  root.innerHTML = html`<div class="pe" role="dialog" aria-modal="true" aria-label="Modifier la photo">
    <div class="pe-main">
      <h3>Ta photo</h3>
      <div class="pe-stage"><canvas id="pe-canvas"></canvas></div>
      <p class="hint">Glisse pour cadrer, molette ou curseur pour zoomer.</p>
      <label class="pe-row"><span>Zoom</span><input type="range" id="pe-zoom" min="1" max="4" step="0.01" value="${st.zoom}"></label>
      <div class="pe-row"><button type="button" class="btn btn-plain small" id="pe-rot">⟳ Pivoter</button>
        <label class="row small"><input type="checkbox" id="pe-gray"> Noir et blanc</label>
        <label class="row small"><input type="checkbox" id="pe-border"> Cadre</label></div>
      <div class="pe-row"><span>Forme</span><div class="segmented" data-g="photoShape"></div></div>
      <div class="pe-row"><span>Taille</span><div class="segmented" data-g="photoSize"></div></div>
    </div>
    <div class="pe-side"><span class="label">Aperçu sur ton CV</span>
      <div class="preview"><div class="preview-page"><iframe id="pe-preview" title="Aperçu" sandbox="allow-same-origin"></iframe></div></div></div>
    <div class="pe-actions"><button type="button" class="btn btn-plain" id="pe-cancel">Annuler</button><button type="button" class="btn btn-primary" id="pe-save">Enregistrer</button></div>
  </div>`.toString();
  document.body.appendChild(root);
  root.querySelector('[data-g=photoShape]').innerHTML = chips('photoShape', SHAPES);
  root.querySelector('[data-g=photoSize]').innerHTML = chips('photoSize', SIZES);

  const canvas = root.querySelector('#pe-canvas');
  const ctx = canvas.getContext('2d');
  const q = (s) => root.querySelector(s);
  const ratio = () => (['rond', 'carre', 'arrondi'].includes(look.photoShape) ? 1 : 1.28);

  // Draws the picture on a canvas of the given width. Offsets are fractions of the frame.
  function draw(c, w) {
    const h = Math.round(w * ratio());
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const swap = st.rot % 2 === 1;
    const rw = swap ? img.naturalHeight : img.naturalWidth;
    const rh = swap ? img.naturalWidth : img.naturalHeight;
    const s = Math.max(w / rw, h / rh) * st.zoom;
    const mx = Math.max(0, (rw * s - w) / 2 / w);
    const my = Math.max(0, (rh * s - h) / 2 / h);
    st.ox = Math.min(mx, Math.max(-mx, st.ox));
    st.oy = Math.min(my, Math.max(-my, st.oy));
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.filter = st.gray ? 'grayscale(1) contrast(1.05)' : 'none';
    g.translate(w / 2 + st.ox * w, h / 2 + st.oy * h);
    g.rotate((st.rot * Math.PI) / 2);
    g.scale(s, s);
    g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  }

  const frame = () => {
    draw(canvas, VIEW_W);
    canvas.style.borderRadius = look.photoShape === 'rond' ? '50%' : look.photoShape.endsWith('rrondi') ? '16px' : '2px';
    canvas.style.outline = look.photoBorder ? '2px solid #1f3a93' : 'none';
  };

  let previewTimer;
  const preview = () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      try {
        const tmp = document.createElement('canvas');
        draw(tmp, 300);
        const doc = await api('/profile/cv-preview', { method: 'POST', body: { cvStyle: { ...S.profile.cvStyle, ...look, photo: true }, photoData: tmp.toDataURL('image/jpeg', 0.85) } });
        const f = q('#pe-preview');
        if (f) f.srcdoc = doc;
      } catch {}
    }, 350);
  };

  const sync = () => {
    root.querySelectorAll('button[data-k]').forEach((b) => b.setAttribute('aria-pressed', String(look[b.dataset.k] === b.dataset.v)));
    q('#pe-gray').checked = st.gray;
    q('#pe-border').checked = look.photoBorder;
    q('#pe-zoom').value = st.zoom;
    frame();
    preview();
  };

  const page = q('.preview-page');
  const prev = q('#pe-preview');
  new ResizeObserver(() => (prev.style.transform = `scale(${page.clientWidth / 794})`)).observe(page);

  // Drag to move.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, ox: st.ox, oy: st.oy };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = canvas.getBoundingClientRect();
    st.ox = drag.ox + (e.clientX - drag.x) / r.width;
    st.oy = drag.oy + (e.clientY - drag.y) / r.height;
    frame();
    preview();
  });
  const end = () => (drag = null);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    st.zoom = Math.min(4, Math.max(1, st.zoom - e.deltaY * 0.002));
    sync();
  }, { passive: false });

  q('#pe-zoom').addEventListener('input', (e) => { st.zoom = +e.target.value; frame(); preview(); });
  q('#pe-rot').addEventListener('click', () => { st.rot = (st.rot + 1) % 4; st.ox = st.oy = 0; sync(); });
  q('#pe-gray').addEventListener('change', (e) => { st.gray = e.target.checked; sync(); });
  q('#pe-border').addEventListener('change', (e) => { look.photoBorder = e.target.checked; sync(); });
  root.querySelectorAll('button[data-k]').forEach((b) => b.addEventListener('click', () => { look[b.dataset.k] = b.dataset.v; sync(); }));

  sync();

  return new Promise((resolve) => {
    const close = (v) => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(previewTimer);
      URL.revokeObjectURL(url);
      root.remove();
      resolve(v);
    };
    const onKey = (e) => e.key === 'Escape' && close(null);
    document.addEventListener('keydown', onKey);
    root.addEventListener('pointerdown', (e) => e.target === root && close(null));
    q('#pe-cancel').addEventListener('click', () => close(null));
    q('#pe-save').addEventListener('click', async () => {
      const out = document.createElement('canvas');
      draw(out, EXPORT_W);
      const blob = await new Promise((ok) => out.toBlob(ok, 'image/jpeg', 0.92));
      close({ blob, original: file, crop: { zoom: st.zoom, ox: st.ox, oy: st.oy, rot: st.rot, gray: st.gray }, style: { ...look } });
    });
  });
}

export { blobToDataUrl };
