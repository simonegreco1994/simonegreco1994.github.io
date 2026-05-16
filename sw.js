// AgilityPro Service Worker — gestisce notifiche push e scheduling
const CACHE_NAME = 'agilitypro-v1';

// Ascolta messaggi dall'app principale
self.addEventListener('message', event => {
  if(event.data?.type === 'SCHEDULE_CHECK') {
    checkAndNotify(event.data.cfg, event.data.appuntamenti, event.data.iscritti);
  }
  if(event.data?.type === 'TEST_NOTIFICATION') {
    const { title, body } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: '/agilitypro/icon-192.png',
      badge: '/agilitypro/icon-192.png',
      tag: 'agilitypro-test',
      renotify: true,
      vibrate: [200, 100, 200]
    });
  }
});

// Controlla se è il momento di mandare la notifica
function checkAndNotify(cfg, appuntamenti, iscritti) {
  if(!cfg?.attive) return;

  const now = new Date();
  const oraCorrente = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  if(oraCorrente !== cfg.ora) return;

  // Controlla se già mandata oggi
  const todayStr = now.toISOString().split('T')[0];
  const lastSent = cfg.lastSent;
  if(lastSent === todayStr) return;

  // Calcola data target
  const target = new Date();
  target.setDate(target.getDate() + (cfg.giorni || 1));
  const targetStr = target.toISOString().split('T')[0];
  const targetLabel = target.toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' });

  // Filtra lezioni
  const lezioni = (appuntamenti || [])
    .filter(a => a.data === targetStr && a.stato !== 'saltata')
    .sort((a, b) => (a.ora || '').localeCompare(b.ora || ''));

  let title, body;
  if(lezioni.length === 0) {
    title = '🐾 AgilityPro';
    body = 'Nessuna lezione domani (' + targetLabel + '). Giornata libera! ✅';
  } else {
    title = '🐾 ' + lezioni.length + ' lezione' + (lezioni.length > 1 ? 'i' : '') + ' — ' + targetLabel;
    const lista = lezioni.map(a => {
      const isc = (iscritti || []).find(i => String(i.id) === String(a.iscrittoId));
      return (a.ora || '?') + ' — ' + (isc?.nome || '?') + ' & ' + (isc?.cane || '?') + (a.recuperoDi ? ' 🔄' : '');
    });
    body = lista.join('\n');
  }

  self.registration.showNotification(title, {
    body,
    icon: '/agilitypro/icon-192.png',
    badge: '/agilitypro/icon-192.png',
    tag: 'agilitypro-reminder',
    renotify: false,
    requireInteraction: false,
    vibrate: [300, 100, 300]
  });

  // Notifica all'app che è stata mandata (per aggiornare lastSent)
  self.clients.matchAll().then(clients => {
    clients.forEach(c => c.postMessage({ type: 'NOTIFICA_INVIATA', data: todayStr }));
  });
}

// Installazione e attivazione immediata
self.addEventListener('install', event => {
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// Click sulla notifica — apre l'app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      if(clients.length > 0) { clients[0].focus(); return; }
      self.clients.openWindow('https://simonegreco1994.github.io/');
    })
  );
});

// Periodic background sync (dove supportato)
self.addEventListener('periodicsync', event => {
  if(event.tag === 'agilitypro-reminder') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'REQUEST_SCHEDULE_CHECK' }));
      })
    );
  }
});
