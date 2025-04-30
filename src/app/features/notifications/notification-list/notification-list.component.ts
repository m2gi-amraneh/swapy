import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';

import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { Notification } from '../../../core/models/notification.model';

@Component({
  selector: 'app-notification-list',
  templateUrl: './notification-list.component.html',
  styleUrls: ['./notification-list.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule
  ]
})
export class NotificationListComponent implements OnInit {
  notifications$!: Observable<Notification[]>;
  unreadCount: number = 0;
  isLoading = true;

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService
  ) { }

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.authService.getCurrentUser().subscribe(user => {
      if (user) {
        this.notifications$ = this.notificationService.getUserNotifications(user.uid);
        this.notificationService.getUnreadCount(user.uid).subscribe(count => {
          this.unreadCount = count;
          this.isLoading = false;
        });
      }
    });
  }

  doRefresh(event: any) {
    this.loadNotifications();
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }

  async markAsRead(notification: Notification) {
    if (!notification.read) {
      try {
        await this.notificationService.markNotificationAsRead(notification.id);
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }
  }

  async deleteNotification(notification: Notification, event: Event) {
    event.stopPropagation();
    try {
      await this.notificationService.deleteNotification(notification.id);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }

  async markAllAsRead() {
    this.authService.getCurrentUser().subscribe(async user => {
      if (user) {
        try {
          await this.notificationService.markAllAsRead(user.uid);
        } catch (error) {
          console.error('Error marking all notifications as read:', error);
        }
      }
    });
  }

  async clearAll() {
    this.authService.getCurrentUser().subscribe(async user => {
      if (user) {
        try {
          await this.notificationService.clearAllNotifications(user.uid);
        } catch (error) {
          console.error('Error clearing all notifications:', error);
        }
      }
    });
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'message':
        return 'chatbubble-outline';
      case 'booking':
      case 'booking_request':
      case 'booking_confirmation':
      case 'booking_cancellation':
      case 'booking_completed':
        return 'calendar-outline';
      case 'payment_received':
      case 'payment_confirmed':
        return 'cash-outline';
      case 'review':
        return 'star-outline';
      case 'service_update':
        return 'construct-outline';
      case 'system':
        return 'information-circle-outline';
      default:
        return 'notifications-outline';
    }
  }

  getNotificationColor(type: string): string {
    switch (type) {
      case 'message':
        return 'primary';
      case 'booking_request':
      case 'booking_confirmation':
        return 'success';
      case 'booking_cancellation':
        return 'danger';
      case 'payment_received':
      case 'payment_confirmed':
        return 'tertiary';
      case 'review':
        return 'warning';
      default:
        return 'medium';
    }
  }

  getNotificationRoute(notification: Notification): string[] {
    const { type, metadata } = notification;
    
    switch (type) {
      case 'message':
        return metadata?.conversationId ? ['/chat', metadata.conversationId] : ['/chat'];
      case 'booking_request':
      case 'booking_confirmation':
      case 'booking_cancellation':
      case 'booking_completed':
        return metadata?.bookingId ? ['/bookings', metadata.bookingId] : ['/bookings'];
      case 'review':
        return metadata?.serviceId ? ['/services', metadata.serviceId] : ['/services'];
      case 'service_update':
        return metadata?.serviceId ? ['/services', metadata.serviceId] : ['/services'];
      default:
        return ['/'];
    }
  }

  getRelativeTime(timestamp: number): string {
    if (!timestamp) return '';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    // Moins d'une minute
    if (diff < 60 * 1000) {
      return 'À l\'instant';
    }
    
    // Moins d'une heure
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `Il y a ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    }
    
    // Moins d'un jour
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `Il y a ${hours} ${hours === 1 ? 'heure' : 'heures'}`;
    }
    
    // Moins d'une semaine
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `Il y a ${days} ${days === 1 ? 'jour' : 'jours'}`;
    }
    
    // Date complète
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  }
}
