import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { Observable, of, Subscription } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';

import { BookingService } from '../../../core/services/booking.service';
import { AuthService } from '../../../core/services/auth.service';
import { Booking } from '../../../core/models/booking.model';

@Component({
  selector: 'app-booking-list',
  templateUrl: './booking-list.component.html',
  styleUrls: ['./booking-list.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    FormsModule
  ]
})
export class BookingListComponent implements OnInit, OnDestroy {
  bookings: Booking[] = [];
  isLoading: boolean = true;
  activeSegment: 'all' | 'pending' | 'confirmed' | 'completed' | 'canceled' = 'all';
  error: string = '';
  private subscriptions: Subscription = new Subscription();
  
  constructor(
    private bookingService: BookingService,
    private authService: AuthService
  ) { }

  ngOnInit() {
    console.log('BookingListComponent initialized');
    this.loadBookings();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadBookings() {
    this.isLoading = true;
    this.error = '';
    
    const authSub = this.authService.user$.subscribe(user => {
      console.log('Current user:', user);
      if (user) {
        // Get bookings by client first
        const clientSub = this.bookingService.getBookingsByClient(user.uid)
          .pipe(
            tap(bookings => {
              console.log('Client bookings loaded:', bookings);
              this.bookings = bookings;
              this.isLoading = false;
            }),
            catchError(err => {
              console.error('Error loading client bookings:', err);
              this.error = 'Failed to load bookings. Please try again.';
              this.isLoading = false;
              return of([]);
            })
          )
          .subscribe();
          
        this.subscriptions.add(clientSub);
      } else {
        console.log('No user authenticated');
        this.isLoading = false;
        this.error = 'Please log in to view your bookings';
      }
    });
    
    this.subscriptions.add(authSub);
  }

  segmentChanged(event: any) {
    this.activeSegment = event.detail.value;
  }

  getFilteredBookings(): Booking[] {
    if (this.activeSegment === 'all') {
      return this.bookings;
    }
    
    return this.bookings.filter(booking => booking.status === this.activeSegment);
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

  doRefresh(event: any) {
    this.loadBookings();
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }
}
