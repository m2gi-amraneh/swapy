import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { ServiceService } from '../../core/services/service.service';
import { BookingService } from '../../core/services/booking.service';
import { WalletService } from '../../core/services/wallet.service';

import { UserProfile } from '../../core/models/user.model';
import { Service } from '../../core/models/service.model';
import { Booking } from '../../core/models/booking.model';
import { Wallet } from '../../core/models/wallet.model';

import { ServiceCardComponent } from '../../shared/components/service-card/service-card.component';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    ServiceCardComponent
  ]
})
export class ProfileComponent implements OnInit {
  user$!: Observable<UserProfile | null>;
  userServices$!: Observable<Service[]>;
  userBookings$!: Observable<Booking[]>;
  wallet$!: Observable<Wallet | null>;
  
  activeSegment: string = 'info';
  isProvider: boolean = false;
  isLoading: boolean = true;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private serviceService: ServiceService,
    private bookingService: BookingService,
    private walletService: WalletService
  ) {}

  ngOnInit() {
    this.loadUserData();
  }

  loadUserData() {
    this.isLoading = true;
    
    this.user$ = this.authService.user$.pipe(
      switchMap(user => {
        if (!user) return new Observable<null>(subscriber => subscriber.next(null));
        return this.userService.getUser(user.uid);
      }),
      tap(user => {
        this.isLoading = false;
        if (user) {
          this.isProvider = user.role === 'provider';
          
          // Charger les services de l'utilisateur s'il est prestataire
          if (this.isProvider) {
            this.userServices$ = this.serviceService.getServicesByProviderId(user.uid);
          }
          
          // Charger les réservations de l'utilisateur
          this.userBookings$ = this.bookingService.getUserBookings(user.uid);
          
          // Charger le portefeuille de l'utilisateur
          this.wallet$ = this.walletService.getUserWallet();
        }
      })
    );
  }

  segmentChanged(event: any) {
    this.activeSegment = event.detail.value;
  }

  logout() {
    this.authService.signOut().then(() => {
      // Redirection vers la page de connexion sera gérée par le guard
    });
  }

  becomeProvider() {
    this.authService.user$.pipe(
      switchMap(user => {
        if (!user) return new Observable<null>(subscriber => subscriber.next(null));
        return this.userService.updateUser(user.uid, { role: 'provider' });
      })
    ).subscribe(() => {
      this.isProvider = true;
    });
  }

  doRefresh(event: any) {
    this.loadUserData();
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }
}
