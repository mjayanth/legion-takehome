// Bundles src/ into one self-contained index.html: esbuild for JS, Tailwind for CSS.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const js = await build({ entryPoints: ['src/ui/app.js'], bundle: true, format: 'iife', minify: false, write: false, target: 'es2020' });
execFileSync('node_modules/.bin/tailwindcss', ['-i', 'src/ui/styles.css', '-o', '.build.css', '--minify'], { stdio: 'inherit' });
const css = fs.readFileSync('.build.css', 'utf8');
fs.rmSync('.build.css');
const html = fs.readFileSync('src/index.template.html', 'utf8')
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
fs.writeFileSync('index.html', html);
console.log(`index.html written: ${(html.length / 1024).toFixed(0)} KB`);
