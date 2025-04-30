import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  getDocs,
  serverTimestamp,
  DocumentReference,
  setDoc
} from '@angular/fire/firestore';
import {
  Storage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from '@angular/fire/storage';
import { Observable, combineLatest, from, of } from 'rxjs';
import {
  map,
  switchMap,
  catchError
} from 'rxjs/operators';
import { UserProfile, } from '../models/user.model';
export interface ProviderStats {
  totalServices: number;
  activeServices: number;
  totalViews: number;
  totalBookings: number;
  averageRating: number;
  totalReviews: number;
  revenueStats: {
    daily: number;
    weekly: number;
    monthly: number;
    total: number;
  };
  categoryStats: {
    [category: string]: number;
  };
  completionRate: number;
}

export interface UserReview {
  id: string;
  userId: string;
  providerId: string;
  serviceId: string;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
  likes: number;
  response?: {
    comment: string;
    createdAt: Date;
  };
}
@Injectable({
  providedIn: 'root'
})
export class UserService {
  constructor(
    private firestore: Firestore,
    private storage: Storage
  ) { }
  getservicesByUser(userId: string): Observable<any[]> {
    const servicesRef = collection(this.firestore, 'services');
    const q = query(servicesRef, where('providerId', '==', userId));
    return collectionData(q, { idField: 'id' }) as Observable<any[]>;
  }
  getUser(userId: string): Observable<UserProfile | null> {
    const userRef = doc(this.firestore, `users/${userId}`);
    return docData(userRef, { idField: 'id' }) as Observable<UserProfile | null>;
  }

  async updateUser(userId: string, data: Partial<UserProfile>): Promise<void> {
    const userRef = doc(this.firestore, `users/${userId}`);
    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  async uploadProfileImage(userId: string, file: File): Promise<string> {
    const storageRef = ref(this.storage, `profile-images/${userId}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    await this.updateUser(userId, { photoURL: downloadURL });
    return downloadURL;
  }

  getUsersByRole(role: 'client' | 'provider'): Observable<UserProfile[]> {
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('role', '==', role));
    return collectionData(q, { idField: 'id' }) as Observable<UserProfile[]>;
  }

  searchUsers(queryStr: string): Observable<UserProfile[]> {
    const usersRef = collection(this.firestore, 'users');
    return collectionData(usersRef, { idField: 'id' }).pipe(
      map(users => {
        const searchTerm = queryStr.toLowerCase();
        return (users as UserProfile[]).filter(user =>
          user.displayName?.toLowerCase().includes(searchTerm) ||
          user.email?.toLowerCase().includes(searchTerm)
        );
      })
    );
  }

  async deleteUser(userId: string): Promise<void> {
    const batch = writeBatch(this.firestore);

    // Delete associated services
    const servicesRef = collection(this.firestore, 'services');
    const servicesQuery = query(servicesRef, where('providerId', '==', userId));
    const servicesSnap = await getDocs(servicesQuery);
    servicesSnap.forEach(doc => batch.delete(doc.ref));

    // Delete associated reviews
    const reviewsRef = collection(this.firestore, 'reviews');
    const reviewsQuery = query(reviewsRef, where('userId', '==', userId));
    const reviewsSnap = await getDocs(reviewsQuery);
    reviewsSnap.forEach(doc => batch.delete(doc.ref));

    // Delete user
    const userRef = doc(this.firestore, `users/${userId}`);
    batch.delete(userRef);

    // Delete profile image if exists
    const user = await this.getUser(userId).toPromise();
    if (user?.photoURL) {
      try {
        const photoRef = ref(this.storage, user.photoURL);
        await deleteObject(photoRef);
      } catch (error) {
        console.warn('Failed to delete profile image:', error);
      }
    }

    await batch.commit();
  }

  getProviderStats(providerId: string): Observable<ProviderStats> {
    return combineLatest([
      this.getServices(providerId),
      this.getBookings(providerId),
      this.getReviews(providerId)
    ]).pipe(
      map(([services, bookings, reviews]) => this.calculateStats(services, bookings, reviews))
    );
  }

  private getServices(providerId: string): Observable<any[]> {
    const servicesRef = collection(this.firestore, 'services');
    const q = query(servicesRef, where('providerId', '==', providerId));
    return collectionData(q, { idField: 'id' });
  }

  private getBookings(providerId: string): Observable<any[]> {
    const bookingsRef = collection(this.firestore, 'bookings');
    const q = query(bookingsRef, where('providerId', '==', providerId));
    return collectionData(q, { idField: 'id' });
  }

  private getReviews(providerId: string): Observable<UserReview[]> {
    const reviewsRef = collection(this.firestore, 'reviews');
    const q = query(reviewsRef,
      where('providerId', '==', providerId),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<UserReview[]>;
  }

  private calculateStats(services: any[], bookings: any[], reviews: UserReview[]): ProviderStats {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const categoryStats: Record<string, number> = {};
    services.forEach(service => {
      categoryStats[service.category] = (categoryStats[service.category] || 0) + 1;
    });

    const completedBookings = bookings.filter(b => b.status === 'completed');
    const totalBookings = bookings.length;
    const completionRate = totalBookings > 0 ? completedBookings.length / totalBookings : 0;

    const dailyRevenue = completedBookings
      .filter(b => new Date(b.completedAt) > dayAgo)
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    const weeklyRevenue = completedBookings
      .filter(b => new Date(b.completedAt) > weekAgo)
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    const monthlyRevenue = completedBookings
      .filter(b => new Date(b.completedAt) > monthAgo)
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    const totalRevenue = completedBookings
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    return {
      totalServices: services.length,
      activeServices: services.filter(s => s.status === 'active').length,
      totalViews: services.reduce((sum, s) => sum + (s.views || 0), 0),
      totalBookings: bookings.length,
      averageRating: reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0,
      totalReviews: reviews.length,
      revenueStats: {
        daily: dailyRevenue,
        weekly: weeklyRevenue,
        monthly: monthlyRevenue,
        total: totalRevenue
      },
      categoryStats,
      completionRate
    };
  }

  // Review Management
  async addReview(review: Omit<UserReview, 'id' | 'createdAt' | 'updatedAt' | 'likes'>): Promise<string> {
    const reviewsRef = collection(this.firestore, 'reviews');
    const id = doc(reviewsRef).id;
    const now = serverTimestamp();

    const newReview: UserReview = {
      ...review,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      likes: 0
    };

    await setDoc(doc(reviewsRef, id), newReview);
    return id;
  }

  async updateReview(reviewId: string, data: Partial<UserReview>): Promise<void> {
    const reviewRef = doc(this.firestore, `reviews/${reviewId}`);
    await updateDoc(reviewRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  getProviderReviews(providerId: string): Observable<UserReview[]> {
    const reviewsRef = collection(this.firestore, 'reviews');
    const q = query(reviewsRef,
      where('providerId', '==', providerId),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<UserReview[]>;
  }

  async respondToReview(reviewId: string, comment: string): Promise<void> {
    const reviewRef = doc(this.firestore, `reviews/${reviewId}`);
    await updateDoc(reviewRef, {
      response: {
        comment,
        createdAt: serverTimestamp()
      },
      updatedAt: serverTimestamp()
    });
  }

  async likeReview(reviewId: string): Promise<void> {
    const reviewRef = doc(this.firestore, `reviews/${reviewId}`);
    await updateDoc(reviewRef, {
      likes: increment(1)
    });
  }
}

function increment(n: number) {
  return { incrementValue: n };
}
