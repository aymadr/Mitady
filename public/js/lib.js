// Small helpers: safe HTML templating, API calls, toasts, formatting.

class Raw {
  constructor(v) {
    this.v = v;
  }
  toString() {
    return this.v;
  }
}

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const raw = (v) => new Raw(v);

function fmt(v) {
  if (v instanceof Raw) return v.v;
  if (Array.isArray(v)) return v.map(fmt).join('');
  if (v === null || v === undefined || v === false) return '';
  return esc(v);
}

// Tagged template: interpolated values are escaped unless wrapped in raw() / html``.
export function html(strings, ...vals) {
  return raw(strings.reduce((acc, s, i) => acc + s + (i < vals.length ? fmt(vals[i]) : ''), ''));
}

export function mount(el, tpl) {
  el.innerHTML = tpl.toString();
  return el;
}

// During the guided demo, `hooks.demo` answers API calls from sample data, so nothing real is touched.
export const hooks = { demo: null, fakeSearch: null };

export async function api(path, { method = 'GET', body } = {}) {
  if (hooks.demo) {
    const r = await hooks.demo(path, { method, body });
    if (r !== undefined) return r;
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
  return data;
}

let toastTimer;
export function toast(message, { error = false } = {}) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), error ? 5000 : 2800);
}

export const fail = (e) => toast(e.message || String(e), { error: true });

export function debounce(fn, ms = 500) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Runs an async action while showing a spinner in the button.
export async function busy(button, fn) {
  const label = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span class="spinner"></span>${button.dataset.busy ? `<span>${esc(button.dataset.busy)}</span>` : ''}`;
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.innerHTML = label;
  }
}

export function relDate(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function longDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function scoreClass(score) {
  if (score === null || score === undefined) return 'none';
  if (score >= 70) return 'high';
  if (score >= 45) return 'mid';
  return 'low';
}

export const scoreText = (score) => (score === null || score === undefined ? '—' : `${score} %`);

// Company monogram with a hue derived from the name.
export function avatar(name = '', size = '') {
  const label = String(name).trim();
  const initials = label.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  const h = [...label].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  return raw(`<span class="avatar ${size}" style="--h:${h}" aria-hidden="true">${esc(initials)}</span>`);
}

// Circular match score.
export function miniRing(score) {
  const cls = scoreClass(score);
  return raw(`<span class="mini-ring ${cls}" style="--p:${score ?? 0}" title="Correspondance avec ton profil"><b>${score === null || score === undefined ? '—' : score}</b></span>`);
}

export const STATUS = {
  todo: 'À traiter',
  applied: 'Envoyée',
  interview: 'Entretien',
  offer: 'Offre reçue',
  rejected: 'Refusée',
  archived: 'Écartée',
};

export const icons = {
  chevron: raw('<svg class="chevron" width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m1 1 6 6-6 6"/></svg>'),
  close: raw('<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m2 2 10 10M12 2 2 12"/></svg>'),
  x: raw('<svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m1 1 6 6M7 1 1 7"/></svg>'),
  search: raw('<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="7" cy="7" r="5"/><path d="m11 11 3.5 3.5"/></svg>'),
  external: raw('<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 1.5h5v5M8.5 1.5l-7 7"/></svg>'),
  check: raw('<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 6.5 2.5 2.5L10 3"/></svg>'),
  plus: raw('<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 1v8M1 5h8"/></svg>'),
};

// Editable list of chips. Returns nothing; calls onChange(newValues).
export function chipInput(container, values, onChange, { placeholder = 'Ajouter…' } = {}) {
  const render = () => {
    mount(
      container,
      html`<div class="chip-input">
        ${values.map((v, i) => html`<span class="chip">${v}<button class="x" data-i="${i}" aria-label="Retirer ${v}">${icons.x}</button></span>`)}
        <input placeholder="${placeholder}" aria-label="${placeholder}">
      </div>`,
    );
    const input = container.querySelector('input');
    input.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
        e.preventDefault();
        const parts = input.value.split(',').map((s) => s.trim()).filter(Boolean);
        const fresh = parts.filter((p) => !values.some((v) => norm(v) === norm(p)));
        values = [...values, ...fresh];
        onChange(values);
        render();
        container.querySelector('input').focus();
      } else if (e.key === 'Backspace' && !input.value && values.length) {
        values = values.slice(0, -1);
        onChange(values);
        render();
        container.querySelector('input').focus();
      }
    });
    container.querySelectorAll('.x').forEach((b) =>
      b.addEventListener('click', () => {
        values = values.filter((_, i) => i !== Number(b.dataset.i));
        onChange(values);
        render();
      }),
    );
  };
  render();
  return {
    set(next) {
      values = next;
      render();
    },
  };
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
