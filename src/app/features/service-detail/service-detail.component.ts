import { Component, OnInit, OnDestroy } from '@angular/core'; // Import OnDestroy
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, combineLatest, Subscription, Subject } from 'rxjs'; // Import Subscription, Subject
import { map, switchMap, tap, take, filter, takeUntil } from 'rxjs/operators'; // Import take, filter, takeUntil

import { Service } from '../../core/models/service.model';
import { UserProfile } from '../../core/models/user.model';
import { ServiceService } from '../../core/services/service.service';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { ServiceViewService } from '../../core/services/service-view.service';

import { UserReviewsComponent } from '../../shared/components/user-reviews/user-reviews.component';
import { ServiceCardComponent } from '../../shared/components/service-card/service-card.component';
import { addIcons } from 'ionicons'; // Import addIcons if needed
import { chevronBackOutline, chevronForwardOutline, star, pricetag, location, calendar, chatbubble, createOutline } from 'ionicons/icons'; // Import necessary icons

// Add icons used in the template
addIcons({ chevronBackOutline, chevronForwardOutline, star, pricetag, location, calendar, chatbubble, createOutline });

@Component({
  selector: 'app-service-detail',
  templateUrl: './service-detail.component.html',
  styleUrls: ['./service-detail.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    UserReviewsComponent,
    ServiceCardComponent
  ]
})
export class ServiceDetailComponent implements OnInit, OnDestroy { // Implement OnDestroy
  service$: Observable<Service | null>;
  provider$: Observable<UserProfile | null> | undefined; // Can be undefined initially
  similarServices$: Observable<Service[]> | undefined; // Can be undefined initially
  isCurrentUserProvider: boolean = false;
  selectedImageIndex: number = 0;
  service: Service | null = null; // Keep local copy for image nav

  // Subject to trigger unsubscription on component destroy
  private destroy$ = new Subject<void>();
  // Keep track of manual subscriptions if needed (though take(1) completes itself)
  // private viewRecordedSub: Subscription | undefined;
  private providerCheckSub: Subscription | undefined;
  private bookNowSub: Subscription | undefined;
  private contactProviderSub: Subscription | undefined;


  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private serviceService: ServiceService,
    private userService: UserService,
    private authService: AuthService,
    private serviceViewService: ServiceViewService
  ) {
    // Initialize service$ here to avoid potential template errors before ngOnInit
    this.service$ = this.route.paramMap.pipe(
      map(params => params.get('id')),
      filter((id): id is string => !!id), // Ensure id is not null/undefined
      switchMap(id => this.serviceService.getService(id)),
      tap(service => {
        // Update local state and trigger related data loading
        // This tap runs every time service data updates
        if (service) {
          this.service = service; // Update local copy
          // Only load provider/similar if they haven't been loaded
          // or if the service ID actually changes (unlikely here, but safe)
          if (!this.provider$) {
            this.provider$ = this.userService.getUser(service.providerId);
          }
          if (!this.similarServices$) {
            this.similarServices$ = this.serviceService.getSimilarServices(service);
          }
        } else {
          // Handle case where service is not found (e.g., navigate away)
          console.warn('Service not found');
          this.service = null;
          this.provider$ = undefined;
          this.similarServices$ = undefined;
          // Optionally navigate: this.router.navigate(['/not-found']);
        }
      }),
      takeUntil(this.destroy$) // Automatically unsubscribe when component destroyed
    );
  }

  ngOnInit() {
    // --- Record View Once ---
    this.route.paramMap.pipe(
      map(params => params.get('id')),
      filter((id): id is string => !!id), // Make sure we have an ID
      take(1), // Take only the FIRST emission of the ID
      tap(id => {
        console.log('Recording view for service ID:', id); // Debug log
        this.serviceViewService.recordServiceView(id)
          .catch(err => console.error('Failed to record service view:', err)); // Handle potential errors
      }),
      takeUntil(this.destroy$) // Clean up this subscription too
    ).subscribe(); // Need to subscribe to trigger the stream


    // --- Main Data Loading (already assigned in constructor) ---
    // this.service$ is already set up and listening


    // --- Check if Current User is Provider ---
    // Use takeUntil for automatic cleanup
    this.providerCheckSub = combineLatest([
      this.service$, // Use the main service stream
      this.authService.user$
    ]).pipe(
      takeUntil(this.destroy$) // Manage subscription
    ).subscribe(([service, user]) => {
      this.isCurrentUserProvider = !!(service && user && service.providerId === user.uid);
    });
  }

  ngOnDestroy() {
    console.log('ServiceDetailComponent destroyed'); // Debug log
    // Complete the destroy subject to trigger takeUntil operators
    this.destroy$.next();
    this.destroy$.complete();

    // Explicitly unsubscribe from any other manual subscriptions if needed
    // (though takeUntil should handle most)
    // this.viewRecordedSub?.unsubscribe(); // Not strictly needed due to take(1)
    // this.providerCheckSub?.unsubscribe(); // Handled by takeUntil
    this.bookNowSub?.unsubscribe();
    this.contactProviderSub?.unsubscribe();
  }

  onBookNow(serviceId: string | undefined) {
    if (!serviceId) return; // Safety check

    // Use take(1) because we only need the current user status once for the navigation logic
    this.bookNowSub = this.authService.user$.pipe(take(1)).subscribe(user => {
      if (!user) {
        this.router.navigate(['/auth/login'], {
          queryParams: { returnUrl: this.router.url } // Return to current detail page
        });
      } else {
        this.router.navigate(['/services', serviceId, 'booking']);
      }
    });
  }

  onContactProvider(providerId: string | undefined) {
    if (!providerId) return; // Safety check

    // Use take(1) for the same reason as onBookNow
    this.contactProviderSub = this.authService.user$.pipe(take(1)).subscribe(user => {
      if (!user) {
        this.router.navigate(['/auth/login'], {
          queryParams: { returnUrl: this.router.url } // Return to current detail page
        });
      } else {
        // Check if trying to chat with self? Might not be needed depending on chat logic
        // if (user.uid === providerId) { console.warn("Attempting to chat with self"); return; }
        this.router.navigate(['/chat/new', providerId]);
      }
    });
  }

  onEditService(serviceId: string | undefined) {
    if (!serviceId) return; // Safety check
    // Consider adding an Auth check here if needed, although the button visibility handles it
    this.router.navigate(['/services', serviceId, 'edit']); // Assuming route exists
  }

  // Use Intl for formatting, robust approach
  formatPrice(price: number | undefined): string {
    if (price === undefined || price === null) {
      return 'Prix non disponible'; // Or return empty string ''
    }
    return new Intl.NumberFormat('fr-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0, // Adjust as needed
      maximumFractionDigits: 2
    }).format(price);
  }

  // --- Image Navigation ---
  // Operate on the local 'service' variable, which is updated by the service$ stream
  nextImage() {
    if (this.service && this.service.images && this.service.images.length > 0) {
      this.selectedImageIndex = (this.selectedImageIndex + 1) % this.service.images.length;
    }
  }

  previousImage() {
    if (this.service && this.service.images && this.service.images.length > 0) {
      const imageCount = this.service.images.length;
      this.selectedImageIndex = (this.selectedImageIndex - 1 + imageCount) % imageCount;
    }
  }

  selectImage(index: number) {
    // Basic validation could be added
    this.selectedImageIndex = index;
  }
}
