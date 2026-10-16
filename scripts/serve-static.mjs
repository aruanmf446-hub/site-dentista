// Servidor estático mínimo para testes: node scripts/serve-static.mjs <pasta> <porta>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const [dir = 'dist', port = '4321'] = process.argv.slice(2);
const root = path.resolve(dir);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.glb': 'model/gltf-binary', '.ico': 'image/x-icon' };
http
  .createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.join(root, url);
    if (!file.startsWith(root)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      const nf = path.join(root, '404.html');
      res.writeHead(404, { 'Content-Type': types['.html'] });
      return res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'not found');
    }
    const type = types[path.extname(file)] || 'application/octet-stream';
    // compressão como na hospedagem (Vercel): medições de peso realistas
    const gz = /gzip/.test(req.headers['accept-encoding'] || '') && /text|javascript|json|xml|svg/.test(type);
    res.writeHead(200, { 'Content-Type': type, ...(gz ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}) });
    const stream = fs.createReadStream(file);
    (gz ? stream.pipe(zlib.createGzip()) : stream).pipe(res);
  })
  .listen(+port, '127.0.0.1', () => console.log(`servindo ${root} em http://127.0.0.1:${port}`));
