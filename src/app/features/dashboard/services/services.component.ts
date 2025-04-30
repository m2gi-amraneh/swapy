import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ServiceService } from '../../../core/services/service.service';
import { Service } from '../../../core/models/service.model';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { ServiceCardComponent } from '../../../shared/components/service-card/service-card.component';

@Component({
  selector: 'app-services',
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    ServiceCardComponent
  ]
})
export class ServicesComponent implements OnInit {
  providerId: string = '';
  services$!: Observable<Service[]>;
  isLoading: boolean = true;

  constructor(
    private authService: AuthService,
    private serviceService: ServiceService,
    private firestore: AngularFirestore,
    private router: Router
  ) { }

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.providerId = user.uid;
        this.services$ = this.serviceService.getServicesByProviderId(this.providerId);
        this.isLoading = false;
      }
    });
  }

  onAddService() {
    this.router.navigate(['/services/create']);
  }

  onEditService(serviceId: string) {
    // Navigation vers la page d'édition de service
  }

  async onDeleteService(serviceId: string) {
    try {
      // Utiliser une méthode appropriée pour supprimer un service
      await this.serviceService.getService(serviceId).pipe(take(1)).subscribe(async (service) => {
        if (service && service.id) {
          await this.firestore.doc(`services/${service.id}`).delete();
        }
      });
    } catch (error) {
      console.error('Erreur lors de la suppression du service:', error);
    }
  }
}
