import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { watch } from 'node:fs';
import { build } from './build.mjs';

await build('.preview');
let timer;
let buildQueue = Promise.resolve();
watch(new URL('../src', import.meta.url), { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(() => { buildQueue = buildQueue.then(() => build('.preview')).catch(console.error); }, 100);
});
const root = resolve('.preview');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.otf': 'font/otf', '.json': 'application/json' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let path = resolve(root, `.${pathname}`);
    if (path !== root && !path.startsWith(root + sep)) throw new Error('Invalid path');
    if ((await stat(path)).isDirectory()) {
      if (!pathname.endsWith('/')) {
        res.writeHead(301, { Location: pathname + '/' });
        return res.end();
      }
      path = resolve(path, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(await readFile(resolve(root, '404.html')));
  }
}).listen(4193, '127.0.0.1', () => console.log('Portfolio preview: http://127.0.0.1:4193'));
