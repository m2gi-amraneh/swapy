import { Injectable } from '@angular/core';
import {
  Firestore, // Import the Firestore instance type
  collection, // Function to get a collection reference
  doc, // Function to get a document reference
  setDoc, // Function to set document data (create or overwrite)
  updateDoc, // Function to update a document
  deleteDoc, // Function to delete a document (used in batch)
  collectionData, // Function to get collection data as an Observable
  query, // Function to create a query
  where, // Function to add a where clause
  orderBy, // Function to add an order by clause
  limit, // Function to add a limit clause
  Timestamp, // Firebase Timestamp type
  increment, // Function to increment a numeric value atomically
  writeBatch, // Function to create a write batch
  getDocs, // Function to get documents based on a query (one-time read)
  getCountFromServer, // Function to get the count of documents matching a query efficiently
  serverTimestamp // Function to get server timestamp (alternative to Timestamp.now())
} from '@angular/fire/firestore'; // Use the non-compat version
import { Observable, from } from 'rxjs'; // Keep rxjs imports
import { map, switchMap, take, catchError } from 'rxjs/operators';
import { ServiceView } from '../models/service-view.model'; // Assuming this model is correct
import { AuthService } from './auth.service'; // Assuming AuthService is v9 compatible or provides user$ correctly

@Injectable({
  providedIn: 'root'
})
export class ServiceViewService {

  // No need for a specific collection member, we'll get references dynamically
  // private serviceViewsCollection: AngularFirestoreCollection<ServiceView>; <-- Remove this

  constructor(
    private firestore: Firestore, // Inject the v9 Firestore instance
    private authService: AuthService
  ) {
    // No need to initialize collection here
  }

  /**
   * Gets a reference to the serviceViews collection.
   * Private helper for convenience.
   */
  private get viewsCollectionRef() {
    return collection(this.firestore, 'serviceViews');
  }

  /**
   * Gets a reference to the services collection.
   * Private helper for convenience.
   */
  private get servicesCollectionRef() {
    return collection(this.firestore, 'services');
  }

  // --- Merged Recording Logic ---

  /**
   * Records a view for a service, optionally capturing the source,
   * and increments the service's view count.
   * @param serviceId ID of the service consulted
   * @param source Source of the view (e.g., 'card-click', 'search-result', 'direct-view')
   * @returns Promise<string> The ID of the newly created view record.
   */
  recordServiceView(serviceId: string, source: string = 'direct-view'): Promise<string> {
    return new Promise((resolve, reject) => {
      this.authService.user$.pipe(
        take(1), // Take only the current user state once
        switchMap(user => {
          const userId = user?.uid || 'anonymous';
          const viewId = doc(this.viewsCollectionRef).id; // Generate ID upfront
          const viewDocRef = doc(this.viewsCollectionRef, viewId); // Get ref with ID

          const viewData: ServiceView = {
            id: viewId,
            userId,
            serviceId,
            viewedAt: Timestamp.now().toDate(), // Convert Firebase Timestamp to JavaScript Date
            source: source || undefined // Store undefined if source is empty/undefined
            // duration is not set initially
          };

          // Create tasks for setting the view and updating the counter
          const setViewPromise = setDoc(viewDocRef, viewData);
          const updateCounterPromise = this.incrementServiceViewCount(serviceId);

          // Run both tasks
          return from(Promise.all([setViewPromise, updateCounterPromise]).then(() => viewId));
        }),
        catchError(error => {
          console.error('Error recording service view:', error);
          reject(error); // Propagate the error
          return []; // Return empty observable on error for pipe completion
        })
      ).subscribe({
        next: (viewId) => resolve(viewId), // Resolve the promise with the viewId
        error: (err) => reject(err) // Should be caught by catchError, but good practice
      });
    });
  }

  /**
   * Increments the view count for a specific service.
   * Private helper method.
   * @param serviceId
   * @returns Promise<void>
   */
  private async incrementServiceViewCount(serviceId: string): Promise<void> {
    const serviceDocRef = doc(this.servicesCollectionRef, serviceId);
    try {
      // Use increment for atomic update
      await updateDoc(serviceDocRef, {
        views: increment(1)
      });
    } catch (error) {
      // Log error but don't necessarily fail the whole view recording
      // Maybe the service doc doesn't exist, or permissions issue
      console.error(`Error incrementing view count for service ${serviceId}:`, error);
      // Optionally: Check if error is 'document not found' and handle appropriately
    }
  }


  /**
   * Updates the duration of a view.
   * @param viewId ID of the view
   * @param duration Duration in seconds
   * @returns Promise<void>
   */
  async updateViewDuration(viewId: string, duration: number): Promise<void> {
    const viewDocRef = doc(this.viewsCollectionRef, viewId);
    try {
      return await updateDoc(viewDocRef, { duration });
    } catch (error) {
      console.error(`Error updating duration for view ${viewId}:`, error);
      throw error; // Re-throw error to indicate failure
    }
  }

  /**
   * Récupère les vues d'un utilisateur
   * @param userId ID de l'utilisateur
   * @param count Nombre maximum de vues à récupérer
   * @returns Observable<ServiceView[]>
   */
  getUserServiceViews(userId: string, count: number = 50): Observable<ServiceView[]> {
    const q = query(
      this.viewsCollectionRef,
      where('userId', '==', userId),
      orderBy('viewedAt', 'desc'),
      limit(count)
    );
    // Use collectionData with idField to include the document ID
    // Cast needed as collectionData returns DocumentData[] by default
    return collectionData(q, { idField: 'id' }) as Observable<ServiceView[]>;
  }

  /**
   * Récupère les vues d'un service
   * @param serviceId ID du service
   * @param count Nombre maximum de vues à récupérer
   * @returns Observable<ServiceView[]>
   */
  getServiceViews(serviceId: string, count: number = 50): Observable<ServiceView[]> {
    const q = query(
      this.viewsCollectionRef,
      where('serviceId', '==', serviceId),
      orderBy('viewedAt', 'desc'),
      limit(count)
    );
    return collectionData(q, { idField: 'id' }) as Observable<ServiceView[]>;
  }

  /**
   * Récupère le nombre total de vues d'un service (efficacement).
   * Note: This performs a one-time read for the count.
   * @param serviceId ID du service
   * @returns Promise<number>
   */
  async getServiceViewCount(serviceId: string): Promise<number> {
    const q = query(
      this.viewsCollectionRef,
      where('serviceId', '==', serviceId)
    );
    try {
      const snapshot = await getCountFromServer(q);
      return snapshot.data().count;
    } catch (error) {
      console.error(`Error getting view count for service ${serviceId}:`, error);
      return 0; // Return 0 on error
    }
  }

  /**
   * Récupère les services les plus vus sur une période donnée.
   * Note: This reads potentially many view documents and aggregates client-side.
   * Consider server-side aggregation (e.g., Cloud Functions) for very large datasets.
   * @param count Nombre maximum de services à récupérer
   * @param days Nombre de jours à considérer (par défaut: 30 jours)
   * @returns Observable<{serviceId: string, viewCount: number}[]>
   */
  getMostViewedServices(count: number = 10, days: number = 30): Observable<{ serviceId: string; viewCount: number }[]> {
    const cutoffMillis = Date.now() - (days * 24 * 60 * 60 * 1000);
    const cutoffDate = Timestamp.fromMillis(cutoffMillis); // Use Timestamp

    const q = query(
      this.viewsCollectionRef,
      where('viewedAt', '>=', cutoffDate)
      // Note: No ordering needed here, we aggregate client-side
    );

    // Use collectionData (without idField needed for this aggregation)
    return collectionData(q).pipe(
      map(views => {
        // Count views per service
        const viewCounts: Record<string, number> = {};
        // Ensure we are iterating over the correct type
        (views as ServiceView[]).forEach(view => {
          if (view.serviceId) { // Basic check
            viewCounts[view.serviceId] = (viewCounts[view.serviceId] || 0) + 1;
          }
        });

        // Convert to array, sort, and slice
        return Object.entries(viewCounts)
          .map(([serviceId, viewCount]) => ({ serviceId, viewCount }))
          .sort((a, b) => b.viewCount - a.viewCount) // Sort descending by count
          .slice(0, count); // Take top 'count'
      })
    );
  }

  /**
   * Supprime les anciennes vues (plus vieilles que X jours) en utilisant des lots.
   * @param days Nombre de jours à conserver
   * @returns Promise<void>
   */
  async cleanupOldViews(days: number = 90): Promise<void> {
    const cutoffMillis = Date.now() - (days * 24 * 60 * 60 * 1000);
    const cutoffDate = Timestamp.fromMillis(cutoffMillis); // Use Timestamp

    // Query for documents older than the cutoff, limit to batch size
    const q = query(
      this.viewsCollectionRef,
      where('viewedAt', '<', cutoffDate),
      limit(500) // Firestore batch limit
    );

    try {
      const snapshot = await getDocs(q); // One-time read

      if (snapshot.empty) {
        console.log("No old views found to clean up.");
        return; // Nothing to delete
      }

      // Create a batch
      const batch = writeBatch(this.firestore);
      snapshot.docs.forEach(docSnapshot => {
        batch.delete(docSnapshot.ref); // Add delete operation to batch
      });

      // Commit the batch
      await batch.commit();
      console.log(`Successfully deleted ${snapshot.size} old view(s).`);

      // If we hit the limit, there might be more, so run again recursively
      if (snapshot.size === 500) {
        console.log("Potentially more views to clean up, running again...");
        // Add a small delay to prevent potential infinite loops or hitting quotas too fast
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.cleanupOldViews(days);
      }

    } catch (error) {
      console.error("Error cleaning up old views:", error);
      throw error; // Re-throw error
    }
  }
}
