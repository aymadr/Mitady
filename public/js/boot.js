// Entry point: puts the logo in place, then starts the app.
import { logo } from './brand.js';

document.getElementById('brand-logo').innerHTML = logo(32).toString();
await import('./main.js');
