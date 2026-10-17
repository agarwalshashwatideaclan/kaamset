import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const PUBLIC_PRECACHE = ['/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png'];

/** Emits sw.js with the exact hashed build files to precache, versioned by their content. */
function serviceWorker(): Plugin {
  return {
    name: 'kaamset-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter(f => !f.endsWith('.map') && f !== 'index.html').map(f => `/${f}`);
      const urls = ['/', ...files, ...PUBLIC_PRECACHE];
      const version = createHash('sha256').update(urls.join('\n')).digest('hex').slice(0, 12);
      const template = readFileSync('src/sw-template.js', 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(urls)),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  build: { target: 'es2022', sourcemap: false },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8787' } },
});
