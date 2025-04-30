import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Favorite } from '../models/favorite.model';
import { Service } from '../models/service.model';

@Injectable({
  providedIn: 'root'
})
export class FavoriteService {
  private favoritesCollection: AngularFirestoreCollection<Favorite>;

  constructor(
    private firestore: AngularFirestore
  ) {
    this.favoritesCollection = this.firestore.collection<Favorite>('favorites');
  }

  getFavorites(userId: string): Observable<Favorite[]> {
    return this.firestore.collection<Favorite>('favorites', ref => 
      ref.where('userId', '==', userId)
    ).valueChanges({ idField: 'id' });
  }

  getFavoriteServices(userId: string): Observable<Service[]> {
    return this.getFavorites(userId).pipe(
      switchMap(favorites => {
        if (favorites.length === 0) {
          return of([]);
        }
        
        const serviceIds = favorites.map(fav => fav.serviceId);
        
        return this.firestore.collection<Service>('services', ref => 
          ref.where('id', 'in', serviceIds)
        ).valueChanges({ idField: 'id' });
      })
    );
  }

  isFavorite(userId: string, serviceId: string): Observable<boolean> {
    return this.firestore.collection<Favorite>('favorites', ref => 
      ref.where('userId', '==', userId)
        .where('serviceId', '==', serviceId)
        .limit(1)
    ).valueChanges().pipe(
      map(favorites => favorites.length > 0)
    );
  }

  async addFavorite(userId: string, serviceId: string): Promise<string> {
    // Vérifier d'abord si le favori existe déjà
    const existing = await this.firestore.collection<Favorite>('favorites', ref => 
      ref.where('userId', '==', userId)
        .where('serviceId', '==', serviceId)
        .limit(1)
    ).get().toPromise();
    
    if (existing && !existing.empty) {
      return existing.docs[0].id;
    }
    
    // Créer un nouveau favori
    const id = this.firestore.createId();
    const timestamp = Date.now();
    
    await this.favoritesCollection.doc(id).set({
      id,
      userId,
      serviceId,
      createdAt: timestamp
    });
    
    return id;
  }

  async removeFavorite(userId: string, serviceId: string): Promise<void> {
    const favoritesSnapshot = await this.firestore.collection<Favorite>('favorites', ref => 
      ref.where('userId', '==', userId)
        .where('serviceId', '==', serviceId)
    ).get().toPromise();
    
    if (!favoritesSnapshot || favoritesSnapshot.empty) {
      return;
    }
    
    const batch = this.firestore.firestore.batch();
    
    favoritesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    return batch.commit();
  }

  async toggleFavorite(userId: string, serviceId: string): Promise<boolean> {
    const isFav = await this.isFavorite(userId, serviceId).toPromise();
    
    if (isFav) {
      await this.removeFavorite(userId, serviceId);
      return false;
    } else {
      await this.addFavorite(userId, serviceId);
      return true;
    }
  }
}
