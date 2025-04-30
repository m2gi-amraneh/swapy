import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Observable, from, combineLatest, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { Review } from '../models/review.model';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private reviewsCollection: AngularFirestoreCollection<Review>;

  constructor(
    private firestore: AngularFirestore,
    private storage: AngularFireStorage
  ) {
    this.reviewsCollection = this.firestore.collection<Review>('reviews');
  }

  getReviews(): Observable<Review[]> {
    return this.reviewsCollection.valueChanges({ idField: 'id' });
  }

  getReviewsByService(serviceId: string): Observable<Review[]> {
    return this.firestore.collection<Review>('reviews', ref => 
      ref.where('serviceId', '==', serviceId).orderBy('createdAt', 'desc')
    ).valueChanges({ idField: 'id' });
  }

  getReviewsByProvider(providerId: string): Observable<Review[]> {
    return this.firestore.collection<Review>('reviews', ref => 
      ref.where('providerId', '==', providerId).orderBy('createdAt', 'desc')
    ).valueChanges({ idField: 'id' });
  }

  getReviewsByClient(clientId: string): Observable<Review[]> {
    return this.firestore.collection<Review>('reviews', ref => 
      ref.where('clientId', '==', clientId).orderBy('createdAt', 'desc')
    ).valueChanges({ idField: 'id' });
  }

  getReview(id: string): Observable<Review | null> {
    return this.reviewsCollection.doc<Review>(id).valueChanges({ idField: 'id' }).pipe(
      map(review => review || null)
    );
  }

  async createReview(review: Omit<Review, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const timestamp = Date.now();
    const id = this.firestore.createId();
    
    await this.reviewsCollection.doc(id).set({
      ...review,
      id,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    
    // Update provider's average rating
    await this.updateProviderAverageRating(review.providerId);
    
    return id;
  }

  async updateReview(id: string, review: Partial<Review>): Promise<void> {
    const timestamp = Date.now();
    await this.reviewsCollection.doc(id).update({
      ...review,
      updatedAt: timestamp
    });
    
    // Get the full review to get the providerId
    const fullReview = await this.reviewsCollection.doc<Review>(id).get().toPromise();
    if (!fullReview) {
      throw new Error(`Review with ID ${id} not found`);
    }
    
    if (fullReview.exists && fullReview.data()) {
      await this.updateProviderAverageRating(fullReview.data()!.providerId);
    }
  }

  async deleteReview(id: string): Promise<void> {
    // Get the review first to get the providerId
    const review = await this.reviewsCollection.doc<Review>(id).get().toPromise();
    if (!review) {
      throw new Error(`Review with ID ${id} not found`);
    }
    
    if (review.exists && review.data()) {
      const providerId = review.data()!.providerId;
      
      // Delete the review
      await this.reviewsCollection.doc(id).delete();
      
      // Update provider's average rating
      await this.updateProviderAverageRating(providerId);
    }
  }

  async addProviderResponse(reviewId: string, comment: string): Promise<void> {
    const timestamp = Date.now();
    return this.reviewsCollection.doc(reviewId).update({
      providerResponse: {
        comment,
        createdAt: timestamp
      },
      updatedAt: timestamp
    });
  }

  async uploadReviewPhoto(reviewId: string, file: File): Promise<string> {
    const path = `reviews/${reviewId}/${Date.now()}_${file.name}`;
    const ref = this.storage.ref(path);
    const task = this.storage.upload(path, file);
    
    await task.snapshotChanges().pipe(take(1)).toPromise();
    const downloadUrl = await ref.getDownloadURL().toPromise();
    
    // Récupérer le document actuel pour obtenir les photos existantes
    const reviewDoc = await this.reviewsCollection.doc(reviewId).get().toPromise();
    if (!reviewDoc) {
      throw new Error(`Review with ID ${reviewId} not found`);
    }
    
    const reviewData = reviewDoc.data();
    const photos = reviewData && reviewData.photos ? [...reviewData.photos, downloadUrl] : [downloadUrl];
    
    await this.reviewsCollection.doc(reviewId).update({
      photos: photos
    });
    
    return downloadUrl;
  }

  private async updateProviderAverageRating(providerId: string): Promise<void> {
    // Get all reviews for this provider
    const reviews = await this.firestore.collection<Review>('reviews', ref => 
      ref.where('providerId', '==', providerId)
    ).get().toPromise();
    
    if (!reviews) {
      throw new Error(`Failed to retrieve reviews for provider ${providerId}`);
    }
    
    if (reviews.empty) {
      // No reviews, set average to 0
      await this.firestore.doc(`users/${providerId}`).update({
        averageRating: 0,
        reviewCount: 0
      });
      return;
    }
    
    // Calculate average rating
    let sum = 0;
    reviews.forEach(doc => {
      sum += doc.data().rating;
    });
    const average = sum / reviews.size;
    
    // Update provider document
    await this.firestore.doc(`users/${providerId}`).update({
      averageRating: average,
      reviewCount: reviews.size
    });
  }

  // Récupérer les revues avec les informations de l'utilisateur
  getReviewsWithUserData(serviceId: string): Observable<any[]> {
    return this.getReviewsByService(serviceId).pipe(
      switchMap(reviews => {
        if (reviews.length === 0) {
          return of([]);
        }

        const userIds = reviews.map(review => review.clientId);
        const uniqueUserIds = [...new Set(userIds)];

        return combineLatest([
          of(reviews),
          combineLatest(
            uniqueUserIds.map(userId => 
              this.firestore.doc(`users/${userId}`).valueChanges().pipe(
                map(user => ({ userId, userData: user || null }))
              )
            )
          )
        ]).pipe(
          map(([reviews, users]) => {
            const userMap = users.reduce((acc, user) => {
              acc[user.userId] = user.userData;
              return acc;
            }, {} as Record<string, any>);

            return reviews.map(review => ({
              ...review,
              user: userMap[review.clientId] || null
            }));
          })
        );
      })
    );
  }

  // Récupérer les statistiques des revues pour un service
  getReviewStats(serviceId: string): Observable<{
    averageRating: number;
    totalReviews: number;
    ratingCounts: Record<number, number>;
  }> {
    return this.getReviewsByService(serviceId).pipe(
      map(reviews => {
        const totalReviews = reviews.length;
        
        if (totalReviews === 0) {
          return {
            averageRating: 0,
            totalReviews: 0,
            ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
          };
        }

        // Calculer la moyenne
        const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
        const averageRating = sum / totalReviews;

        // Compter les occurrences de chaque note
        const ratingCounts = reviews.reduce((acc, review) => {
          const rating = review.rating;
          acc[rating] = (acc[rating] || 0) + 1;
          return acc;
        }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>);

        return {
          averageRating,
          totalReviews,
          ratingCounts
        };
      })
    );
  }
}
