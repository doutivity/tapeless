// Minimal static file server for tests and screenshots. `prefix` ('/tapeless/') mimics a GitHub project site.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' };

export function serve(root, { port = 0, prefix = '/' } = {}) {
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (!path.startsWith(prefix)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('outside prefix'); }
      path = normalize(path.slice(prefix.length));
      if (path.startsWith('..')) throw new Error('bad path');
      let file = join(root, path);
      if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      const type = TYPES[extname(file)] || 'application/octet-stream';
      // GitHub Pages compresses text responses; do the same so size and timing checks are realistic
      const gz = /^(text|application\/(json|xml|manifest))|svg|javascript/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
      res.writeHead(200, { 'content-type': type, ...(gz ? { 'content-encoding': 'gzip', vary: 'accept-encoding' } : {}) });
      res.end(gz ? gzipSync(body) : body);
    } catch {
      const nf = await readFile(join(root, '404.html')).catch(() => 'not found');
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(nf);
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, url: `http://127.0.0.1:${server.address().port}${prefix}` })));
}
