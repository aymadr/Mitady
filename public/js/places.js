// "Où cherches-tu ?": up to three places (a city, a postal code, a département, a région), with suggestions while
// typing, and how far around them to look. Used by the profile and by the first-run guide.
import { html, raw, mount, api, debounce, icons } from './lib.js';

const RADII = [[10, '10 km'], [20, '20 km'], [30, '30 km'], [50, '50 km'], [100, '100 km'], [0, 'Toute la France']];
const KIND = { commune: 'ville', departement: 'département', region: 'région', libre: 'texte libre' };
const pin = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.500C5 14.800 12 21 12 21Z"/><circle cx="12" cy="9.500" r="2.500"/></svg>';

export function placePicker(container, { places = [], radius = 30, max = 3, onChange }) {
  let list = places.map((p) => ({ ...p }));
  let r = radius;
  let found = [];
  let active = -1;

  const emit = () => onChange({ places: list, radius: r });
  const names = () => list.map((p) => p.name).join(', ');
  const hint = () => {
    if (!list.length) return 'Sans lieu, la recherche porte sur toute la France.';
    const loose = list.filter((p) => p.kind === 'libre');
    const base = r ? `Jusqu'à ${r} km autour de ${names()} : les offres plus éloignées sont écartées, sauf celles en télétravail complet.` : `Toute la France, en commençant par ${names()}.`;
    return loose.length ? `${base} « ${loose.map((p) => p.name).join(', ')} » n'est pas reconnu : les sites sont interrogés avec ce texte, mais la distance ne peut pas être calculée.` : base;
  };

  function draw() {
    mount(
      container,
      html`<div class="pp">
        <div class="pp-field">
          <div class="chip-input pp-box">
            ${list.map((p, i) => html`<span class="chip place" title="${KIND[p.kind] || ''}"><span class="pin">${raw(pin)}</span>${p.label || p.name}<button type="button" class="x" data-i="${i}" aria-label="Retirer ${p.name}">${icons.x}</button></span>`)}
            ${list.length < max ? html`<input class="pp-input" role="combobox" aria-expanded="false" aria-autocomplete="list" placeholder="${list.length ? 'Ajouter une autre ville' : 'Ville, code postal, département ou région'}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">` : ''}
          </div>
          <ul class="pp-menu" role="listbox" hidden></ul>
        </div>
        <div class="pp-radius ${list.length ? '' : 'off'}"><span class="label">Périmètre</span>
          <div class="segmented" role="group" aria-label="Rayon autour du lieu">${RADII.map(([v, l]) => html`<button type="button" data-r="${v}" aria-pressed="${r === v}">${l}</button>`)}</div>
        </div>
        <p class="hint pp-hint">${hint()}</p>
      </div>`,
    );
    const input = container.querySelector('.pp-input');
    const menu = container.querySelector('.pp-menu');

    const showMenu = () => {
      const taken = new Set(list.map((p) => p.label));
      const shown = found.filter((p) => !taken.has(p.label));
      active = shown.length ? Math.min(Math.max(active, 0), shown.length - 1) : -1;
      menu.innerHTML = shown.map((p, i) => `<li role="option" data-i="${i}" aria-selected="${i === active}"><span>${p.label}</span><small>${KIND[p.kind]}</small></li>`).join('');
      menu.hidden = !shown.length;
      input?.setAttribute('aria-expanded', String(!menu.hidden));
      menu.dataset.shown = JSON.stringify(shown);
    };
    const shownList = () => JSON.parse(menu.dataset.shown || '[]');
    const add = (p) => {
      if (!p || list.length >= max || list.some((x) => x.label === p.label)) return;
      list.push(p);
      found = [];
      active = -1;
      emit();
      draw();
      container.querySelector('.pp-input')?.focus();
    };

    const lookup = debounce(async (q) => {
      try {
        found = (await api(`/places?q=${encodeURIComponent(q)}`)).places;
      } catch {
        found = [];
      }
      active = 0;
      showMenu();
    }, 180);

    input?.addEventListener('input', () => {
      const q = input.value.trim();
      if (q.length < 2 && !/^\d{2}$/.test(q)) { found = []; return showMenu(); }
      lookup(q);
    });
    input?.addEventListener('keydown', (e) => {
      const shown = shownList();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!shown.length) return;
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
        showMenu();
      } else if (e.key === 'Enter' || e.key === ',') {
        const text = input.value.trim();
        if (!text && !shown.length) return;
        e.preventDefault();
        if (shown[active] && !menu.hidden) add(shown[active]);
        else if (text) add({ name: text, label: text, kind: 'libre', lat: null, lon: null, slack: 0 }); // the server places it if it can
      } else if (e.key === 'Escape') {
        found = [];
        showMenu();
      } else if (e.key === 'Backspace' && !input.value && list.length) {
        list.pop();
        emit();
        draw();
        container.querySelector('.pp-input')?.focus();
      }
    });
    input?.addEventListener('blur', () => setTimeout(() => { menu.hidden = true; }, 150));
    menu.addEventListener('pointerdown', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      e.preventDefault(); // keeps the focus in the field, so the keyboard stays open on a phone
      add(shownList()[Number(li.dataset.i)]);
    });
    container.querySelectorAll('.chip.place .x').forEach((b) =>
      b.addEventListener('click', () => {
        list.splice(Number(b.dataset.i), 1);
        emit();
        draw();
      }),
    );
    container.querySelectorAll('[data-r]').forEach((b) =>
      b.addEventListener('click', () => {
        r = Number(b.dataset.r);
        container.querySelectorAll('[data-r]').forEach((x) => x.setAttribute('aria-pressed', x === b));
        container.querySelector('.pp-hint').textContent = hint();
        emit();
      }),
    );
  }
  draw();
  return { get: () => ({ places: list, radius: r }) };
}
