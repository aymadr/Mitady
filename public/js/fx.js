// Interaction polish: cursor glow, card spotlight, 3D tilt, magnetic buttons, click ripple,
// words rising in titles, content revealed on scroll, page transitions.
// Everything is delegated or idempotent, so it works on whatever the views render.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

const SPOT = '.group, .card, .stats, .pipeline, .ob-result, .ob-drop, .dropzone, .tpl, .ob-choice';
const TILT = '.ob-choice, .tpl';
const MAGNET = '.btn-primary, .ob-cta, .theme-toggle';
const RIPPLE = '.btn, .ob-cta, .chip, .ob-choice';
const SPLIT = '.page-title, .ob-title, .ob-mega';
const REVEAL = 'main .section, main > .pipeline, main > .stats, main > .card, .sheet-body > section, .sheet-body > .card';

function cursorGlow() {
  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  document.body.append(glow);
  let x = innerWidth / 2;
  let y = innerHeight / 3;
  let tx = x;
  let ty = y;
  addEventListener('pointermove', (e) => {
    tx = e.clientX;
    ty = e.clientY;
    glow.style.opacity = 1;
  }, { passive: true });
  document.addEventListener('pointerleave', () => (glow.style.opacity = 0));
  (function loop() {
    x += (tx - x) * 0.12;
    y += (ty - y) * 0.12;
    glow.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    requestAnimationFrame(loop);
  })();
}

function pointer() {
  addEventListener('pointermove', (e) => {
    const spot = e.target.closest?.(SPOT);
    if (spot) {
      const r = spot.getBoundingClientRect();
      spot.style.setProperty('--mx', `${e.clientX - r.left}px`);
      spot.style.setProperty('--my', `${e.clientY - r.top}px`);
    }
    const tilt = e.target.closest?.(TILT);
    if (tilt) {
      const r = tilt.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      tilt.classList.add('tilting');
      tilt.style.setProperty('--ry', `${(px * 12).toFixed(2)}deg`);
      tilt.style.setProperty('--rx', `${(-py * 12).toFixed(2)}deg`);
    }
    document.querySelectorAll('.tilting').forEach((el) => {
      if (el !== tilt) {
        el.classList.remove('tilting');
        el.style.removeProperty('--rx');
        el.style.removeProperty('--ry');
      }
    });
    // Magnetic buttons pull toward the cursor within a small radius.
    document.querySelectorAll(MAGNET).forEach((b) => {
      const r = b.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const near = Math.hypot(dx, dy) < Math.max(r.width, r.height) * 0.9 + 24;
      b.style.setProperty('--magx', near ? `${(dx * 0.22).toFixed(1)}px` : '0px');
      b.style.setProperty('--magy', near ? `${(dy * 0.3).toFixed(1)}px` : '0px');
    });
  }, { passive: true });
}

function ripple() {
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest?.(RIPPLE);
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    const d = Math.max(r.width, r.height) * 2;
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    el.append(span);
    span.addEventListener('animationend', () => span.remove());
  });
}

// Splits text into words that slide up from a mask, one after the other.
function splitTitles() {
  document.querySelectorAll(SPLIT).forEach((title) => {
    if (title.dataset.split) return;
    title.dataset.split = '1';
    let n = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          if (!child.textContent.trim()) return;
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) return frag.append(part);
            const w = document.createElement('span');
            w.className = 'w';
            const i = document.createElement('i');
            i.textContent = part;
            i.style.setProperty('--n', n++);
            w.append(i);
            frag.append(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          // Gradient text cannot be split (clipped backgrounds), so it rises as a whole.
          if (child.matches('.grad, em')) {
            child.classList.add('w-whole');
            child.style.setProperty('--n', n++);
          } else if (!child.matches('.ob-words, br')) walk(child);
        }
      });
    };
    walk(title);
  });
}

let io = null;
function reveal() {
  io ||= new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      }),
    { threshold: 0.08, rootMargin: '0px 0px -6% 0px' },
  );
  document.querySelectorAll(`${REVEAL}`).forEach((el) => {
    if (el.dataset.reveal) return;
    el.dataset.reveal = '1';
    // Only what starts below the fold waits for the scroll.
    if (el.getBoundingClientRect().top < innerHeight * 0.92) return;
    el.classList.add('reveal');
    io.observe(el);
  });
}

export function initFx() {
  if (reduced) return;
  let queued = false;
  const scan = () => {
    queued = false;
    splitTitles();
    reveal();
  };
  new MutationObserver(() => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(scan);
    }
  }).observe(document.body, { childList: true, subtree: true });
  ripple();
  if (fine) {
    cursorGlow();
    pointer();
  }
  scan();
}
