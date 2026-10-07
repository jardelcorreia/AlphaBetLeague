
// Scripts necessários para o Firebase Messaging em segundo plano
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Configuração idêntica ao src/firebase/config.ts
firebase.initializeApp({
  apiKey: "AIzaSyA6noJTkCcRypfeqi91qa6a2hDEcQ606N0",
  authDomain: "studio-7344387368-26e1e.firebaseapp.com",
  projectId: "studio-7344387368-26e1e",
  storageBucket: "studio-7344387368-26e1e.firebasestorage.app",
  messagingSenderId: "276111019128",
  appId: "1:276111019128:web:e7b5e0343df79e6da0318d"
});

const messaging = firebase.messaging();

// Listener para quando o app está fechado ou em segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensagem recebida em background: ', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
