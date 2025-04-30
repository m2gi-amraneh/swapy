import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';

import { UserService } from '../../core/services/user.service';
import { ServiceService } from '../../core/services/service.service';
import { AuthService } from '../../core/services/auth.service';
import { UserProfile } from '../../core/models/user.model';
import { Service } from '../../core/models/service.model';

import { ServiceCardComponent } from '../../shared/components/service-card/service-card.component';
import { UserReviewsComponent } from '../../shared/components/user-reviews/user-reviews.component';
import { ProviderStatsComponent } from '../../shared/components/provider-stats/provider-stats.component';

@Component({
  selector: 'app-provider-profile',
  templateUrl: './provider-profile.component.html',
  styleUrls: ['./provider-profile.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    IonicModule, 
    RouterModule,
    FormsModule,
    ServiceCardComponent,
    UserReviewsComponent,
    ProviderStatsComponent
  ]
})
export class ProviderProfileComponent implements OnInit {
  providerId: string = '';
  provider$!: Observable<UserProfile | null>;
  services$!: Observable<Service[]>;
  isCurrentUser: boolean = false;
  segment: string = 'services';

  
  constructor(
    private route: ActivatedRoute,
    private userService: UserService,
    private serviceService: ServiceService,
    private authService: AuthService,  private router: Router
  ) {}

  ngOnInit() {
    this.route.paramMap.pipe(
      map(params => params.get('id') || '')
    ).subscribe(id => {
      if (id) {
        this.providerId = id;
        this.loadProviderData();
      }
    });

    this.authService.user$.subscribe(user => {
      this.isCurrentUser = user?.uid === this.providerId;
    });
  }

  loadProviderData() {
    this.provider$ = this.userService.getUser(this.providerId);
    this.services$ = this.serviceService.getServicesByProviderId(this.providerId);
  }

  segmentChanged(event: any) {
    this.segment = event.detail.value;
  }

  async contactProvider() {
    this.router.navigate(['/chat/new', this.providerId]);
  }

  async bookService() {
    // TODO: Implémenter la logique pour réserver un service
    // Par exemple, naviguer vers la page de réservation
  }
}
