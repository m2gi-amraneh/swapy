import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { Platform } from '@ionic/angular';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Coordinates, Address, City } from '../models/location.model';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private citiesCollection: AngularFirestoreCollection<City>;

  constructor(
    private firestore: AngularFirestore,
    private platform: Platform
  ) {
    this.citiesCollection = this.firestore.collection<City>('cities');
  }

  // Obtenir la position actuelle de l'utilisateur
  getCurrentPosition(): Observable<Coordinates> {
    if (Capacitor.isNativePlatform() || this.platform.is('desktop')) {
      return from(Geolocation.getCurrentPosition()).pipe(
        map(position => ({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })),
        catchError(error => {
          console.error('Error getting location', error);
          // Coordonnées par défaut pour Alger
          return of({
            latitude: 36.7538,
            longitude: 3.0588
          });
        })
      );
    } else {
      // Coordonnées par défaut pour Alger
      return of({
        latitude: 36.7538,
        longitude: 3.0588
      });
    }
  }

  // Obtenir la liste des villes disponibles
  getCities(): Observable<City[]> {
    return this.citiesCollection.valueChanges({ idField: 'id' });
  }

  // Obtenir une ville par son ID
  getCity(id: string): Observable<City | null> {
    return this.citiesCollection.doc<City>(id).valueChanges({ idField: 'id' }).pipe(
      map(city => city || null)
    );
  }

  // Rechercher des villes par nom
  searchCities(query: string): Observable<City[]> {
    return this.getCities().pipe(
      map(cities => 
        cities.filter(city => 
          city.name.toLowerCase().includes(query.toLowerCase())
        )
      )
    );
  }

  // Calculer la distance entre deux coordonnées (en kilomètres)
  calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.deg2rad(coord2.latitude - coord1.latitude);
    const dLon = this.deg2rad(coord2.longitude - coord1.longitude);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(coord1.latitude)) * Math.cos(this.deg2rad(coord2.latitude)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance en km
    return distance;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // Obtenir les services à proximité (à implémenter avec Firestore GeoPoint)
  getNearbyServices(coordinates: Coordinates, radiusKm: number): Observable<any[]> {
    // Cette méthode est une simplification. Pour une implémentation réelle,
    // vous devriez utiliser une solution comme GeoFirestore
    return this.firestore.collection('services').valueChanges({ idField: 'id' }).pipe(
      map(services => {
        return services.filter((service: any) => {
          if (service.coordinates) {
            const distance = this.calculateDistance(coordinates, {
              latitude: service.coordinates.latitude,
              longitude: service.coordinates.longitude
            });
            return distance <= radiusKm;
          }
          return false;
        });
      })
    );
  }

  // Ajouter une adresse à un utilisateur
  async addUserAddress(userId: string, address: Omit<Address, 'id'>): Promise<string> {
    const id = this.firestore.createId();
    const addressWithId = { ...address, id };
    
    await this.firestore.doc(`users/${userId}`).update({
      addresses: firebase.firestore.FieldValue.arrayUnion(addressWithId)
    });
    
    return id;
  }

  // Mettre à jour une adresse d'un utilisateur
  async updateUserAddress(userId: string, address: Address): Promise<void> {
    // D'abord, récupérer l'utilisateur pour obtenir toutes les adresses
    const userDoc = await this.firestore.doc(`users/${userId}`).get().toPromise();
    if (!userDoc) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    const userData = userDoc.data() as any;
    
    if (userData && userData.addresses) {
      // Filtrer l'adresse à mettre à jour
      const updatedAddresses = userData.addresses.map((addr: Address) => {
        if (addr.id === address.id) {
          return address;
        }
        return addr;
      });
      
      // Mettre à jour le document utilisateur avec le nouveau tableau d'adresses
      await this.firestore.doc(`users/${userId}`).update({
        addresses: updatedAddresses
      });
    }
  }

  // Supprimer une adresse d'un utilisateur
  async deleteUserAddress(userId: string, addressId: string): Promise<void> {
    // D'abord, récupérer l'utilisateur pour obtenir toutes les adresses
    const userDoc = await this.firestore.doc(`users/${userId}`).get().toPromise();
    if (!userDoc) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    const userData = userDoc.data() as any;
    
    if (userData && userData.addresses) {
      // Filtrer l'adresse à supprimer
      const updatedAddresses = userData.addresses.filter((addr: Address) => addr.id !== addressId);
      
      // Mettre à jour le document utilisateur avec le nouveau tableau d'adresses
      await this.firestore.doc(`users/${userId}`).update({
        addresses: updatedAddresses
      });
    }
  }

  // Définir une adresse comme adresse par défaut
  async setDefaultAddress(userId: string, addressId: string): Promise<void> {
    // D'abord, récupérer l'utilisateur pour obtenir toutes les adresses
    const userDoc = await this.firestore.doc(`users/${userId}`).get().toPromise();
    if (!userDoc) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    const userData = userDoc.data() as any;
    
    if (userData && userData.addresses) {
      // Mettre à jour les adresses pour définir celle sélectionnée comme par défaut
      const updatedAddresses = userData.addresses.map((addr: Address) => ({
        ...addr,
        isDefault: addr.id === addressId
      }));
      
      // Mettre à jour le document utilisateur avec le nouveau tableau d'adresses
      await this.firestore.doc(`users/${userId}`).update({
        addresses: updatedAddresses
      });
    }
  }
}
