import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { CategoryService } from '../../../core/services/category.service';
import { Category } from '../../../core/models/category.model';

@Component({
  selector: 'app-service-search',
  templateUrl: './service-search.component.html',
  styleUrls: ['./service-search.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule]
})
export class ServiceSearchComponent implements OnInit {
  @Output() searchChange = new EventEmitter<any>();
  
  searchForm: FormGroup;
  categories: Category[] = [];
  
  sortOptions = [
    { value: 'price_asc', label: 'Prix croissant' },
    { value: 'price_desc', label: 'Prix décroissant' },
    { value: 'rating_desc', label: 'Meilleures notes' },
    { value: 'date_desc', label: 'Plus récents' }
  ];

  constructor(
    private fb: FormBuilder,
    private categoryService: CategoryService
  ) {
    this.searchForm = this.fb.group({
      query: [''],
      categories: [[]],
      priceMin: [''],
      priceMax: [''],
      rating: [''],
      sort: [''],
      location: ['']
    });
  }

  ngOnInit() {
    // Charger les catégories
    this.categoryService.getCategories().subscribe(
      categories => this.categories = categories
    );

    // Écouter les changements du formulaire
    this.searchForm.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
    ).subscribe(value => {
      // Convertir les valeurs en nombres si nécessaire
      const searchParams = {
        ...value,
        priceMin: value.priceMin ? parseFloat(value.priceMin) : undefined,
        priceMax: value.priceMax ? parseFloat(value.priceMax) : undefined,
        rating: value.rating ? parseFloat(value.rating) : undefined
      };

      // Extraire le tri et la direction
      if (value.sort) {
        const [sortBy, sortDirection] = value.sort.split('_');
        searchParams.sortBy = sortBy;
        searchParams.sortDirection = sortDirection;
      }

      this.searchChange.emit(searchParams);
    });
  }

  clearFilters() {
    this.searchForm.reset({
      query: '',
      categories: [],
      priceMin: '',
      priceMax: '',
      rating: '',
      sort: '',
      location: ''
    });
  }

  // Méthode utilitaire pour formater le prix
  formatPrice(price: number): string {
    return price.toLocaleString('fr-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }
}
