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
  limit,
  getCountFromServer,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  getDoc
} from '@angular/fire/firestore';
import { Observable, from, of, combineLatest } from 'rxjs';
import { 
  map,
  switchMap,
  catchError
} from 'rxjs/operators';
import { AppStats, CategoryStats, DailyStats, UserStats } from '../models/stats.model';
import { Service } from '../models/service.model';
import { Booking } from '../models/booking.model';
import { Review } from '../models/review.model';

@Injectable({
  providedIn: 'root'
})
export class StatsService {
  constructor(private firestore: Firestore) {}

  /**
   * Gets global app statistics
   */
  getAppStats(): Observable<AppStats | null> {
    const statsRef = doc(this.firestore, 'stats/app');
    return docData(statsRef) as Observable<AppStats | null>;
  }

  /**
   * Gets daily statistics
   * @param days Number of days to retrieve
   */
  getDailyStats(days: number = 30): Observable<DailyStats[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateString = this.formatDate(startDate);
    
    const dailyStatsRef = collection(this.firestore, 'dailyStats');
    const q = query(
      dailyStatsRef,
      where('date', '>=', startDateString),
      orderBy('date', 'desc')
    );
    
    return collectionData(q, { idField: 'id' }) as Observable<DailyStats[]>;
  }

  /**
   * Gets category statistics
   * @param categoryId Category ID
   */
  getCategoryStats(categoryId: string): Observable<CategoryStats | null> {
    const categoryStatsRef = doc(this.firestore, `categoryStats/${categoryId}`);
    return docData(categoryStatsRef) as Observable<CategoryStats | null>;
  }

  /**
   * Gets all categories statistics
   */
  getAllCategoryStats(): Observable<CategoryStats[]> {
    const categoryStatsRef = collection(this.firestore, 'categoryStats');
    return collectionData(categoryStatsRef, { idField: 'id' }) as Observable<CategoryStats[]>;
  }

  /**
   * Gets user statistics
   * @param userId User ID
   */
  getUserStats(userId: string): Observable<UserStats | null> {
    const userStatsRef = doc(this.firestore, `userStats/${userId}`);
    return docData(userStatsRef) as Observable<UserStats | null>;
  }

  /**
   * Updates global app statistics
   */
  async updateAppStats(): Promise<void> {
    const timestamp = serverTimestamp();
    
    const [
      usersCount,
      servicesCount,
      bookingsCount,
      reviewsCount,
      completedBookingsCount,
      canceledBookingsCount,
      revenue
    ] = await Promise.all([
      this.getCollectionCount('users'),
      this.getCollectionCount('services'),
      this.getCollectionCount('bookings'),
      this.getCollectionCount('reviews'),
      this.getCollectionCountWithFilter('bookings', 'status', '==', 'completed'),
      this.getCollectionCountWithFilter('bookings', 'status', '==', 'canceled'),
      this.calculateTotalRevenue()
    ]);
    
    const statsRef = doc(this.firestore, 'stats/app');
    await setDoc(statsRef, {
      id: 'app',
      totalUsers: usersCount,
      totalServices: servicesCount,
      totalBookings: bookingsCount,
      totalReviews: reviewsCount,
      totalCompletedBookings: completedBookingsCount,
      totalCanceledBookings: canceledBookingsCount,
      totalRevenue: revenue,
      updatedAt: timestamp
    });
  }

  /**
   * Generates daily statistics
   */
  async generateDailyStats(): Promise<void> {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const todayString = this.formatDate(today);
    const yesterdayString = this.formatDate(yesterday);
    
    const [
      newUsers,
      newServices,
      newBookings,
      newReviews,
      completedBookings,
      canceledBookings,
      revenue
    ] = await Promise.all([
      this.getDocumentsCreatedInDateRange('users', yesterdayString, todayString),
      this.getDocumentsCreatedInDateRange('services', yesterdayString, todayString),
      this.getDocumentsCreatedInDateRange('bookings', yesterdayString, todayString),
      this.getDocumentsCreatedInDateRange('reviews', yesterdayString, todayString),
      this.getDocumentsUpdatedWithStatusInDateRange('bookings', 'completed', yesterdayString, todayString),
      this.getDocumentsUpdatedWithStatusInDateRange('bookings', 'canceled', yesterdayString, todayString),
      this.calculateRevenueForDateRange(yesterdayString, todayString)
    ]);
    
    const dailyStatsRef = doc(this.firestore, `dailyStats/${yesterdayString}`);
    await setDoc(dailyStatsRef, {
      id: yesterdayString,
      date: yesterdayString,
      newUsers,
      newServices,
      newBookings,
      newReviews,
      completedBookings,
      canceledBookings,
      revenue,
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Updates category statistics
   * @param categoryId Category ID
   */
  async updateCategoryStats(categoryId: string): Promise<void> {
    const timestamp = serverTimestamp();
    
    const [
      servicesCount,
      bookingsCount,
      reviewsCount,
      averageRating
    ] = await Promise.all([
      this.getCollectionCountWithFilter('services', 'category', '==', categoryId),
      this.getBookingsCountForCategory(categoryId),
      this.getReviewsCountForCategory(categoryId),
      this.getAverageRatingForCategory(categoryId)
    ]);
    
    const categoryStatsRef = doc(this.firestore, `categoryStats/${categoryId}`);
    await setDoc(categoryStatsRef, {
      id: categoryId,
      categoryId,
      totalServices: servicesCount,
      totalBookings: bookingsCount,
      totalReviews: reviewsCount,
      averageRating,
      updatedAt: timestamp
    });
  }

  /**
   * Updates user statistics
   * @param userId User ID
   * @param role User role ('client' or 'provider')
   */
  async updateUserStats(userId: string, role: 'client' | 'provider'): Promise<void> {
    const timestamp = serverTimestamp();
    const fieldName = role === 'client' ? 'clientId' : 'providerId';
    
    const [
      bookingsCount,
      reviewsCount,
      canceledBookingsCount,
      completedBookingsCount
    ] = await Promise.all([
      this.getCollectionCountWithFilter('bookings', fieldName, '==', userId),
      role === 'provider' ? this.getCollectionCountWithFilter('reviews', 'providerId', '==', userId) : 0,
      this.getCollectionCountWithMultipleFilters('bookings', [
        { field: fieldName, operator: '==', value: userId },
        { field: 'status', operator: '==', value: 'canceled' }
      ]),
      this.getCollectionCountWithMultipleFilters('bookings', [
        { field: fieldName, operator: '==', value: userId },
        { field: 'status', operator: '==', value: 'completed' }
      ])
    ]);
    
    let averageRating = 0;
    let totalRevenue = 0;
    
    if (role === 'provider') {
      [averageRating, totalRevenue] = await Promise.all([
        this.getAverageRatingForProvider(userId),
        this.calculateTotalRevenueForProvider(userId)
      ]);
    }
    
    const stats: UserStats = {
      id: userId,
      userId,
      role,
      totalBookings: bookingsCount,
      totalReviews: reviewsCount,
      totalCanceledBookings: canceledBookingsCount,
      totalCompletedBookings: completedBookingsCount,
      updatedAt: new Date().getTime()
    };
    
    if (role === 'provider') {
      stats.averageRating = averageRating;
      stats.totalRevenue = totalRevenue;
    }
    
    const userStatsRef = doc(this.firestore, `userStats/${userId}`);
    await setDoc(userStatsRef, stats);
  }

  // Private utility methods

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private async getCollectionCount(collectionName: string): Promise<number> {
    const coll = collection(this.firestore, collectionName);
    const snapshot = await getCountFromServer(coll);
    return snapshot.data().count;
  }

  private async getCollectionCountWithFilter(
    collectionName: string,
    field: string,
    operator: '==' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in' | 'array-contains-any',
    value: any
  ): Promise<number> {
    const coll = collection(this.firestore, collectionName);
    const q = query(coll, where(field, operator, value));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  }

  private async getCollectionCountWithMultipleFilters(
    collectionName: string,
    filters: Array<{ field: string, operator: '==' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in' | 'array-contains-any', value: any }>
  ): Promise<number> {
    const coll = collection(this.firestore, collectionName);
    let q = query(coll);
    
    filters.forEach(filter => {
      q = query(q, where(filter.field, filter.operator, filter.value));
    });
    
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  }

  private async getDocumentsCreatedInDateRange(
    collectionName: string,
    startDate: string,
    endDate: string
  ): Promise<number> {
    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = new Date(endDate).getTime();
    
    const coll = collection(this.firestore, collectionName);
    const q = query(
      coll,
      where('createdAt', '>=', startTimestamp),
      where('createdAt', '<', endTimestamp)
    );
    
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  }

  private async getDocumentsUpdatedWithStatusInDateRange(
    collectionName: string,
    status: string,
    startDate: string,
    endDate: string
  ): Promise<number> {
    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = new Date(endDate).getTime();
    
    const coll = collection(this.firestore, collectionName);
    const q = query(
      coll,
      where('status', '==', status),
      where('updatedAt', '>=', startTimestamp),
      where('updatedAt', '<', endTimestamp)
    );
    
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  }

  private async calculateTotalRevenue(): Promise<number> {
    const bookingsRef = collection(this.firestore, 'bookings');
    const q = query(bookingsRef, where('status', '==', 'completed'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return 0;
    
    let totalRevenue = 0;
    
    for (const doc of snapshot.docs) {
      const booking = doc.data() as Booking;
      const serviceRef = doc(this.firestore, `services/${booking.serviceId}`);
      const serviceSnap = await getDoc(serviceRef);
      
      if (serviceSnap.exists()) {
        const service = serviceSnap.data() as Service;
        totalRevenue += service.price || 0;
      }
    }
    
    return totalRevenue;
  }

  private async calculateRevenueForDateRange(startDate: string, endDate: string): Promise<number> {
    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = new Date(endDate).getTime();
    
    const bookingsRef = collection(this.firestore, 'bookings');
    const q = query(
      bookingsRef,
      where('status', '==', 'completed'),
      where('updatedAt', '>=', startTimestamp),
      where('updatedAt', '<', endTimestamp)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;
    
    let totalRevenue = 0;
    
    for (const doc of snapshot.docs) {
      const booking = doc.data() as Booking;
      const serviceRef = doc(this.firestore, `services/${booking.serviceId}`);
      // Changed from getDocs to getDoc since we're working with a document reference
      const serviceSnap = await getDoc(serviceRef);
      
      if (serviceSnap.exists()) {
        const service = serviceSnap.data() as Service;
        totalRevenue += service.price || 0;
      }
    }
    
    return totalRevenue;
  }

  private async getBookingsCountForCategory(categoryId: string): Promise<number> {
    const servicesRef = collection(this.firestore, 'services');
    const q = query(servicesRef, where('category', '==', categoryId));
    const servicesSnapshot = await getDocs(q);
    
    if (servicesSnapshot.empty) return 0;
    
    const serviceIds = servicesSnapshot.docs.map(doc => doc.id);
    let totalBookings = 0;
    
    for (const serviceId of serviceIds) {
      const bookingsRef = collection(this.firestore, 'bookings');
      const q = query(bookingsRef, where('serviceId', '==', serviceId));
      const snapshot = await getCountFromServer(q);
      totalBookings += snapshot.data().count;
    }
    
    return totalBookings;
  }

  private async getReviewsCountForCategory(categoryId: string): Promise<number> {
    const servicesRef = collection(this.firestore, 'services');
    const q = query(servicesRef, where('category', '==', categoryId));
    const servicesSnapshot = await getDocs(q);
    
    if (servicesSnapshot.empty) return 0;
    
    const serviceIds = servicesSnapshot.docs.map(doc => doc.id);
    let totalReviews = 0;
    
    for (const serviceId of serviceIds) {
      const reviewsRef = collection(this.firestore, 'reviews');
      const q = query(reviewsRef, where('serviceId', '==', serviceId));
      const snapshot = await getCountFromServer(q);
      totalReviews += snapshot.data().count;
    }
    
    return totalReviews;
  }

  private async getAverageRatingForCategory(categoryId: string): Promise<number> {
    const reviewsRef = collection(this.firestore, 'reviews');
    const snapshot = await getDocs(reviewsRef);
    
    if (snapshot.empty) return 0;
    
    let totalRating = 0;
    snapshot.forEach(doc => {
      const review = doc.data() as Review;
      totalRating += review.rating || 0;
    });
    
    return totalRating / snapshot.size;
  }

  private async getAverageRatingForProvider(providerId: string): Promise<number> {
    const reviewsRef = collection(this.firestore, 'reviews');
    const q = query(reviewsRef, where('providerId', '==', providerId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return 0;
    
    let totalRating = 0;
    snapshot.forEach(doc => {
      const review = doc.data() as Review;
      totalRating += review.rating || 0;
    });
    
    return totalRating / snapshot.size;
  }

  private async calculateTotalRevenueForProvider(providerId: string): Promise<number> {
    const bookingsRef = collection(this.firestore, 'bookings');
    const q = query(
      bookingsRef,
      where('providerId', '==', providerId),
      where('status', '==', 'completed')
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return 0;
    
    let totalRevenue = 0;
    
    for (const doc of snapshot.docs) {
      const booking = doc.data() as Booking;
      const serviceRef = doc(this.firestore, `services/${booking.serviceId}`);
      // Changed from getDocs to getDoc since we're working with a document reference
      const serviceSnap = await getDoc(serviceRef);
      
      if (serviceSnap.exists()) {
        const service = serviceSnap.data() as Service;
        totalRevenue += service.price || 0;
      }
    }
    
    return totalRevenue;
  }
}