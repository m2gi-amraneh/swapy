import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-notification-badge',
  templateUrl: './notification-badge.component.html',
  styleUrls: ['./notification-badge.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule
  ]
})
export class NotificationBadgeComponent implements OnInit, OnDestroy {
  unreadCount: number = 0;
  private subscriptions: Subscription = new Subscription();

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService
  ) { }

  ngOnInit() {
    const authSub = this.authService.getCurrentUser().subscribe(user => {
      if (user) {
        const countSub = this.notificationService.getUnreadCount(user.uid).subscribe(count => {
          this.unreadCount = count;
        });
        this.subscriptions.add(countSub);
      }
    });
    this.subscriptions.add(authSub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}
