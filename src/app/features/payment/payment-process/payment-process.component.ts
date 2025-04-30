import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

import { PaymentService } from '../../../core/services/payment.service';
import { BookingService } from '../../../core/services/booking.service';
import { WalletService } from '../../../core/services/wallet.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';

import { Booking } from '../../../core/models/booking.model';
import { Service } from '../../../core/models/service.model';
import { UserProfile } from '../../../core/models/user.model';
import { Wallet } from '../../../core/models/wallet.model';
import { PaymentMethod } from '../../../core/models/payment.model';

import { PaymentMethodSelectorComponent } from '../payment-method-selector/payment-method-selector.component';

interface BookingWithService {
  booking: Booking;
  service: Service;
}

@Component({
  selector: 'app-payment-process',
  templateUrl: './payment-process.component.html',
  styleUrls: ['./payment-process.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    ReactiveFormsModule,
    PaymentMethodSelectorComponent
  ]
})
export class PaymentProcessComponent implements OnInit {
  booking$!: Observable<BookingWithService | null>;
  service$!: Observable<Service | null>;
  provider$!: Observable<UserProfile | null>;
  wallet$!: Observable<Wallet | null>;
  
  bookingId: string = '';
  selectedMethod: PaymentMethod = 'cash';
  isProcessing: boolean = false;
  isLoading: boolean = true;
  paymentSuccess: boolean = false;
  paymentError: string | null = null;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentService: PaymentService,
    private bookingService: BookingService,
    private walletService: WalletService,
    private authService: AuthService,
    private userService: UserService,
    private toastService: ToastService
  ) { }

  ngOnInit() {
    this.isLoading = true;
    
    // Récupérer l'ID de la réservation depuis l'URL
    const bookingIdParam = this.route.snapshot.paramMap.get('id');
    
    if (!bookingIdParam) {
      this.toastService.showError('Réservation introuvable');
      this.router.navigate(['/bookings']);
      return;
    }
    
    this.bookingId = bookingIdParam;
    
    // Charger les données de la réservation
    this.loadBookingData();
    
    // Charger le portefeuille de l'utilisateur
    this.wallet$ = this.walletService.getUserWallet();
  }

  loadBookingData() {
    if (!this.bookingId) return;
    
    this.booking$ = this.bookingService.getBookingWithService(this.bookingId).pipe(
      tap(data => {
        this.isLoading = false;
        if (data) {
          this.service$ = of(data.service);
          
          // Charger les données du prestataire
          if (data.booking.providerId) {
            this.provider$ = this.userService.getUser(data.booking.providerId);
          }
        }
      })
    );
  }

  onMethodSelected(method: PaymentMethod) {
    this.selectedMethod = method;
  }

  async processPayment() {
    if (!this.bookingId) return;
    
    this.isProcessing = true;
    this.paymentError = null;
    
    try {
      const bookingData = await this.booking$.pipe().toPromise();
      
      if (!bookingData) {
        throw new Error('Données de réservation introuvables');
      }
      
      const booking = bookingData.booking;
      const service = bookingData.service;
      
      if (!service) {
        throw new Error('Service introuvable');
      }
      
      const paymentData = {
        amount: service.price,
        bookingId: this.bookingId,
        clientId: booking.clientId,
        providerId: booking.providerId,
        serviceId: booking.serviceId,
        description: `Paiement pour ${service.title}`
      };
      
      let paymentId: string;
      
      // Traiter le paiement selon la méthode sélectionnée
      switch (this.selectedMethod) {
        case 'wallet':
          const wallet = await this.wallet$.pipe().toPromise();
          if (!wallet) {
            throw new Error('Portefeuille non trouvé');
          }
          paymentId = await this.paymentService.initiateWalletPayment(paymentData, wallet.id);
          break;
          
        case 'baridiMob':
          paymentId = await this.paymentService.initiateBaridiMobPayment(paymentData);
          break;
          
        case 'edahabia':
          paymentId = await this.paymentService.initiateEdahabiaPayment(paymentData);
          break;
          
        case 'cash':
        default:
          paymentId = await this.paymentService.initiateCashPayment(paymentData);
          break;
      }
      
      // Mettre à jour le statut de la réservation
      if (this.bookingId) {
        await this.bookingService.updateBookingStatus(this.bookingId, 'confirmed');
      }
      
      this.paymentSuccess = true;
      this.toastService.showSuccess('Paiement effectué avec succès');
      
      // Rediriger vers la page de détails de la réservation après 2 secondes
      setTimeout(() => {
        this.router.navigate(['/bookings', this.bookingId]);
      }, 2000);
      
    } catch (error: any) {
      this.paymentError = error.message || 'Une erreur est survenue lors du paiement';
      this.toastService.showError(this.paymentError || 'Une erreur est survenue lors du paiement');
    } finally {
      this.isProcessing = false;
    }
  }
}
