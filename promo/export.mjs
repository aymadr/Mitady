// Renders promo/mitady-promo.html to an MP4, frame by frame (the page is a pure function of time, so it is exact).
// Needs: playwright + a Chromium (CHROMIUM_PATH), ffmpeg on the PATH.
// Run: node promo/export.mjs [--width 1280] [--fps 30] [--out promo/mitady-promo.mp4] [--workers 4] [--from 0] [--to 72] [--no-audio]
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const width = Number(arg('width', 1280)), height = Math.round((width * 9) / 16);
const fps = Number(arg('fps', 30)), workers = Number(arg('workers', Math.max(1, Math.min(4, os.cpus().length))));
const out = path.resolve(arg('out', path.join(here, 'mitady-promo.mp4')));
const page = 'file://' + path.join(here, 'mitady-promo.html') + '?export';
const exe = process.env.CHROMIUM_PATH || undefined;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mitady-frames-'));

const probe = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const pp = await probe.newPage();
await pp.goto(page);
const total = await pp.evaluate(() => window.DURATION());
await probe.close();
const from = Number(arg('from', 0)), to = Math.min(Number(arg('to', total)), total);
const frames = Math.floor((to - from) * fps);
console.log(`${frames} frames, ${width}x${height}, ${fps} fps, ${workers} workers`);

async function work(w) {
  const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--font-render-hinting=none'] });
  const p = await b.newPage({ viewport: { width, height } });
  await p.goto(page);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction(() => [...document.querySelectorAll('iframe')].every((f) => f.contentDocument && f.contentDocument.readyState === 'complete'));
  await p.waitForFunction(() => [...document.images].every((i) => i.complete));
  for (let i = w; i < frames; i += workers) {
    await p.evaluate((ms) => window.seek(ms), (from + i / fps) * 1000);
    await p.screenshot({ path: path.join(tmp, `f_${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
    if (w === 0 && i % 120 === 0) console.log(`  ${Math.round((i / frames) * 100)} %`);
  }
  await b.close();
}
await Promise.all(Array.from({ length: workers }, (_, w) => work(w)));

// the soundtrack (promo/make-audio.mjs) is added when it exists; pass --no-audio for a silent video
const theme = path.join(here, 'assets', 'theme.mp3');
const withAudio = fs.existsSync(theme) && !process.argv.includes('--no-audio');
const r = spawnSync('ffmpeg', [
  '-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(tmp, 'f_%05d.jpg'),
  ...(withAudio ? ['-ss', String(from), '-t', String(frames / fps), '-i', theme, '-c:a', 'aac', '-b:a', '192k', '-af', `afade=t=out:st=${Math.max(0, frames / fps - 0.05)}:d=0.05`] : []),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-shortest', out,
], { stdio: 'inherit' });
fs.rmSync(tmp, { recursive: true, force: true });
if (r.status !== 0) process.exit(r.status || 1);
console.log('→', out, (fs.statSync(out).size / 1024 / 1024).toFixed(1) + ' Mo');
