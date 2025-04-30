import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { UserService, UserReview } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-user-reviews',
  templateUrl: './user-reviews.component.html',
  styleUrls: ['./user-reviews.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class UserReviewsComponent implements OnInit {
  @Input() providerId!: string;
  reviews$!: Observable<UserReview[]>;
  newReview: string = '';
  newRating: number = 0;
  currentUserId: string | null = null;
  canReview: boolean = false;

  constructor(
    private userService: UserService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.reviews$ = this.userService.getProviderReviews(this.providerId);
    
    this.authService.user$.subscribe(user => {
      this.currentUserId = user?.uid || null;
      this.canReview = !!this.currentUserId && this.currentUserId !== this.providerId;
    });
  }

  async submitReview() {
    if (!this.currentUserId || !this.newReview || this.newRating === 0) {
      return;
    }

    try {
      await this.userService.addReview({
        userId: this.currentUserId,
        providerId: this.providerId,
        serviceId: '', // À remplir si nécessaire
        rating: this.newRating,
        comment: this.newReview
      });

      this.newReview = '';
      this.newRating = 0;
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'avis:', error);
    }
  }

  async likeReview(reviewId: string) {
    if (!this.currentUserId) {
      return;
    }

    try {
      await this.userService.likeReview(reviewId);
    } catch (error) {
      console.error('Erreur lors du like:', error);
    }
  }

  async respondToReview(reviewId: string, response: string) {
    if (!this.currentUserId || this.currentUserId !== this.providerId) {
      return;
    }

    try {
      await this.userService.respondToReview(reviewId, response);
    } catch (error) {
      console.error('Erreur lors de la réponse:', error);
    }
  }

  getStarsArray(rating: number): number[] {
    return Array(5).fill(0).map((_, index) => index < rating ? 1 : 0);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-DZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
