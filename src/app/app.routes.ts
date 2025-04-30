// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { MainTabsComponent } from './shared/components/main-tabs/main-tabs.component'; // Adjust path if needed

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/tabs/home', // Redirect root to the default tab
    pathMatch: 'full'
  },
  {
    path: 'tabs', // Base path for the main tab interface
    component: MainTabsComponent, // Load the component containing <ion-tabs>
    children: [
      {
        path: 'home', // Path matches tab="home"
        loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'services', // Path matches tab="services"
        // This should likely load the service list/search component initially
        loadComponent: () => import('./features/service-list/service-list.component').then(m => m.ServiceListComponent)
      },
      {
        path: 'chat', // Path matches tab="chat"
        loadComponent: () => import('./features/chat/chat-list/chat-list.component').then(m => m.ChatListComponent),
        canActivate: [AuthGuard]
      },
      {
        path: 'bookings', // Path matches tab="bookings"
        loadComponent: () => import('./features/booking/booking-list/booking-list.component').then(m => m.BookingListComponent),
        canActivate: [AuthGuard] // Assuming logged-in
      },
      {
        path: 'profile', // Path matches tab="profile"
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
        canActivate: [AuthGuard] // Assuming logged-in
      },
      {
        path: 'auth', // Path matches tab="auth" (for non-logged-in users)
        // Decide what this should load. Often login is outside tabs.
        loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
        // If login happens *within* the tab structure.
      },
      {
        // Default child route for '/tabs' -> redirect to home tab
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full'
      }
    ]
  },

  // --- Routes OUTSIDE the main Tabs structure ---
  {
    path: 'auth', // Keep your dedicated auth section if needed for register/reset etc.
    loadComponent: () => import('./features/auth/auth.component').then(m => m.AuthComponent),
    children: [
      { // Make sure paths don't conflict if 'auth' is also a tab path
        path: 'login',
        loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
      },
      {
        path: 'register',
        loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent)
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
      }
    ]
  },
  // Service specific routes (remain independent)
  {
    path: 'services/create',
    loadComponent: () => import('./features/service-create/service-create.component').then(m => m.ServiceCreateComponent),
    canActivate: [AuthGuard] // Add necessary guards
  },
  {
    path: 'services/:id',
    loadComponent: () => import('./features/service-detail/service-detail.component').then(m => m.ServiceDetailComponent)
  },
  {
    path: 'services/:id/booking',
    loadComponent: () => import('./features/service-booking/service-booking.component').then(m => m.ServiceBookingComponent)
  },
  {
    path: 'services/:id/payment',
    loadComponent: () => import('./features/payment/payment.component').then(m => m.PaymentComponent)
  },
  {
    path: 'services/:id/confirmation',
    loadComponent: () => import('./features/booking-confirmation/booking-confirmation.component').then(m => m.BookingConfirmationComponent)
  },
  // Chat details (remain independent)
  {
    path: 'chat/new/:userId',
    loadComponent: () => import('./features/chat/chat-new/chat-new.component').then(m => m.ChatNewComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'chat/:id',
    loadComponent: () => import('./features/chat/chat-detail/chat-detail.component').then(m => m.ChatDetailComponent),
    canActivate: [AuthGuard]
  },

  // Notifications & Wallet - Decide: Are they tabs or separate pages?
  // If separate pages, keep routes like this:
  {
    path: 'notifications',
    loadComponent: () => import('./features/notifications/notification-list/notification-list.component').then(m => m.NotificationListComponent),
    canActivate: [AuthGuard] // Add guard
  },
  {
    path: 'wallet',
    loadComponent: () => import('./features/wallet/wallet.component').then(m => m.WalletComponent),
    canActivate: [AuthGuard] // Add guard
  },

  // Booking details (remain independent)
  {
    path: 'bookings/:id',
    loadComponent: () => import('./features/booking/booking-detail/booking-detail.component').then(m => m.BookingDetailComponent),
    canActivate: [AuthGuard] // Add guard
  },
  {
    path: 'bookings/:id/payment',
    loadComponent: () => import('./features/payment/payment.component').then(m => m.PaymentComponent),
    // canActivate: [AuthGuard] // Add guard
  },

  // Other independent routes (Provider Profile, Dashboard, etc.)
  {
    path: 'provider/:id',
    loadComponent: () => import('./features/provider-profile/provider-profile.component').then(m => m.ProviderProfileComponent),
    // ... provider children ...
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    children: [
      { // Make sure paths don't conflict if 'auth' is also a tab path
        path: 'stats',
        loadComponent: () => import('./features/dashboard/stats/stats.component').then(m => m.StatsComponent)
      }, { // Make sure paths don't conflict if 'auth' is also a tab path
        path: 'reviews',
        loadComponent: () => import('./features/dashboard/reviews/reviews.component').then(m => m.ReviewsComponent)
      },

      {
        path: 'services',
        loadComponent: () => import('./features/dashboard/services/services.component').then(m => m.ServicesComponent)
      },

    ]
    // ... dashboard children ...
    //canActivate: [AuthGuard] // Add guards if needed
  },


  // Catch-all: Redirect unknown paths to the default tab
  {
    path: '**',
    redirectTo: '/tabs/home'
  }
];
