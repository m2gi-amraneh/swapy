import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { Service } from '../../../core/models/service.model';
import { ServiceViewService } from '../../../core/services/service-view.service';
import { UserService } from 'src/app/core/services/user.service';

@Component({
  selector: 'app-service-card',
  templateUrl: './service-card.component.html',
  styleUrls: ['./service-card.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule]
})
export class ServiceCardComponent implements OnInit {
  @Input() service!: Service;
  providerName: string = '';
  providerPhoto: string = '';
  averageRating: number = 0;

  constructor(
    private userService: UserService,
    private serviceViewService: ServiceViewService
  ) { }

  ngOnInit() {
    if (this.service) {
      // Charger les détails du prestataire
      this.userService.getUser(this.service.providerId).subscribe((provider: any) => {
        if (provider) {
          this.providerName = provider.displayName || '';
          this.providerPhoto = provider.photoURL || '';
        }
      });

      // Calculer la note moyenne
      if (this.service.ratings && this.service.ratings.length > 0) {
        this.averageRating = this.service.ratings.reduce((a, b) => a + b, 0) / this.service.ratings.length;
      }

      // Enregistrer la vue du service
      //this.serviceViewService.recordServiceView(this.service.id, 'card-click');
    }
  }

  getFirstPhoto(): string {
    return this.service.images && this.service.images.length > 0
      ? this.service.images[0]
      : 'assets/images/default-service.jpg';
  }

  formatPrice(price: number): string {
    return price.toLocaleString('fr-DZ', {
      style: 'currency',
      currency: 'DZD'
    });
  }

  getStatusColor(): string {
    switch (this.service.status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'inactive':
        return 'medium';
      default:
        return 'medium';
    }
  }

  getAverageRating(): number {
    return this.averageRating;
  }

  onBookNow(event: Event): void {
    // Prevent the card click event from triggering navigation
    event.stopPropagation();

    // Navigate to the booking page
    window.location.href = `/service-booking/${this.service.id}`;
  }
}
