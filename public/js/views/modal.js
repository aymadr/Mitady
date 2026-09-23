import { mount } from '../lib.js';

// Single modal at a time. Clicking the backdrop or a [data-close] element closes it.
export function openModal(tpl) {
  const root = document.getElementById('modal-root');
  mount(root, `<div class="modal"><div class="scrim open" data-close></div><div class="modal-card" role="dialog" aria-modal="true">${tpl}</div></div>`);
  const card = root.querySelector('.modal-card');
  root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeModal));
  card.querySelector('input, textarea, select')?.focus();
  return card;
}

export function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.querySelector('.modal')) closeModal();
});
