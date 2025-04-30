import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';
import { Service } from '../../core/models/service.model';
import { UserProfile } from '../../core/models/user.model';
import { ServiceService } from '../../core/services/service.service';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { BookingService } from '../../core/services/booking.service';
import { WalletService } from '../../core/services/wallet.service';
import { Wallet } from '../../core/models/wallet.model';
import { AlertController, ToastController } from '@ionic/angular';

interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

@Component({
  selector: 'app-service-booking',
  templateUrl: './service-booking.component.html',
  styleUrls: ['./service-booking.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule]
})
export class ServiceBookingComponent implements OnInit {
  service$!: Observable<Service | null>;
  provider$!: Observable<UserProfile | null>;
  wallet$!: Observable<Wallet | null>;
  userWallet: Wallet | null = null;
  bookingForm: FormGroup;
  selectedDate: string = new Date().toISOString();
  timeSlots: TimeSlot[] = [];
  isLoading: boolean = false;
  hasSufficientFunds: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private serviceService: ServiceService,
    private userService: UserService,
    private authService: AuthService,
    private bookingService: BookingService,
    private walletService: WalletService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {
    this.bookingForm = this.fb.group({
      date: ['', Validators.required],
      timeSlot: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(10)]],
      address: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^(0|\\+213)[567][0-9]{8}$/)]],
      paymentMethod: ['cash', Validators.required]
    });
  }

  ngOnInit() {
    // Get the user's wallet
    this.wallet$ = this.walletService.getUserWallet().pipe(
      tap(wallet => {
        this.userWallet = wallet;
      })
    );

    // Get the service details
    this.service$ = this.route.paramMap.pipe(
      map(params => params.get('id') || ''),
      switchMap(id => this.serviceService.getService(id)),
      tap(service => {
        if (service) {
          this.provider$ = this.userService.getUser(service.providerId);
          this.generateTimeSlots(service);

          // Check if user has sufficient funds
          if (this.userWallet) {
            this.hasSufficientFunds = this.userWallet.balance >= service.price;
          }

          // Update payment method options based on wallet balance
          this.updatePaymentMethodOptions(service.price);
        }
      })
    );

    // Load both service and wallet data
    combineLatest([this.service$, this.wallet$]).subscribe(([service, wallet]) => {
      if (service && wallet) {
        this.hasSufficientFunds = wallet.balance >= service.price;
        this.updatePaymentMethodOptions(service.price);
      }
    });
  }

  updatePaymentMethodOptions(servicePrice: number) {
    if (this.userWallet && this.userWallet.balance >= servicePrice) {
      // Enable wallet payment option
      this.hasSufficientFunds = true;

      // If wallet was previously disabled, reset to default payment method
      if (this.bookingForm.get('paymentMethod')?.value === 'wallet_insufficient') {
        this.bookingForm.get('paymentMethod')?.setValue('cash');
      }
    } else {
      this.hasSufficientFunds = false;

      // If wallet was selected, reset to cash
      if (this.bookingForm.get('paymentMethod')?.value === 'wallet') {
        this.bookingForm.get('paymentMethod')?.setValue('cash');
      }
    }
  }

  generateTimeSlots(service: Service) {
    // Exemple de génération de créneaux horaires
    const slots: TimeSlot[] = [];
    const start = 8; // 8h
    const end = 18; // 18h

    for (let hour = start; hour < end; hour++) {
      slots.push({
        start: `${hour}:00`,
        end: `${hour + 1}:00`,
        available: true // À implémenter : vérifier la disponibilité réelle
      });
    }

    this.timeSlots = slots;
  }

  async onSubmit() {
    if (this.bookingForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.bookingForm.controls).forEach(key => {
        const control = this.bookingForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    this.isLoading = true;

    try {
      const service = await this.service$.pipe(take(1)).toPromise();
      const user = await this.authService.getCurrentUser().pipe(take(1)).toPromise();

      if (!service || !user) {
        throw new Error('Service ou utilisateur non trouvé');
      }

      const paymentMethod = this.bookingForm.get('paymentMethod')?.value;
      let bookingStatus = 'pending';

      // Determine booking status based on payment method
      if (paymentMethod === 'wallet') {
        // Check if user still has sufficient funds before proceeding
        const hasEnoughFunds = await this.walletService.checkSufficientBalance(service.price).toPromise();

        if (!hasEnoughFunds) {
          this.showInsufficientFundsAlert();
          this.isLoading = false;
          return;
        }

        // Process wallet payment
        try {
          // Get the wallet again to ensure we have the latest data
          const wallet = await this.wallet$.pipe(take(1)).toPromise();
          if (!wallet) {
            throw new Error('Wallet not found');
          }

          // Create booking first with payment_pending status
          bookingStatus = 'payment_pending';
        } catch (error) {
          console.error('Payment error:', error);
          this.showPaymentErrorToast();
          this.isLoading = false;
          return;
        }
      } else {
        // Cash or other payment methods
        bookingStatus = 'pending';
      }

      // Create the booking
      const booking = {
        serviceId: service.id,
        providerId: service.providerId,
        clientId: user.uid,
        ...this.bookingForm.value,
        status: bookingStatus,
        totalPrice: service.price,
        serviceName: service.title,
        serviceImage: service.images || '',
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime()
      };

      // Save the booking
      const bookingId = await this.bookingService.createBooking(booking);

      // If using wallet, process the payment
      if (paymentMethod === 'wallet' && this.userWallet) {
        try {
          await this.walletService.makePayment(
            this.userWallet.id,
            service.price,
            bookingId,
            `Payment for ${service.title} service`
          );

          // Update booking status to confirmed after successful payment
          await this.bookingService.updateBookingStatus(bookingId, 'confirmed', 'Payment completed');

          this.showPaymentSuccessToast();
        } catch (error) {
          console.error('Payment processing error:', error);
          // Don't redirect yet, show error
          this.showPaymentErrorToast();
          this.isLoading = false;
          return;
        }
      }

      // Navigate to booking details page
      await this.router.navigate(['/bookings', bookingId]);
    } catch (error) {
      console.error('Erreur lors de la réservation:', error);
      this.showBookingErrorToast();
    } finally {
      this.isLoading = false;
    }
  }

  onDateChange(event: any) {
    this.selectedDate = event.detail.value;
    // Régénérer les créneaux horaires en fonction de la date sélectionnée
    this.service$.pipe(take(1)).subscribe(service => {
      if (service) {
        this.generateTimeSlots(service);
      }
    });
  }

  getTimeSlotLabel(slot: TimeSlot): string {
    return `${slot.start} - ${slot.end}`;
  }

  isSlotAvailable(slot: TimeSlot): boolean {
    // Implement actual availability check
    return slot.available;
  }

  getWalletBalance(): string {
    return this.userWallet ? `${this.userWallet.balance.toFixed(2)} DZD` : '0.00 DZD';
  }

  async showInsufficientFundsAlert() {
    const alert = await this.alertController.create({
      header: 'Solde insuffisant',
      message: 'Vous n\'avez pas assez de fonds dans votre portefeuille pour cette réservation. Veuillez recharger votre portefeuille ou choisir un autre mode de paiement.',
      buttons: [
        {
          text: 'Recharger',
          handler: () => {
            this.router.navigate(['/wallet/deposit']);
          }
        },
        {
          text: 'Utiliser un autre mode de paiement',
          handler: () => {
            this.bookingForm.get('paymentMethod')?.setValue('cash');
          }
        }
      ]
    });

    await alert.present();
  }

  async showPaymentSuccessToast() {
    const toast = await this.toastController.create({
      message: 'Paiement effectué avec succès',
      duration: 3000,
      position: 'bottom',
      color: 'success'
    });
    toast.present();
  }

  async showPaymentErrorToast() {
    const toast = await this.toastController.create({
      message: 'Erreur lors du traitement du paiement',
      duration: 3000,
      position: 'bottom',
      color: 'danger'
    });
    toast.present();
  }

  async showBookingErrorToast() {
    const toast = await this.toastController.create({
      message: 'Erreur lors de la création de la réservation',
      duration: 3000,
      position: 'bottom',
      color: 'danger'
    });
    toast.present();
  }
}
