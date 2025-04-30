import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { UserService, ProviderStats } from '../../../core/services/user.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-provider-stats',
  templateUrl: './provider-stats.component.html',
  styleUrls: ['./provider-stats.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class ProviderStatsComponent implements OnInit {
  @Input() providerId!: string;
  stats$!: Observable<ProviderStats>;
  
  // Pour le graphique des catégories
  categoryLabels: string[] = [];
  categoryData: number[] = [];
  
  // Pour le graphique des revenus
  revenueLabels: string[] = ['Aujourd\'hui', 'Cette semaine', 'Ce mois', 'Total'];
  revenueData: number[] = [];

  // Make Math available to the template
  Math = Math;

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.stats$ = this.userService.getProviderStats(this.providerId);
    
    this.stats$.subscribe(stats => {
      if (stats) {
        // Préparer les données pour le graphique des catégories
        this.categoryLabels = Object.keys(stats.categoryStats);
        this.categoryData = Object.values(stats.categoryStats);
        
        // Préparer les données pour le graphique des revenus
        this.revenueData = [
          stats.revenueStats.daily,
          stats.revenueStats.weekly,
          stats.revenueStats.monthly,
          stats.revenueStats.total
        ];
      }
    });
  }

  formatCurrency(amount: number): string {
    return amount.toLocaleString('fr-DZ', {
      style: 'currency',
      currency: 'DZD'
    });
  }

  formatPercentage(value: number): string {
    return (value * 100).toFixed(1) + '%';
  }

  getCompletionRateColor(rate: number): string {
    if (rate >= 0.9) return 'success';
    if (rate >= 0.7) return 'warning';
    return 'danger';
  }

  getRatingColor(rating: number): string {
    if (rating >= 4.5) return 'success';
    if (rating >= 3.5) return 'warning';
    if (rating >= 2.5) return 'medium';
    return 'danger';
  }

  // Helper method to get the maximum value in categoryData
  getMaxCategoryValue(): number {
    if (!this.categoryData || this.categoryData.length === 0) return 1;
    return Math.max(...this.categoryData);
  }
}
