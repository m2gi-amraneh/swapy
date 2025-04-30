import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ServiceService } from '../../core/services/service.service';
import { CategoryService } from '../../core/services/category.service';
import { Service } from '../../core/models/service.model';
import { Category } from '../../core/models/category.model';
import { ServiceCardComponent } from '../../shared/components/service-card/service-card.component';
import { ServiceSearchComponent } from '../../shared/components/service-search/service-search.component';
import { addIcons } from 'ionicons';
import { homeOutline, refreshCircleOutline, searchOutline, heartOutline, personOutline, chatbubblesOutline, notificationsOutline, walletOutline, refresh, logInOutline, starOutline, star, briefcaseOutline } from 'ionicons/icons';
addIcons({ homeOutline, refreshCircleOutline, searchOutline, heartOutline, personOutline, chatbubblesOutline, walletOutline, notificationsOutline, refresh, logInOutline, starOutline, star, briefcaseOutline });
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    ServiceCardComponent,
    ServiceSearchComponent,

  ]
})

export class HomeComponent implements OnInit {
  featuredServices$!: Observable<Service[]>;
  popularServices$!: Observable<Service[]>;
  recentServices$!: Observable<Service[]>;
  categories: Category[] = [];
  isLoading: boolean = true;

  constructor(
    private serviceService: ServiceService,
    private categoryService: CategoryService
  ) { }

  ngOnInit() {
    this.loadFeaturedServices();
    this.loadPopularServices();
    this.loadRecentServices();
    this.loadCategories();
  }

  loadFeaturedServices() {
    this.featuredServices$ = this.serviceService.getFeaturedServices(4);
  }

  loadPopularServices() {
    this.popularServices$ = this.serviceService.getMostViewedServices(4);
  }

  loadRecentServices() {
    this.recentServices$ = this.serviceService.getRecentServices(4);
  }

  loadCategories() {
    this.categoryService.getCategories().subscribe(categories => {
      this.categories = categories;
      this.isLoading = false;
    });
  }

  onSearch(searchParams: any) {
    if (searchParams && searchParams.query && searchParams.query.trim() !== '') {
      // Naviguer vers la page de recherche avec le terme de recherche
      // Cela sera implémenté plus tard
    }
  }

  doRefresh(event: any) {
    this.loadFeaturedServices();
    this.loadPopularServices();
    this.loadRecentServices();

    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }
}
