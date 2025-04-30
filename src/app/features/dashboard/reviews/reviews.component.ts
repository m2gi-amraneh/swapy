import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';
import { UserReviewsComponent } from '../../../shared/components/user-reviews/user-reviews.component';

@Component({
  selector: 'app-reviews',
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    UserReviewsComponent
  ]
})
export class ReviewsComponent implements OnInit {
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
