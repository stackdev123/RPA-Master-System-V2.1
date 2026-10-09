async function bootstrap() {
  try {
    let hadLegacyCache = false;
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (name !== 'rpa-master-shell-v4' && name !== 'rpa-master-data-v4') {
          await caches.delete(name);
          hadLegacyCache = true;
        }
      }
    }

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (!localStorage.getItem('rpa_sw_v4_migrated') || hadLegacyCache) {
        for (const reg of registrations) {
          await reg.unregister();
        }
        localStorage.setItem('rpa_sw_v4_migrated', '1');
        if (navigator.serviceWorker.controller && !sessionStorage.getItem('rpa_sw_v4_reloaded')) {
          sessionStorage.setItem('rpa_sw_v4_reloaded', '1');
          window.location.reload();
          return;
        }
      }
    }
  } catch (err) {
    console.warn('Bootstrap cache cleanup warning:', err);
  }

  await import('./index');
}

bootstrap();
