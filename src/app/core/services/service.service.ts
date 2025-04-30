import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Service } from '../models/service.model';
import { ServiceViewService } from './service-view.service';
import { 
  Firestore, 
  collection, 
  doc, 
  collectionData, 
  docData, 
  query, 
  where, 
  orderBy, 
  limit as limitQuery, 
  setDoc, 
  updateDoc
} from '@angular/fire/firestore';

export interface ServiceSearchParams {
  query?: string;
  categories?: string[];
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  sortBy?: 'price' | 'rating' | 'date';
  sortDirection?: 'asc' | 'desc';
  location?: string;
  limit?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ServiceService {
  constructor(
    private firestore: Firestore,
    private serviceViewService: ServiceViewService
  ) {}

  /**
   * Récupère un service par son ID
   */
  getService(id: string): Observable<Service | null> {
    const serviceRef = doc(this.firestore, `services/${id}`);
    return docData(serviceRef) as Observable<Service | null>;
  }

  /**
   * Récupère les services d'un prestataire
   */
  getServicesByProviderId(providerId: string): Observable<Service[]> {
    const servicesRef = collection(this.firestore, 'services');
    const servicesQuery = query(
      servicesRef, 
      where('providerId', '==', providerId),
      orderBy('createdAt', 'desc')
    );
    
    return collectionData(servicesQuery, { idField: 'id' }) as Observable<Service[]>;
  }

  /**
   * Récupère tous les services
   */
  getServices(): Observable<Service[]> {
    const servicesRef = collection(this.firestore, 'services');
    const servicesQuery = query(servicesRef, orderBy('createdAt', 'desc'));
    
    return collectionData(servicesQuery, { idField: 'id' }) as Observable<Service[]>;
  }

  /**
   * Récupère les services par catégorie
   */
  getServicesByCategory(category: string): Observable<Service[]> {
    const servicesRef = collection(this.firestore, 'services');
    const servicesQuery = query(
      servicesRef, 
      where('category', '==', category),
      orderBy('createdAt', 'desc')
    );
    
    return collectionData(servicesQuery, { idField: 'id' }) as Observable<Service[]>;
  }

  /**
   * Récupère toutes les catégories de services
   */
  getCategories(): Observable<string[]> {
    const servicesRef = collection(this.firestore, 'services');
    
    return collectionData(servicesRef).pipe(
      map(services => {
        // Extraire les catégories uniques
        const categoriesSet = new Set(services.map(service => (service as Service).category));
        const categories = Array.from(categoriesSet);
        return categories.sort();
      })
    );
  }

  /**
   * Crée un nouveau service
   */
  async createService(service: Partial<Service>): Promise<string> {
    const servicesRef = collection(this.firestore, 'services');
    const id = doc(servicesRef).id;
    const now = new Date();
    
    const newService: Service = {
      ...service,
      id,
      createdAt: now.getTime(),
      updatedAt: now.getTime(),
      views: 0,
      status: 'pending'
    } as Service;

    const serviceDocRef = doc(this.firestore, `services/${id}`);
    await setDoc(serviceDocRef, newService);
    return id;
  }

  /**
   * Met à jour un service existant
   */
  async updateService(id: string, service: Partial<Service>): Promise<void> {
    const serviceDocRef = doc(this.firestore, `services/${id}`);
    const updatedService = {
      ...service,
      updatedAt: new Date().getTime()
    };

    return updateDoc(serviceDocRef, updatedService);
  }

  /**
   * Supprime un service
   */
  async deleteService(serviceId: string): Promise<void> {
    const serviceDocRef = doc(this.firestore, `services/${serviceId}`);
    return updateDoc(serviceDocRef, { status: 'deleted', updatedAt: new Date().getTime() });
  }

  /**
   * Recherche simple de services par terme de recherche
   * @param query Terme de recherche
   * @returns Observable de services correspondants
   */
  searchServices(query: string | ServiceSearchParams): Observable<Service[]> {
    // Si query est une chaîne, on convertit en objet ServiceSearchParams
    if (typeof query === 'string') {
      const params: ServiceSearchParams = { query };
      return this.searchServicesWithParams(params);
    }
    
    // Sinon, on utilise l'objet ServiceSearchParams directement
    return this.searchServicesWithParams(query);
  }

  /**
   * Méthode interne pour la recherche de services avec des paramètres
   * @param params Paramètres de recherche
   * @returns Observable de services correspondants
   */
  private searchServicesWithParams(params: ServiceSearchParams): Observable<Service[]> {
    const servicesRef = collection(this.firestore, 'services');
    
    // Commencer avec une requête de base
    let servicesQuery = query(servicesRef);
    
    // Construire la requête de manière optimisée
    if (params.categories && params.categories.length === 1) {
      servicesQuery = query(servicesQuery, where('category', '==', params.categories[0]));
    }
    
    // Le tri côté serveur est possible si applicable
    if (params.sortBy === 'date') {
      const direction = params.sortDirection === 'desc' ? 'desc' : 'asc';
      servicesQuery = query(servicesQuery, orderBy('createdAt', direction));
    } else if (params.sortBy === 'price') {
      const direction = params.sortDirection === 'desc' ? 'desc' : 'asc';
      servicesQuery = query(servicesQuery, orderBy('price', direction));
    }
    
    // Appliquer une limite si spécifiée
    if (params.limit && params.limit > 0) {
      servicesQuery = query(servicesQuery, limitQuery(params.limit));
    }
    
    return collectionData(servicesQuery, { idField: 'id' }).pipe(
      map(services => {
        let filteredServices = services as Service[];

        // Filtrage côté client pour les critères complexes
        if (params.query) {
          const searchTerms = params.query.toLowerCase().split(' ');
          filteredServices = filteredServices.filter(service => {
            const searchText = `${service.name} ${service.description} ${service.category}`.toLowerCase();
            return searchTerms.every(term => searchText.includes(term));
          });
        }

        // Filtrage par catégories multiples (si non traité côté serveur)
        if (params.categories && params.categories.length > 1) {
          filteredServices = filteredServices.filter(service => 
            params.categories!.includes(service.category)
          );
        }

        if (params.priceMin !== undefined) {
          filteredServices = filteredServices.filter(service => 
            service.price >= params.priceMin!
          );
        }

        if (params.priceMax !== undefined) {
          filteredServices = filteredServices.filter(service => 
            service.price <= params.priceMax!
          );
        }

        if (params.rating !== undefined) {
          filteredServices = filteredServices.filter(service => {
            if (!service.ratings || service.ratings.length === 0) return false;
            const avgRating = service.ratings.reduce((a, b) => a + b, 0) / service.ratings.length;
            return avgRating >= params.rating!;
          });
        }

        if (params.location) {
          filteredServices = filteredServices.filter(service => 
            service.location && service.location.toLowerCase().includes(params.location!.toLowerCase())
          );
        }

        // Tri côté client si non déjà fait côté serveur
        if (params.sortBy === 'rating') {
          filteredServices = this.sortServices(filteredServices, 'rating', params.sortDirection || 'asc');
        } else if ((params.sortBy === 'price' || params.sortBy === 'date') && !params.sortDirection) {
          // Si le tri est déjà fait côté serveur mais sans direction spécifiée
          filteredServices = this.sortServices(filteredServices, params.sortBy, 'asc');
        }

        return filteredServices;
      })
    );
  }

  /**
   * Recherche avancée de services avec filtres et tri
   * Alias pour searchServices pour maintenir la compatibilité avec les composants existants
   */
  searchServicesAdvanced(params: ServiceSearchParams): Observable<Service[]> {
    return this.searchServices(params);
  }

  /**
   * Récupère des services similaires à un service donné
   * @param service Le service de référence
   * @param maxResults Nombre maximum de services à retourner (par défaut 5)
   * @returns Observable de services similaires
   */
  getSimilarServices(service: Service, maxResults: number = 5): Observable<Service[]> {
    const servicesRef = collection(this.firestore, 'services');
    const servicesQuery = query(
      servicesRef,
      where('category', '==', service.category),
      where('id', '!=', service.id),
      limitQuery(maxResults + 5)
    );
    
    return collectionData(servicesQuery, { idField: 'id' }).pipe(
      map(services => {
        const servicesArray = services as Service[];
        
        // Filtrer les services du même prestataire
        const otherProviderServices = servicesArray.filter(s => s.providerId !== service.providerId);
        
        // Si on a assez de services d'autres prestataires, on les prend en priorité
        if (otherProviderServices.length >= maxResults) {
          return otherProviderServices.slice(0, maxResults);
        }
        
        // Sinon, on complète avec des services du même prestataire
        const sameProviderServices = servicesArray.filter(s => s.providerId === service.providerId);
        return [
          ...otherProviderServices,
          ...sameProviderServices.slice(0, maxResults - otherProviderServices.length)
        ];
      })
    );
  }

  /**
   * Trie une liste de services selon un critère et une direction
   */
  private sortServices(services: Service[], sortBy: 'price' | 'rating' | 'date', direction: 'asc' | 'desc'): Service[] {
    return [...services].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'rating':
          const aRating = a.ratings && a.ratings.length > 0 
            ? a.ratings.reduce((a, b) => a + b, 0) / a.ratings.length 
            : 0;
          const bRating = b.ratings && b.ratings.length > 0 
            ? b.ratings.reduce((sum, r) => sum + r, 0) / b.ratings.length 
            : 0;
          comparison = aRating - bRating;
          break;
        case 'date':
          comparison = a.createdAt - b.createdAt;
          break;
      }
      
      return direction === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Récupère les services les plus consultés
   * @param maxResults Nombre maximum de services à retourner
   */
  getMostViewedServices(maxResults: number = 10): Observable<Service[]> {
    const servicesRef = collection(this.firestore, 'services');
    const servicesQuery = query(servicesRef, orderBy('views', 'desc'), limitQuery(maxResults));
    
    return collectionData(servicesQuery, { idField: 'id' }) as Observable<Service[]>;
  }

  /**
   * Récupère les services mis en avant
   * @param maxResults Nombre maximum de services à retourner
   * @returns Observable de services mis en avant
   */
  getFeaturedServices(maxResults: number = 10): Observable<Service[]> {
    const servicesRef = collection(this.firestore, 'services');
    const servicesQuery = query(servicesRef, where('featured', '==', true), limitQuery(maxResults));
    
    return collectionData(servicesQuery, { idField: 'id' }) as Observable<Service[]>;
  }

  /**
   * Récupère les services récemment ajoutés
   * @param maxResults Nombre maximum de services à retourner
   * @returns Observable de services récents
   */
  getRecentServices(maxResults: number = 10): Observable<Service[]> {
    const servicesRef = collection(this.firestore, 'services');
    const servicesQuery = query(servicesRef, orderBy('createdAt', 'desc'), limitQuery(maxResults));
    
    return collectionData(servicesQuery, { idField: 'id' }) as Observable<Service[]>;
  }

  /**
   * Récupère les services les mieux notés
   * @param maxResults Nombre maximum de services à retourner
   */
  getTopRatedServices(maxResults: number = 10): Observable<Service[]> {
    const servicesRef = collection(this.firestore, 'services');
    
    return collectionData(servicesRef, { idField: 'id' }).pipe(
      map(services => {
        const servicesArray = services as Service[];
        return servicesArray
          .filter(service => (service.ratings || []).length > 0)
          .sort((a, b) => {
            const aRatings = a.ratings || [];
            const bRatings = b.ratings || [];
            const aAvg = aRatings.reduce((sum, r) => sum + r, 0) / aRatings.length;
            const bAvg = bRatings.reduce((sum, r) => sum + r, 0) / bRatings.length;
            return bAvg - aAvg;
          })
          .slice(0, maxResults);
      })
    );
  }
}