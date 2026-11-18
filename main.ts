// Night Run: Port Solano - Packager Script
// Copies game/ and screenshots/ to output directory, performs packaging validation,
// builds dossier.json, and prints a clean summary line.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Packaging self-check
const indexPath = join(here, 'game', 'index.html');
if (!existsSync(indexPath)) {
  throw new Error('Packaging failed: game/index.html is missing.');
}

const screenshotsDir = join(here, 'screenshots');
const screenshots = existsSync(screenshotsDir) ? readdirNames(screenshotsDir) : [];
if (screenshots.length < 3) {
  throw new Error(`Packaging failed: expected at least 3 screenshots, found ${screenshots.length}.`);
}

function readdirNames(dir) {
  return readdirSync(dir).filter(f => /\.(png|jpg|jpeg)$/i.test(f));
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(screenshotsDir)) {
  cpSync(screenshotsDir, join(out, 'screenshots'), { recursive: true });
}

// Count files and total bytes in game/
let gameFileCount = 0;
let totalBytes = 0;
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile()) {
      gameFileCount++;
      totalBytes += statSync(full).size;
    }
  }
}
walk(join(out, 'game'));

const screenshotCount = readdirNames(join(out, 'screenshots')).length;

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Night Run: Port Solano packaged successfully: ${gameFileCount} game files, ${screenshotCount} screenshots, ${totalBytes} total bytes.`);
