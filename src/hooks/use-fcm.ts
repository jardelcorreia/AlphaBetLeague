
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useToast } from './use-toast';

const VAPID_KEY = 'BDJfhs7Q5xip0lcpZNOZp5APUhbIWpzwEuG9Vck9TI6wXmDrNedtdWy6Ky1ULQ58014V-uAZpHdoa1x6_iTGpo4';

export function useFcm() {
  const { messaging, user, firestore } = useFirebase();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!messaging || !user || !firestore) return;

    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Navegador não suporta Service Workers.');
      }

      const status = await Notification.requestPermission();
      setPermission(status);

      if (status === 'granted') {
        // Tenta registrar o worker explicitamente se não estiver registrado
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/'
        });
        
        // Aguarda o worker ficar ativo
        await navigator.serviceWorker.ready;

        const fcmToken = await getToken(messaging, { 
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration
        });

        if (fcmToken) {
          setToken(fcmToken);
          const userRef = doc(firestore, 'users', user.uid);
          await updateDoc(userRef, {
            fcmTokens: arrayUnion(fcmToken)
          });
          
          toast({
            title: 'Notificações Ativas!',
            description: 'AlphaBet vai te avisar sobre os gols e prazos.'
          });
        }
      }
    } catch (error: any) {
      console.error('Erro FCM:', error);
      toast({
        variant: 'destructive',
        title: 'Erro de Notificação',
        description: 'Não foi possível ativar o serviço de alertas.'
      });
    }
  }, [messaging, user, firestore, toast]);

  const disableNotifications = useCallback(async () => {
    if (!user || !firestore || !token) return;
    try {
      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, { fcmTokens: arrayRemove(token) });
      setToken(null);
      toast({ title: 'Notificações Desativadas' });
    } catch (error) {
      console.error(error);
    }
  }, [user, firestore, token, toast]);

  useEffect(() => {
    if (!messaging) return;
    const unsubscribe = onMessage(messaging, (payload) => {
      toast({
        title: payload.notification?.title || 'AlphaBet League',
        description: payload.notification?.body || 'Nova atualização!',
      });
    });
    return () => unsubscribe();
  }, [messaging, toast]);

  return {
    permission,
    token,
    requestPermission,
    disableNotifications,
    isSupported: !!messaging
  };
}
