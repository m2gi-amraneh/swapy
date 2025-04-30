import { WalletService } from './../../../core/services/wallet.service';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, of, Subscription } from 'rxjs';
import { switchMap, tap, catchError, finalize } from 'rxjs/operators';

import { BookingService } from '../../../core/services/booking.service';
import { UserService } from '../../../core/services/user.service';
import { PaymentService } from '../../../core/services/payment.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';

import { Booking } from '../../../core/models/booking.model';
import { Service } from '../../../core/models/service.model';
import { UserProfile } from '../../../core/models/user.model';
import { Payment } from '../../../core/models/payment.model';

interface BookingWithService {
  booking: Booking;
  service: Service;
}

@Component({
  selector: 'app-booking-detail',
  templateUrl: './booking-detail.component.html',
  styleUrls: ['./booking-detail.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule
  ]
})
export class BookingDetailComponent implements OnInit, OnDestroy {
  bookingId: string = '';
  bookingData: BookingWithService | null = null;
  provider: UserProfile | null = null;
  payments: Payment[] = [];
  isLoading: boolean = true;
  error: string = '';
  currentUserId: string = '';
  isProvider: boolean = false;
  private subscriptions: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bookingService: BookingService,
    private userService: UserService,
    private paymentService: PaymentService,
    private toastService: ToastService,
    private authService: AuthService, private WalletService: WalletService
  ) { }

  ngOnInit() {
    console.log('BookingDetailComponent initialized');
    const bookingIdParam = this.route.snapshot.paramMap.get('id');

    if (!bookingIdParam) {
      this.toastService.showError('Réservation introuvable');
      this.router.navigate(['/bookings']);
      return;
    }

    this.bookingId = bookingIdParam;

    // Get current user
    const authSub = this.authService.getCurrentUser().subscribe(user => {
      if (user) {
        this.currentUserId = user.uid;
        this.loadBookingData();
      }
    });

    this.subscriptions.add(authSub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }



  getStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'confirmed':
        return 'primary';
      case 'completed':
        return 'success';
      case 'canceled':
        return 'danger';
      default:
        return 'medium';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'confirmed':
        return 'Confirmée';
      case 'completed':
        return 'Terminée';
      case 'canceled':
        return 'Annulée';
      default:
        return 'Inconnu';
    }
  }

  getPaymentStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'completed':
        return 'success';
      case 'failed':
        return 'danger';
      default:
        return 'medium';
    }
  }

  getPaymentStatusLabel(status: string): string {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'completed':
        return 'Complété';
      case 'failed':
        return 'Échoué';
      default:
        return 'Inconnu';
    }
  }

  getPaymentMethodLabel(method: string): string {
    switch (method) {
      case 'cash':
        return 'Espèces';
      case 'wallet':
        return 'Portefeuille électronique';
      case 'baridiMob':
        return 'BaridiMob';
      case 'edahabia':
        return 'EDAHABIA';
      default:
        return 'Autre';
    }
  }
  loadBookingData() {
    if (!this.bookingId) return;

    this.isLoading = true;
    this.error = '';

    console.log('Loading booking data for ID:', this.bookingId);

    const bookingSub = this.bookingService.getBookingWithService(this.bookingId).pipe(
      tap(data => {
        console.log('Booking data loaded:', data);
        this.bookingData = data;

        // Determine if current user is the provider
        if (data && data.booking.providerId === this.currentUserId) {
          this.isProvider = true;
        } else {
          this.isProvider = false;
        }

        // Load provider details
        if (data && data.booking.providerId) {
          this.loadProviderDetails(data.booking.providerId);
        }

        // Load payment information if available
        if (data && data.booking.id) {
          this.loadPayments(data.booking.id);
        }
      }),
      catchError(err => {
        console.error('Error loading booking details:', err);
        this.error = 'Failed to load booking details. Please try again.';
        return of(null);
      }),
      finalize(() => {
        console.log('Finalize called, setting isLoading to false');
        this.isLoading = false;
      })
    ).subscribe({
      error: (err) => {
        console.error('Subscription error:', err);
        this.isLoading = false;
      }
    });

    this.subscriptions.add(bookingSub);
  }

  private loadProviderDetails(providerId: string) {
    const providerSub = this.userService.getUser(providerId).subscribe(
      provider => {
        this.provider = provider;
      },
      error => {
        console.error('Error loading provider details:', error);
      }
    );

    this.subscriptions.add(providerSub);
  }

  private loadPayments(bookingId: string) {
    const paymentSub = this.paymentService.getPaymentsByBookingId(bookingId).subscribe(
      payments => {
        this.payments = payments;
      },
      error => {
        console.error('Error loading payment details:', error);
      }
    );

    this.subscriptions.add(paymentSub);
  }

  async acceptBooking() {
    if (!this.bookingId) return;

    try {
      await this.bookingService.updateBookingStatus(this.bookingId, 'confirmed');
      this.toastService.showSuccess('Réservation acceptée avec succès');
      this.loadBookingData();
    } catch (error: any) {
      this.toastService.showError(error.message || 'Erreur lors de l\'acceptation de la réservation');
    }
  }
  async completeBooking() {
    if (!this.bookingId) return;

    try {
      await this.bookingService.updateBookingStatus(this.bookingId, 'completed', JSON.stringify({
        clientCompletedAt: Date.now(),
        completedAt: Date.now()
      }));
      this.toastService.showSuccess('Service confirmé comme terminé');
      this.loadBookingData();
    } catch (error: any) {
      this.toastService.showError(error.message || 'Erreur lors de la confirmation du service');
    }
  }
  async markAwaitingCompletion() {
    if (!this.bookingId) return;

    try {
      // Update booking status to awaiting_completion
      await this.bookingService.updateBookingStatus(this.bookingId, 'awaiting_completion');
      if (this.bookingData && this.bookingData.booking.providerId) {
        this.WalletService.getuserwalletid(this.bookingData?.booking.providerId).subscribe((walletId) => {
          if (walletId) {
            if (this.bookingData?.booking.totalPrice !== undefined) {
              this.WalletService.addFunds(walletId, this.bookingData.booking.totalPrice);
            }
          }
        });

      }

      this.toastService.showSuccess('Service marqué comme en attente de validation');
      this.loadBookingData();
    } catch (error: any) {
      this.toastService.showError(error.message || 'Erreur lors du changement de statut');
    }
  }


}


