import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationBadgeComponent } from '../notification-badge/notification-badge.component';
import { HomeComponent } from 'src/app/features/home/home.component';
import { add, logInOutline, personOutline, calendarOutline, notificationsOutline, heartOutline, homeOutline, briefcaseOutline, chatbubble, chatbubbleOutline, locationOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
addIcons({
  calendarOutline,
  notificationsOutline,
  heartOutline,
  personOutline,
  add, logInOutline, homeOutline, briefcaseOutline, chatbubbleOutline, locationOutline
});
@Component({
  selector: 'app-main-tabs',
  templateUrl: './main-tabs.component.html',
  styleUrls: ['./main-tabs.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    NotificationBadgeComponent, HomeComponent
  ]
})

export class MainTabsComponent implements OnInit {
  isLoggedIn = false;
  isProvider = false;

  constructor(private authService: AuthService) { }

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      this.isLoggedIn = !!user;
      if (user) {
        this.authService.getUserRole(user.uid).subscribe((role: string) => {
          this.isProvider = role === 'provider';
        });
      }
    });
  }
}
