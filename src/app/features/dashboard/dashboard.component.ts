import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { map, Observable } from 'rxjs';
import { UserProfile } from '../../core/models/user.model';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule
  ]
})
export class DashboardComponent implements OnInit {
  user!: UserProfile;
  isProvider: boolean = false;
  activeSegment: string = 'stats';

  constructor(
    private authService: AuthService,
    private userService: UserService
  ) { }

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.user = user;
      }
      if (user) {
        this.authService.getUserRole(user.uid).subscribe((role: string) => {
          this.isProvider = role === 'provider';
        });
      }
    });
  }

  segmentChanged(event: any) {
    this.activeSegment = event.detail.value;
  }
}
