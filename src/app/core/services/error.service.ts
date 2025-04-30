import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ErrorService {
  constructor(
    private firestore: AngularFirestore,
    private toastController: ToastController
  ) {}

  handleError(error: any, source: string = 'unknown'): Observable<never> {
    // Log error to console
    console.error(`Error in ${source}:`, error);
    
    // Log error to Firestore in production
    if (environment.production) {
      this.logErrorToFirestore(error, source);
    }
    
    // Show toast with error message
    this.showErrorToast(error);
    
    // Return throwError observable
    return throwError(() => error);
  }

  private async logErrorToFirestore(error: any, source: string): Promise<void> {
    try {
      const timestamp = Date.now();
      await this.firestore.collection('errors').add({
        message: error.message || 'Unknown error',
        code: error.code || 'UNKNOWN',
        stack: error.stack,
        source,
        timestamp,
        environment: environment.production ? 'production' : 'development'
      });
    } catch (e) {
      console.error('Failed to log error to Firestore:', e);
    }
  }

  private async showErrorToast(error: any): Promise<void> {
    const toast = await this.toastController.create({
      message: this.getReadableErrorMessage(error),
      duration: 3000,
      position: 'bottom',
      color: 'danger',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    
    await toast.present();
  }

  private getReadableErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }
    
    if (error.message) {
      return this.translateFirebaseError(error.code, error.message);
    }
    
    return 'Une erreur est survenue. Veuillez réessayer.';
  }

  private translateFirebaseError(code: string, message: string): string {
    if (!code) return message;
    
    // Traduire les erreurs Firebase courantes
    switch (code) {
      case 'auth/user-not-found':
        return 'Aucun utilisateur trouvé avec cet email.';
      case 'auth/wrong-password':
        return 'Mot de passe incorrect.';
      case 'auth/email-already-in-use':
        return 'Cet email est déjà utilisé par un autre compte.';
      case 'auth/weak-password':
        return 'Le mot de passe est trop faible.';
      case 'auth/invalid-email':
        return 'Format d\'email invalide.';
      case 'auth/user-disabled':
        return 'Ce compte a été désactivé.';
      case 'auth/requires-recent-login':
        return 'Veuillez vous reconnecter pour effectuer cette action.';
      case 'permission-denied':
        return 'Vous n\'avez pas les permissions nécessaires pour cette action.';
      default:
        return message;
    }
  }

  async showSuccessToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color: 'success'
    });
    
    await toast.present();
  }

  async showInfoToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color: 'primary'
    });
    
    await toast.present();
  }

  async showWarningToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: 'warning'
    });
    
    await toast.present();
  }
}
