import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  query,
  where,
  orderBy,
  setDoc,
  updateDoc,
  getDocs,
  docSnapshots,
  serverTimestamp,
  getDoc
} from '@angular/fire/firestore';
import { Observable, combineLatest, of, map, switchMap, take, catchError } from 'rxjs';
import { Booking, BookingStatus } from '../models/booking.model';
import { Service } from '../models/service.model';
import { UserProfile } from '../models/user.model';
import { NotificationService } from './notification.service';
import { NotificationType } from '../models/notification.model';
import { WalletService } from './wallet.service';

@Injectable({
  providedIn: 'root'
})
export class BookingService {







  /**
   * Récupère toutes les réservations d'un utilisateur (client ou prestataire)
   * @param userId ID de l'utilisateur
   * @returns Observable de réservations
   */






  async updateBookingStatus(id: string, status: BookingStatus, comment?: string): Promise<void> {
    const timestamp = Date.now();
    const updateData: any = {
      status,
      updatedAt: timestamp
    };

    if (comment) {
      updateData.statusComment = comment;
    }

    // Récupérer les informations de la réservation pour les notifications
    const bookingRef = doc(this.firestore, `bookings/${id}`);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      throw new Error(`Booking with ID ${id} not found`);
    }

    const booking = bookingSnap.data() as Booking;
    const serviceRef = doc(this.firestore, `services/${booking.serviceId}`);
    const serviceSnap = await getDoc(serviceRef);

    // Mettre à jour le statut
    await updateDoc(bookingRef, updateData);

    // Envoyer des notifications en fonction du nouveau statut
    if (serviceSnap.exists()) {
      const service = serviceSnap.data() as Service;
      let notificationData: {
        title: string;
        message: string;
        recipientId: string;
        type: NotificationType;
      } = {
        title: '',
        message: '',
        recipientId: '',
        type: 'booking' as NotificationType
      };

      switch (status) {
        case 'confirmed':
          notificationData = {
            title: 'Réservation confirmée',
            message: `Votre réservation pour "${service.title}" a été confirmée`,
            recipientId: booking.clientId,
            type: 'booking_confirmation' as NotificationType
          };
          break;
        case 'canceled':
          if (booking.clientId === booking.canceledBy) {
            notificationData = {
              title: 'Réservation annulée',
              message: `Un client a annulé sa réservation pour "${service.title}"`,
              recipientId: booking.providerId,
              type: 'booking_cancellation' as NotificationType
            };
          } else {
            notificationData = {
              title: 'Réservation annulée',
              message: `Votre réservation pour "${service.title}" a été annulée par le prestataire`,
              recipientId: booking.clientId,
              type: 'booking_cancellation' as NotificationType
            };
          }
          break;
        case 'completed':
          notificationData = {
            title: 'Service terminé',
            message: `Votre réservation pour "${service.title}" a été marquée comme terminée`,
            recipientId: booking.clientId,
            type: 'booking_completed' as NotificationType
          };
          break;
      }

      if (notificationData.recipientId && notificationData.title) {
        this.notificationService.createNotification({
          userId: notificationData.recipientId,
          title: notificationData.title,
          message: notificationData.message,
          type: notificationData.type,
          metadata: {
            bookingId: id,
            serviceId: booking.serviceId,
            serviceName: service.title,
            providerId: booking.providerId,
            clientId: booking.clientId
          },
          read: false,
          updatedAt: Date.now()
        });
      }
    }
  }

  async cancelBooking(id: string, canceledBy: string, reason?: string): Promise<void> {
    const bookingRef = doc(this.firestore, `bookings/${id}`);

    // Mettre à jour la réservation avec les informations d'annulation
    await updateDoc(bookingRef, {
      status: 'canceled',
      canceledBy,
      cancelReason: reason || '',
      canceledAt: Date.now(),
      updatedAt: Date.now()
    });

    // Récupérer les informations pour les notifications
    const booking = await this.getBooking(id).pipe(take(1)).toPromise();
    if (booking) {
      // Déterminer qui doit recevoir la notification (client ou prestataire)
      const recipientId = canceledBy === booking.clientId ? booking.providerId : booking.clientId;
      const serviceRef = doc(this.firestore, `services/${booking.serviceId}`);
      const serviceSnap = await getDoc(serviceRef);

      if (serviceSnap.exists() && recipientId) {
        const service = serviceSnap.data() as Service;
        const canceledByText = canceledBy === booking.clientId ? 'le client' : 'le prestataire';

        this.notificationService.createNotification({
          userId: recipientId,
          title: 'Réservation annulée',
          message: `La réservation pour "${service.title}" a été annulée par ${canceledByText}${reason ? ` : ${reason}` : ''}`,
          type: 'booking_cancellation' as NotificationType,
          metadata: {
            bookingId: id,
            serviceId: booking.serviceId,
            serviceName: service.title,
            providerId: booking.providerId,
            clientId: booking.clientId,
            reason: reason || ''
          },
          read: false,
          updatedAt: Date.now()
        });
      }
    }
  }

  async confirmBooking(id: string): Promise<void> {
    return this.updateBookingStatus(id, 'confirmed');
  }


  // Récupérer les réservations avec les informations de service et d'utilisateur



  // Récupérer les créneaux disponibles pour un service à une date donnée


  constructor(
    private firestore: Firestore,
    private notificationService: NotificationService,
    private walletService: WalletService // Inject the wallet service
  ) { }

  getBookings(): Observable<Booking[]> {
    const bookingsRef = collection(this.firestore, 'bookings');
    return collectionData(bookingsRef, { idField: 'id' }) as Observable<Booking[]>;
  }

  getBookingsByClient(clientId: string): Observable<Booking[]> {
    const bookingsRef = collection(this.firestore, 'bookings');
    const q = query(
      bookingsRef,
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Booking[]>;
  }

  getBookingsByProvider(providerId: string): Observable<Booking[]> {
    const bookingsRef = collection(this.firestore, 'bookings');
    const q = query(
      bookingsRef,
      where('providerId', '==', providerId),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Booking[]>;
  }

  getUserBookings(userId: string): Observable<Booking[]> {
    console.log('Getting bookings for user:', userId);

    if (!userId) {
      console.error('getUserBookings called with empty userId');
      return of([]);
    }

    return combineLatest([
      this.getBookingsByClient(userId),
      this.getBookingsByProvider(userId)
    ]).pipe(
      map(([clientBookings, providerBookings]) => {
        console.log('Client bookings:', clientBookings.length);
        console.log('Provider bookings:', providerBookings.length);

        const allBookings = [...clientBookings, ...providerBookings]
          .sort((a, b) => {
            if (!a.createdAt) return 1;
            if (!b.createdAt) return -1;
            return (b.createdAt as any) - (a.createdAt as any);
          });

        console.log('Combined bookings:', allBookings.length);
        return allBookings;
      }),
      catchError(error => {
        console.error('Error fetching user bookings:', error);
        return of([]);
      })
    );
  }

  getBooking(id: string): Observable<Booking | null> {
    const bookingRef = doc(this.firestore, `bookings/${id}`);
    return docData(bookingRef, { idField: 'id' }).pipe(
      map(booking => booking as Booking || null)
    );
  }

  getBookingWithService(id: string): Observable<{ booking: Booking, service: Service } | null> {
    return this.getBooking(id).pipe(
      switchMap(booking => {
        if (!booking) return of(null);

        const serviceRef = doc(this.firestore, `services/${booking.serviceId}`);
        return docData(serviceRef).pipe(
          map(service => {
            if (!service) return null;
            return { booking, service: service as Service };
          })
        );
      })
    );
  }

  async createBooking(booking: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const bookingsRef = collection(this.firestore, 'bookings');
    const id = doc(bookingsRef).id;
    const timestamp = Date.now();

    // All bookings start with 'pending' status
    await setDoc(doc(bookingsRef, id), {
      ...booking,
      id,
      status: 'pending', // Ensure status is set to pending
      createdAt: timestamp,
      updatedAt: timestamp
    });

    // Notify the provider of a new booking
    if (booking.providerId) {
      try {
        const serviceRef = doc(this.firestore, `services/${booking.serviceId}`);
        const serviceSnap = await getDoc(serviceRef);

        if (serviceSnap.exists()) {
          const service = serviceSnap.data() as Service;
          this.notificationService.createNotification({
            userId: booking.providerId,
            title: 'Nouvelle réservation',
            message: `Vous avez reçu une nouvelle réservation pour "${service.title}"`,
            type: 'booking_request' as NotificationType,
            metadata: {
              bookingId: id,
              serviceId: booking.serviceId,
              serviceName: service.title,
              clientId: booking.clientId
            },
            read: false,
            updatedAt: Date.now()
          });
        }
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    }

    return id;
  }

  async updateBooking(id: string, booking: Partial<Booking>): Promise<void> {
    const timestamp = Date.now();
    const bookingRef = doc(this.firestore, `bookings/${id}`);

    await updateDoc(bookingRef, {
      ...booking,
      updatedAt: timestamp
    });
  }

  async acceptBooking(id: string): Promise<void> {
    const timestamp = Date.now();
    const bookingRef = doc(this.firestore, `bookings/${id}`);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      throw new Error(`Booking with ID ${id} not found`);
    }

    const booking = bookingSnap.data() as Booking;

    // Get service details for the price information
    const serviceRef = doc(this.firestore, `services/${booking.serviceId}`);
    const serviceSnap = await getDoc(serviceRef);

    if (!serviceSnap.exists()) {
      throw new Error(`Service with ID ${booking.serviceId} not found`);
    }

    const service = serviceSnap.data() as Service;

    // Update booking status to confirmed
    await updateDoc(bookingRef, {
      status: 'confirmed',
      updatedAt: timestamp
    });

    // Transfer payment to provider's wallet
    await this.walletService.addFunds(
      booking.providerId,
      booking.totalPrice || service.price,
      `type:booking_payment,bookingId:${id},serviceId:${booking.serviceId}`
    );

    // Notify the client that their booking was accepted
    this.notificationService.createNotification({
      userId: booking.clientId,
      title: 'Réservation confirmée',
      message: `Votre réservation pour "${service.title}" a été confirmée`,
      type: 'booking_confirmation' as NotificationType,
      metadata: {
        bookingId: id,
        serviceId: booking.serviceId,
        serviceName: service.title,
        providerId: booking.providerId
      },
      read: false,
      updatedAt: timestamp
    });
  }

  async completeBooking(id: string): Promise<void> {
    const timestamp = Date.now();
    const bookingRef = doc(this.firestore, `bookings/${id}`);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      throw new Error(`Booking with ID ${id} not found`);
    }

    const booking = bookingSnap.data() as Booking;

    // Get service details
    const serviceRef = doc(this.firestore, `services/${booking.serviceId}`);
    const serviceSnap = await getDoc(serviceRef);

    if (!serviceSnap.exists()) {
      throw new Error(`Service with ID ${booking.serviceId} not found`);
    }

    const service = serviceSnap.data() as Service;

    // Update booking status to completed
    await updateDoc(bookingRef, {
      status: 'completed',
      completedAt: timestamp,
      updatedAt: timestamp
    });

    // Notify the provider that service was completed
    this.notificationService.createNotification({
      userId: booking.providerId,
      title: 'Service terminé',
      message: `Le client a marqué le service "${service.title}" comme terminé`,
      type: 'booking_completed' as NotificationType,
      metadata: {
        bookingId: id,
        serviceId: booking.serviceId,
        serviceName: service.title,
        clientId: booking.clientId
      },
      read: false,
      updatedAt: timestamp
    });
  }

  // Get bookings with additional details (service and user info)
  getBookingsWithDetails(userId: string, role: 'client' | 'provider'): Observable<any[]> {
    const field = role === 'client' ? 'clientId' : 'providerId';
    const bookingsRef = collection(this.firestore, 'bookings');
    const q = query(
      bookingsRef,
      where(field, '==', userId),
      orderBy('createdAt', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      switchMap(bookings => {
        if (bookings.length === 0) {
          return of([]);
        }

        // Get all associated services
        const serviceIds = [...new Set(bookings.map((b: any) => b.serviceId))];
        const serviceObservables = serviceIds.map(serviceId => {
          const serviceRef = doc(this.firestore, `services/${serviceId}`);
          return docData(serviceRef).pipe(
            map(service => ({ serviceId, serviceData: service || null }))
          );
        });

        // Get all associated users
        const userIds = [...new Set(bookings.map((b: any) => role === 'client' ? b.providerId : b.clientId))];
        const userObservables = userIds.map(userId => {
          const userRef = doc(this.firestore, `users/${userId}`);
          return docData(userRef).pipe(
            map(user => ({ userId, userData: user || null }))
          );
        });

        return combineLatest([
          of(bookings),
          combineLatest(serviceObservables),
          combineLatest(userObservables)
        ]).pipe(
          map(([bookings, services, users]) => {
            // Create maps for easy access
            const serviceMap = services.reduce((acc, s) => {
              acc[s.serviceId] = s.serviceData;
              return acc;
            }, {} as Record<string, any>);

            const userMap = users.reduce((acc, u) => {
              acc[u.userId] = u.userData;
              return acc;
            }, {} as Record<string, any>);

            // Combine data
            return bookings.map((booking: any) => ({
              ...booking,
              service: serviceMap[booking.serviceId] || null,
              otherUser: userMap[role === 'client' ? booking.providerId : booking.clientId] || null
            }));
          })
        );
      })
    );
  }

  checkAvailability(serviceId: string, date: string, time: string): Observable<boolean> {
    const bookingsRef = collection(this.firestore, 'bookings');
    const q = query(
      bookingsRef,
      where('serviceId', '==', serviceId),
      where('date', '==', date),
      where('time', '==', time),
      where('status', 'in', ['confirmed', 'pending'])
    );

    return collectionData(q).pipe(
      map(bookings => bookings.length === 0)
    );
  }

  getAvailableSlots(serviceId: string, date: string, availableHours: string[]): Observable<string[]> {
    const bookingsRef = collection(this.firestore, 'bookings');
    const q = query(
      bookingsRef,
      where('serviceId', '==', serviceId),
      where('date', '==', date),
      where('status', 'in', ['confirmed', 'pending'])
    );

    return collectionData(q).pipe(
      map(bookings => {
        const bookedSlots = bookings.map((booking: any) => booking.time);
        return availableHours.filter(slot => !bookedSlots.includes(slot));
      })
    );
  }
}
