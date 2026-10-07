// Celebrations and small progress cards, performed by the user's pixel companion (pet.js).
import { celebrate } from './fx.js';
import { petSvg, petOf } from './pet.js';
import { S } from './main.js';

const mine = () => petOf(S.profile);

// A creature pops in at a point, jumps for joy, and goes away. Optionally with a message.
export function popCreature({ x = innerWidth / 2, y = innerHeight * 0.55, mood = 'party', size = 120, text = '', confetti = true } = {}) {
  const el = document.createElement('div');
  el.className = 'pop-mon';
  el.style.cssText = `left:${x}px;top:${y}px`;
  el.innerHTML = `${petSvg(mine(), { size, mood })}${text ? `<span class="pop-text">${text}</span>` : ''}`;
  document.body.append(el);
  if (confetti) celebrate({ x, y: y - size * 0.6, count: 70 });
  setTimeout(() => el.classList.add('bye'), text ? 2600 : 1700);
  setTimeout(() => el.remove(), text ? 3100 : 2200);
}

// A small working card for slow actions: "Je prépare ton CV…". Returns { done(msg), fail(msg) }.
export function working({ text = 'Je m’en occupe…', mood = 'write' } = {}) {
  const el = document.createElement('div');
  el.className = 'working';
  el.innerHTML = `${petSvg(mine(), { size: 64, mood: mood === 'think' ? 'think' : 'busy' })}<div><b>${text}</b><span class="dots"><i></i><i></i><i></i></span></div>`;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('open'));
  const close = (delay) => {
    setTimeout(() => el.classList.remove('open'), delay);
    setTimeout(() => el.remove(), delay + 500);
  };
  return {
    done(msg = 'C’est prêt !') {
      el.querySelector('.pet').className = 'pet party';
      el.querySelector('b').textContent = msg;
      el.querySelector('.dots').remove();
      const r = el.getBoundingClientRect();
      celebrate({ x: r.left + 40, y: r.top, count: 50 });
      close(1500);
    },
    fail(msg = 'Oups.') {
      el.querySelector('.pet').className = 'pet think';
      el.querySelector('b').textContent = msg;
      el.querySelector('.dots')?.remove();
      close(2600);
    },
  };
}

// Milestones: the first application, then 5, 10, 25… get a little party.
const MILESTONES = { 1: 'Première candidature envoyée !', 5: '5 candidatures : tu es lancé !', 10: '10 candidatures, bravo !', 25: '25 candidatures : quelle énergie !', 50: '50 candidatures ! Impressionnant.' };
export function milestone(sentCount, at) {
  const text = MILESTONES[sentCount];
  if (text) popCreature({ ...at, text, size: 140 });
  return Boolean(text);
}

// Shared by the board and the offer sheet: what to celebrate when an application changes status.
const SENT_STATUSES = ['applied', 'interview', 'offer', 'rejected'];
export function cheerStatus(target, { wasSent, sent, at }) {
  if (target === 'offer') return popCreature({ ...at, text: 'Une offre ! Félicitations !', size: 150 });
  if (target === 'interview') return popCreature({ ...at, text: 'Entretien décroché !', size: 130 });
  if (target === 'applied' && !wasSent && !milestone(sent, at)) celebrate({ ...at, count: 60 });
}
export const isSent = (status) => SENT_STATUSES.includes(status);
