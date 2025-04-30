import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';

import { ServiceService } from '../../core/services/service.service';
import { Service } from '../../core/models/service.model';
import { ServiceCardComponent } from '../../shared/components/service-card/service-card.component';
import { ServiceSearchComponent } from '../../shared/components/service-search/service-search.component';

@Component({
  selector: 'app-service-list',
  templateUrl: './service-list.component.html',
  styleUrls: ['./service-list.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    RouterModule,
    ServiceCardComponent,
    ServiceSearchComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ServiceListComponent implements OnInit {
  services$!: Observable<Service[]>;
  filteredServices$!: Observable<Service[]>;
  categories: string[] = [];
  selectedCategory: string | null = null;
  isLoading: boolean = true;

  constructor(private serviceService: ServiceService) { }

  ngOnInit() {
    this.loadServices();
    this.loadCategories();
  }

  loadServices() {
    this.isLoading = true;
    this.services$ = this.serviceService.getServices();
    this.filteredServices$ = this.services$;
    this.isLoading = false;
  }

  loadCategories() {
    this.serviceService.getCategories().subscribe(categories => {
      this.categories = categories;
    });
  }

  onSearch(searchParams: any) {
    if (!searchParams || (typeof searchParams === 'string' && searchParams.trim() === '')) {
      this.filteredServices$ = this.services$;
      return;
    }
    
    // Handle both string and object search parameters
    if (typeof searchParams === 'string') {
      this.filteredServices$ = this.serviceService.searchServices(searchParams);
    } else {
      // Use the search service with the search params object
      this.filteredServices$ = this.serviceService.searchServicesAdvanced(searchParams);
    }
  }

  filterByCategory(category: string | null) {
    this.selectedCategory = category;
    
    if (!category) {
      this.filteredServices$ = this.services$;  
      return;
    }
    
    this.filteredServices$ = this.serviceService.getServicesByCategory(category);
  }

  doRefresh(event: any) {
    this.loadServices();
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }
}
