import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { Notification } from '../../core/models/notification.model';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule]
})
export class NotificationsComponent implements OnInit {
  notifications$!: Observable<Notification[]>;
  isLoading = true;

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService,
    private alertController: AlertController
  ) { }

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.isLoading = true;
    this.authService.user$.pipe(
      map(user => {
        if (user) {
          this.notifications$ = this.notificationService.getUserNotifications(user.uid).pipe(
            map(notifications => {
              this.isLoading = false;
              return notifications.sort((a, b) => b.createdAt - a.createdAt);
            })
          );
        } else {
          this.isLoading = false;
        }
      })
    ).subscribe();
  }

  async markAsRead(notification: Notification) {
    if (!notification.read) {
      await this.notificationService.markNotificationAsRead(notification.id);
    }
  }

  async deleteNotification(notification: Notification) {
    const alert = await this.alertController.create({
      header: 'Supprimer la notification',
      message: 'Êtes-vous sûr de vouloir supprimer cette notification ?',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Supprimer',
          handler: () => {
            this.notificationService.deleteNotification(notification.id);
          }
        }
      ]
    });

    await alert.present();
  }

  async clearAllNotifications() {
    const alert = await this.alertController.create({
      header: 'Supprimer toutes les notifications',
      message: 'Êtes-vous sûr de vouloir supprimer toutes vos notifications ?',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Supprimer tout',
          handler: () => {
            this.authService.user$.pipe(
              map(user => {
                if (user) {
                  this.notificationService.clearAllNotifications(user.uid);
                }
              })
            ).subscribe();
          }
        }
      ]
    });

    await alert.present();
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'message':
        return 'chatbubble-outline';
      case 'booking':
        return 'calendar-outline';
      case 'booking_confirmation':
        return 'checkmark-circle-outline';
      case 'booking_cancellation':
        return 'close-circle-outline';
      case 'review':
        return 'star-outline';
      case 'system':
        return 'information-circle-outline';
      default:
        return 'notifications-outline';
    }
  }

  getNotificationRoute(notification: Notification): string[] {
    switch (notification.type) {
      case 'message':
        return ['/chat', notification.metadata?.conversationId || ''];
      case 'booking':
      case 'booking_confirmation':
      case 'booking_cancellation':
        return ['/bookings', notification.metadata?.bookingId || ''];
      case 'review':
        return ['/provider', notification.metadata?.providerId || ''];
      default:
        return ['/notifications'];
    }
  }

  getTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return days === 1 ? 'Hier' : `Il y a ${days} jours`;
    } else if (hours > 0) {
      return `Il y a ${hours} h`;
    } else if (minutes > 0) {
      return `Il y a ${minutes} min`;
    } else {
      return 'À l\'instant';
    }
  }
}
