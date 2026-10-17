import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const announce = () => { if (reg.waiting && navigator.serviceWorker.controller) dispatchEvent(new Event('kaamset:update')); };
      announce();
      reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', announce));
      // The new worker waits until the person chooses to refresh, so in-progress forms are not lost.
      let applying = false;
      addEventListener('kaamset:apply-update', () => { applying = true; reg.waiting?.postMessage('SKIP_WAITING'); });
      // The first install also fires controllerchange (clients.claim); only reload when the person asked to update.
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (applying) location.reload(); });
    } catch { /* app still works online without offline support */ }
  });
}
