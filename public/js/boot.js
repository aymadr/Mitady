// Entry point: logo, theme and effects first, then the app.
import { logo } from './brand.js';
import { initTheme, toggleHtml } from './theme.js';
import { initFx } from './fx.js';
import { initPetPlay } from './pet.js';
import { forestHtml } from './scenery.js';

document.getElementById('brand-logo').innerHTML = logo(32).toString();
document.getElementById('theme-slot').innerHTML = toggleHtml;
initTheme();
initFx();
initPetPlay();
document.getElementById('forest').innerHTML = forestHtml();
await import('./main.js');
