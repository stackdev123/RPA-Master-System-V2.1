
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Service Worker Registration & Legacy Cache Cleanup for PWA
if ('caches' in window) {
  caches.keys().then((names) => {
    names.forEach((name) => {
      if (name !== 'rpa-master-shell-v4' && name !== 'rpa-master-data-v4') {
        caches.delete(name);
      }
    });
  }).catch(() => {});
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.update().catch(() => {});
    }).catch(err => {
      console.log('SW registration failed: ', err);
    });
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
