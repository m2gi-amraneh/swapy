import { Injectable } from '@angular/core';
import { 
  Firestore,
  collection,
  collectionData,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  writeBatch,
  arrayUnion
} from '@angular/fire/firestore';
import { Messaging, getMessaging, getToken, onMessage } from '@angular/fire/messaging';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Observable, from, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Notification, NotificationType } from '../models/notification.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly NOTIFICATION_COLLECTION = 'notifications';
  private messaging: Messaging | undefined;

  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {
    if (!Capacitor.isNativePlatform()) {
      this.messaging = getMessaging();
    }
    this.initPushNotifications();
  }

  private async initPushNotifications() {
    if (Capacitor.isNativePlatform()) {
      try {
        // Request permission to use push notifications
        const result = await PushNotifications.requestPermissions();
        
        if (result.receive === 'granted') {
          // Register with FCM
          await PushNotifications.register();
          
          // Listen for push notifications
          PushNotifications.addListener('pushNotificationReceived', notification => {
            console.log('Push notification received:', notification);
            // Handle the notification
          });
          
          // Handle notification when app is in background
          PushNotifications.addListener('pushNotificationActionPerformed', notification => {
            console.log('Push notification action performed:', notification);
            // Handle the notification action
          });
        }
      } catch (error) {
        console.error('Error initializing push notifications:', error);
      }
    } else {
      // Web platform - use Firebase Messaging
      try {
        const currentToken = await getToken(this.messaging!, {
          vapidKey: 'YOUR_VAPID_KEY' // Remplacez par votre clé VAPID
        });
        
        if (currentToken) {
          this.saveTokenToUser(currentToken);
        } else {
          console.log('No registration token available');
        }

        // Handle incoming messages
        onMessage(this.messaging!, (payload) => {
          console.log('New message received:', payload);
          // Handle the message
        });
      } catch (error) {
        console.error('Error getting messaging token:', error);
      }
    }
  }

  private saveTokenToUser(token: string) {
    this.authService.user$.pipe(
      switchMap(user => {
        if (user) {
          const userDocRef = doc(this.firestore, `users/${user.uid}`);
          return from(updateDoc(userDocRef, {
            fcmTokens: arrayUnion(token)
          }));
        }
        return of(null);
      })
    ).subscribe();
  }

  getUserNotifications(userId: string): Observable<Notification[]> {
    const notificationsRef = collection(this.firestore, this.NOTIFICATION_COLLECTION);
    const notificationsQuery = query(
      notificationsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    return collectionData(notificationsQuery, { idField: 'id' }) as Observable<Notification[]>;
  }

  getUnreadCount(userId: string): Observable<number> {
    const notificationsRef = collection(this.firestore, this.NOTIFICATION_COLLECTION);
    const unreadQuery = query(
      notificationsRef,
      where('userId', '==', userId),
      where('read', '==', false)
    );
    
    return collectionData(unreadQuery).pipe(
      map(notifications => notifications.length)
    );
  }

  async createNotification(notification: Partial<Notification>): Promise<string> {
    try {
      if (!notification.userId || !notification.type) {
        throw new Error('userId and type are required for creating a notification');
      }
      
      const notificationsRef = collection(this.firestore, this.NOTIFICATION_COLLECTION);
      const newNotificationRef = doc(notificationsRef);
      const id = newNotificationRef.id;
      const timestamp = Date.now();
      
      const completeNotification = {
        ...notification,
        id,
        createdAt: timestamp,
        updatedAt: timestamp,
        read: false,
        message: notification.message || notification.body || '',
      };
      
      await setDoc(newNotificationRef, completeNotification);
      
      // Send push notification if applicable
      this.sendPushNotification(completeNotification as Notification);
      
      return id;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(this.firestore, this.NOTIFICATION_COLLECTION, notificationId);
      await updateDoc(notificationRef, {
        read: true,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(this.firestore, this.NOTIFICATION_COLLECTION, notificationId);
      await deleteDoc(notificationRef);
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  async clearAllNotifications(userId: string): Promise<void> {
    try {
      const notificationsRef = collection(this.firestore, this.NOTIFICATION_COLLECTION);
      const userNotificationsQuery = query(
        notificationsRef,
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(userNotificationsQuery);
      
      if (!snapshot.empty) {
        const batch = writeBatch(this.firestore);
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
      throw error;
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    try {
      const notificationsRef = collection(this.firestore, this.NOTIFICATION_COLLECTION);
      const unreadNotificationsQuery = query(
        notificationsRef,
        where('userId', '==', userId),
        where('read', '==', false)
      );
      
      const snapshot = await getDocs(unreadNotificationsQuery);
      
      if (!snapshot.empty) {
        const batch = writeBatch(this.firestore);
        snapshot.docs.forEach(doc => {
          batch.update(doc.ref, { 
            read: true,
            updatedAt: Date.now()
          });
        });
        
        await batch.commit();
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  private async sendPushNotification(notification: Notification) {
    try {
      // Get user's FCM tokens
      const userDocRef = doc(this.firestore, `users/${notification.userId}`);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.data() as any;
      
      if (userData?.fcmTokens?.length) {
        // In a real app, you would use a cloud function or server to send the notification
        // This is a placeholder for that functionality
        console.log('Sending push notification to tokens:', userData.fcmTokens);
        console.log('Notification data:', notification);
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  // Helper methods for creating specific notification types
  async notifyNewMessage(
    userId: string, 
    senderId: string, 
    senderName: string | undefined,
    conversationId: string, 
    message: string
  ): Promise<string> {
    return this.createNotification({
      userId,
      type: 'message' as NotificationType,
      title: `Nouveau message de ${senderName || 'un utilisateur'}`,
      message: message.length > 100 ? message.substring(0, 97) + '...' : message,
      metadata: {
        senderId,
        conversationId
      }
    });
  }

  async notifyBookingRequest(
    providerId: string,
    clientId: string,
    clientName: string,
    bookingId: string,
    serviceName: string
  ): Promise<string> {
    return this.createNotification({
      userId: providerId,
      type: 'booking' as NotificationType,
      title: 'Nouvelle demande de réservation',
      message: `${clientName} a demandé à réserver votre service "${serviceName}"`,
      metadata: {
        clientId,
        bookingId,
        serviceName
      }
    });
  }

  async notifyBookingConfirmation(
    clientId: string,
    providerId: string,
    providerName: string,
    bookingId: string,
    serviceName: string
  ): Promise<string> {
    return this.createNotification({
      userId: clientId,
      type: 'booking_confirmation' as NotificationType,
      title: 'Réservation confirmée',
      message: `${providerName} a confirmé votre réservation pour "${serviceName}"`,
      metadata: {
        providerId,
        bookingId,
        serviceName
      }
    });
  }

  async notifyBookingCancellation(
    recipientId: string,
    cancelerId: string,
    cancelerName: string,
    bookingId: string,
    serviceName: string,
    reason?: string
  ): Promise<string> {
    let message = `${cancelerName} a annulé la réservation pour "${serviceName}"`;
    if (reason) {
      message += `. Raison: ${reason}`;
    }
    
    return this.createNotification({
      userId: recipientId,
      type: 'booking_cancellation' as NotificationType,
      title: 'Réservation annulée',
      message,
      metadata: {
        cancelerId,
        bookingId,
        serviceName,
        reason
      }
    });
  }

  async notifyNewReview(
    providerId: string,
    reviewerId: string,
    reviewerName: string,
    serviceId: string,
    serviceName: string,
    rating: number
  ): Promise<string> {
    return this.createNotification({
      userId: providerId,
      type: 'review' as NotificationType,
      title: 'Nouvel avis',
      message: `${reviewerName} a laissé un avis ${rating}/5 pour votre service "${serviceName}"`,
      metadata: {
        reviewerId,
        serviceId,
        serviceName,
        rating
      }
    });
  }
}