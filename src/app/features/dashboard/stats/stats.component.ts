import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';
import { ProviderStatsComponent } from '../../../shared/components/provider-stats/provider-stats.component';

@Component({
  selector: 'app-stats',
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    ProviderStatsComponent
  ]
})
export class StatsComponent implements OnInit {
  providerId: string = '';
  isLoading: boolean = true;

  constructor(private authService: AuthService) { }

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.providerId = user.uid;
        this.isLoading = false;
      }
    });
  }
}
