import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';

// Import des composants standalone
import { ServiceCardComponent } from './components/service-card/service-card.component';
import { ProviderStatsComponent } from './components/provider-stats/provider-stats.component';
import { UserReviewsComponent } from './components/user-reviews/user-reviews.component';
import { ServiceSearchComponent } from './components/service-search/service-search.component';
import { NotificationBadgeComponent } from './components/notification-badge/notification-badge.component';
import { MainTabsComponent } from './components/main-tabs/main-tabs.component';

/**
 * Module partagé qui exporte des composants réutilisables et des modules communs.
 * Tous les composants sont maintenant des composants autonomes (standalone).
 * Ce module facilite l'importation de ces composants dans d'autres modules.
 */
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule,
    // Import des composants standalone
    ServiceCardComponent,
    ProviderStatsComponent,
    UserReviewsComponent,
    ServiceSearchComponent,
    NotificationBadgeComponent,
    MainTabsComponent
  ],
  exports: [
    // Modules communs
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule,
    // Composants standalone
    ServiceCardComponent,
    ProviderStatsComponent,
    UserReviewsComponent,
    ServiceSearchComponent,
    NotificationBadgeComponent,
    MainTabsComponent
  ]
})
export class SharedModule { }
