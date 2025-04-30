import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BookingService } from '../../core/services/booking.service';
import { Booking } from '../../core/models/booking.model';
import { Service } from '../../core/models/service.model';

@Component({
  selector: 'app-booking-confirmation',
  templateUrl: './booking-confirmation.component.html',
  styleUrls: ['./booking-confirmation.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule]
})
export class BookingConfirmationComponent implements OnInit {
  bookingDetails$!: Observable<{ booking: Booking; service: Service } | null>;
  isLoading: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bookingService: BookingService
  ) {}

  ngOnInit() {
    this.route.paramMap.pipe(
      map(params => params.get('id') || '')
    ).subscribe(id => {
      if (id) {
        this.bookingDetails$ = this.bookingService.getBookingWithService(id);
      }
    });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'canceled':
        return 'danger';
      case 'completed':
        return 'primary';
      default:
        return 'medium';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'confirmed':
        return 'Confirmée';
      case 'pending':
        return 'En attente';
      case 'canceled':
        return 'Annulée';
      case 'completed':
        return 'Terminée';
      default:
        return 'Inconnu';
    }
  }

  formatDate(timestamp: number | string | undefined): string {
    if (!timestamp) return 'Non spécifié';
    
    // Handle string dates that might come from Firestore
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
    
    return date.toLocaleDateString('fr-DZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async viewBookings() {
    await this.router.navigate(['/bookings']);
  }

  async contactProvider() {
    // Implémenter la logique pour contacter le prestataire
    // Par exemple, rediriger vers la messagerie
  }

  async cancelBooking(bookingId: string) {
    try {
      await this.bookingService.cancelBooking(bookingId, 'client');
      await this.router.navigate(['/bookings']);
    } catch (error) {
      console.error('Erreur lors de l\'annulation:', error);
      // Gérer l'erreur et afficher un message à l'utilisateur
    }
  }
}
