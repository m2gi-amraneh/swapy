import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, combineLatest } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';

import { PaymentService } from '../../core/services/payment.service';
import { BookingService } from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';
import { WalletService } from '../../core/services/wallet.service';
import { Payment, PaymentMethod } from '../../core/models/payment.model';
import { Booking } from '../../core/models/booking.model';
import { Service } from '../../core/models/service.model';
import { Wallet } from '../../core/models/wallet.model';

@Component({
  selector: 'app-payment',
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    RouterModule
  ]
})
export class PaymentComponent implements OnInit {
  bookingDetails$!: Observable<{ booking: Booking; service: Service } | null>;
  wallet$!: Observable<Wallet | null>;
  paymentForm: FormGroup;
  isLoading: boolean = false;
  bookingId: string = '';
  paymentMethods: { value: PaymentMethod; label: string; icon: string }[] = [
    { value: 'cash', label: 'Paiement à la livraison', icon: 'cash-outline' },
    { value: 'baridiMob', label: 'BaridiMob', icon: 'phone-portrait-outline' },
    { value: 'edahabia', label: 'EDAHABIA', icon: 'card-outline' },
    { value: 'card', label: 'Carte bancaire', icon: 'card-outline' },
    { value: 'wallet', label: 'Portefeuille électronique', icon: 'wallet-outline' }
  ];
  selectedMethod: PaymentMethod = 'cash';
  paymentError: string | null = null;
  paymentSuccess: boolean = false;
  hasWallet: boolean = false;
  walletBalance: number = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private paymentService: PaymentService,
    private bookingService: BookingService,
    private authService: AuthService,
    private walletService: WalletService
  ) {
    this.paymentForm = this.fb.group({
      paymentMethod: ['cash', Validators.required],
      cardNumber: [''],
      cardExpiry: [''],
      cardCvv: [''],
      phoneNumber: ['', [Validators.pattern(/^(0|\\+213)[567][0-9]{8}$/)]],
      savePaymentInfo: [false]
    });
  }

  ngOnInit() {
    this.route.paramMap.pipe(
      map(params => params.get('id') || '')
    ).subscribe(id => {
      if (id) {
        this.bookingId = id;
        this.bookingDetails$ = this.bookingService.getBookingWithService(id);
        
        // Charger les informations du portefeuille
        this.wallet$ = this.walletService.getUserWallet().pipe(
          tap(wallet => {
            this.hasWallet = !!wallet;
            this.walletBalance = wallet?.balance || 0;
          })
        );
      }
    });

    // Mise à jour des validateurs en fonction de la méthode de paiement
    this.paymentForm.get('paymentMethod')?.valueChanges.subscribe((method: PaymentMethod) => {
      this.selectedMethod = method;
      this.updateValidators(method);
    });
  }

  updateValidators(method: PaymentMethod) {
    const cardNumberControl = this.paymentForm.get('cardNumber');
    const cardExpiryControl = this.paymentForm.get('cardExpiry');
    const cardCvvControl = this.paymentForm.get('cardCvv');
    const phoneNumberControl = this.paymentForm.get('phoneNumber');

    // Réinitialiser tous les validateurs
    cardNumberControl?.clearValidators();
    cardExpiryControl?.clearValidators();
    cardCvvControl?.clearValidators();
    phoneNumberControl?.clearValidators();

    // Appliquer les validateurs en fonction de la méthode
    if (method === 'card') {
      cardNumberControl?.setValidators([Validators.required, Validators.pattern(/^[0-9]{16}$/)]);
      cardExpiryControl?.setValidators([Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/[0-9]{2}$/)]);
      cardCvvControl?.setValidators([Validators.required, Validators.pattern(/^[0-9]{3,4}$/)]);
    } else if (method === 'baridiMob' || method === 'edahabia') {
      phoneNumberControl?.setValidators([
        Validators.required,
        Validators.pattern(/^(0|\\+213)[567][0-9]{8}$/)
      ]);
    }

    // Mettre à jour les validateurs
    cardNumberControl?.updateValueAndValidity();
    cardExpiryControl?.updateValueAndValidity();
    cardCvvControl?.updateValueAndValidity();
    phoneNumberControl?.updateValueAndValidity();
  }

  async onSubmit() {
    if (this.paymentForm.valid) {
      this.isLoading = true;
      this.paymentError = null;

      try {
        const bookingDetails = await this.bookingDetails$.pipe(take(1)).toPromise();
        const user = await this.authService.getCurrentUser().pipe(take(1)).toPromise();
        const wallet = this.selectedMethod === 'wallet' ? await this.wallet$.pipe(take(1)).toPromise() : null;

        if (!bookingDetails || !user) {
          throw new Error('Détails de réservation ou utilisateur non trouvés');
        }

        const { booking, service } = bookingDetails;
        const method = this.paymentForm.get('paymentMethod')?.value as PaymentMethod;

        let paymentId: string;

        const paymentData = {
          bookingId: booking.id,
          clientId: user.uid,
          providerId: service.providerId,
          amount: service.price
        };

        switch (method) {
          case 'cash':
            paymentId = await this.paymentService.initiateCashPayment(paymentData);
            break;
          case 'baridiMob':
            paymentId = await this.paymentService.initiateBaridiMobPayment(paymentData);
            // Rediriger vers la page de paiement BaridiMob (simulé)
            break;
          case 'edahabia':
            paymentId = await this.paymentService.initiateEdahabiaPayment(paymentData);
            // Rediriger vers la page de paiement EDAHABIA (simulé)
            break;
          case 'wallet':
            if (!wallet) {
              throw new Error('Portefeuille non disponible');
            }
            if (wallet.balance < service.price) {
              throw new Error('Solde insuffisant dans votre portefeuille');
            }
            paymentId = await this.paymentService.initiateWalletPayment(paymentData, wallet.id);
            break;
          default:
            throw new Error('Méthode de paiement non prise en charge');
        }

        // Mettre à jour le statut de la réservation
        await this.bookingService.updateBookingStatus(booking.id, 'payment_pending');

        this.paymentSuccess = true;
        
        // Rediriger vers la page de confirmation après un délai
        setTimeout(() => {
          this.router.navigate(['/services', service.id, 'confirmation'], { 
            queryParams: { paymentId } 
          });
        }, 2000);

      } catch (error: any) {
        console.error('Erreur lors du paiement:', error);
        if (error.message === 'Solde insuffisant dans votre portefeuille') {
          this.paymentError = 'Solde insuffisant dans votre portefeuille. Veuillez recharger votre compte ou choisir une autre méthode de paiement.';
        } else {
          this.paymentError = 'Une erreur est survenue lors du traitement du paiement. Veuillez réessayer.';
        }
      } finally {
        this.isLoading = false;
      }
    }
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-DZ', {
      style: 'currency',
      currency: 'DZD'
    }).format(price);
  }

  isWalletPaymentDisabled(servicePrice: number): boolean {
    return !this.hasWallet || this.walletBalance < servicePrice;
  }
}
