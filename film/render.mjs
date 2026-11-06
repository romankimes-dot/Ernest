// Rendu du court-métrage image par image puis encodage MP4 (H.264, 9:16).
// node film/render.mjs [--w 1080] [--from 0] [--to N] [--every 1] [--out film/out/ernest-star.mp4] [--stills]
// --stills : n'encode pas, garde seulement les images (aperçus).
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] ?? true); };
const w = +arg('w', 1080), every = +arg('every', 1), stills = process.argv.includes('--stills');
const outFile = resolve(root, arg('out', 'film/out/ernest-star.mp4'));
const frames = resolve(root, 'film/out/frames');
rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });

const port = 8000 + Math.floor(Math.random() * 900);
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto(`http://127.0.0.1:${port}/film/ernest-star.html?render&w=${w}`);
  await page.waitForFunction(() => window.FILM, null, { timeout: 120000 });
  const N = await page.evaluate(() => FILM.N);
  const from = +arg('from', 0), to = Math.min(+arg('to', N), N);
  const t0 = Date.now(); let k = 0;
  for (let i = from; i < to; i += every) {
    const url = await page.evaluate((i) => FILM.frame(i), i);
    writeFileSync(`${frames}/${String(stills ? i : k).padStart(4, '0')}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
    k++;
    if (k % 10 === 0) process.stdout.write(`\r${i + 1}/${to}  ${((Date.now() - t0) / k / 1000).toFixed(2)} s/image`);
  }
  console.log(`\n${k} images en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (!stills) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', `${frames}/%04d.jpg`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outFile], { stdio: 'inherit' });
    console.log('→', outFile);
  }
} finally { await browser.close(); srv.kill(); }
