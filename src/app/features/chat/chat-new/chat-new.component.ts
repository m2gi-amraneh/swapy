import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController } from '@ionic/angular'; // Import NavController
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, Subscription, of } from 'rxjs'; // Import 'of' for catchError
import { switchMap, tap, finalize, take, catchError } from 'rxjs/operators'; // Import take and catchError

import { ChatService } from '../../../core/services/chat.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { UserProfile } from '../../../core/models/user.model';
import { addIcons } from 'ionicons'; // Import addIcons if needed
import { alertCircleOutline, send } from 'ionicons/icons'; // Import necessary icons

// Add icons used in the template
addIcons({ alertCircleOutline, send });

@Component({
  selector: 'app-chat-new',
  templateUrl: './chat-new.component.html',
  styleUrls: ['./chat-new.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    RouterModule
  ]
})
export class ChatNewComponent implements OnInit, OnDestroy {
  otherUserId: string = '';
  otherUser: UserProfile | null = null;
  currentUserId: string | null = null;
  initialMessage: string = '';
  isLoading = true; // Start as true
  error: string | null = null;
  private subscriptions: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chatService: ChatService,
    private authService: AuthService,
    private userService: UserService,
    private navCtrl: NavController // Inject NavController for back navigation
  ) { }

  ngOnInit() {
    console.log('ChatNewComponent initialized');
    // Use paramMap observable for potentially cleaner route param handling, though snapshot is fine here
    this.otherUserId = this.route.snapshot.paramMap.get('userId') || '';
    console.log('Other user ID:', this.otherUserId);

    if (!this.otherUserId) {
      this.error = 'Utilisateur non spécifié.';
      this.isLoading = false;
      console.error(this.error);
      return;
    }

    this.loadUserData();
  }

  ngOnDestroy() {
    console.log('ChatNewComponent destroyed');
    this.subscriptions.unsubscribe();
  }

  loadUserData() {
    this.isLoading = true; // Ensure loading is true when starting
    this.error = null; // Clear previous errors

    const loadSub = this.authService.user$.pipe(
      take(1), // Take the current user state once
      tap(user => {
        console.log('Current user state:', user);
        if (!user) {
          this.error = 'Vous devez être connecté pour démarrer une conversation.';
          throw new Error(this.error); // Throw error to stop the pipe here
        }
        this.currentUserId = user.uid;

        if (this.currentUserId === this.otherUserId) {
          this.error = 'Vous ne pouvez pas démarrer une conversation avec vous-même.';
          throw new Error(this.error); // Throw error
        }
      }),
      switchMap(() => {
        // Proceed only if the above checks passed
        console.log('Fetching other user data for:', this.otherUserId);
        return this.userService.getUser(this.otherUserId).pipe(
          take(1), // <<< Crucial: Complete after getting the user data once
          tap(otherUser => {
            console.log('Received other user:', otherUser);
            if (!otherUser) {
              // Handle case where user service returns null/undefined for non-existent user
              this.error = 'Impossible de trouver les informations pour cet utilisateur.';
              throw new Error(this.error); // Throw error
            }
            this.otherUser = otherUser;
          }),
          catchError(err => { // Catch errors specifically from userService.getUser
            console.error('Error fetching other user:', err);
            this.error = 'Erreur lors de la récupération des informations utilisateur.';
            // Don't re-throw here if you want finalize to run, just return an empty observable or handle
            return of(null); // Allows the main stream to continue to finalize, but otherUser will be null
          })
        );
      }),
      // finalize() runs when the source observable completes or errors
      finalize(() => {
        console.log('Finalize loadUserData pipe. isLoading set to false.');
        this.isLoading = false;
      }),
      // Catch errors thrown earlier in the pipe (from auth checks)
      catchError(err => {
        console.error('Error in loadUserData stream:', err.message);
        // Error message should already be set in the tap operators
        // Ensure loading is stopped if an error was thrown
        this.isLoading = false;
        return of(null); // Return an empty observable to complete the stream gracefully
      })
    ).subscribe(); // We need to subscribe to trigger the pipe

    this.subscriptions.add(loadSub);
  }

  async startConversation() {
    // Additional check: Ensure otherUser is loaded and no error state
    if (!this.initialMessage.trim() || !this.currentUserId || !this.otherUser || this.error) {
      console.warn('Cannot start conversation. Conditions not met:',
        { msg: !this.initialMessage.trim(), uid: !this.currentUserId, other: !this.otherUser, err: this.error });
      return;
    }

    this.isLoading = true; // Show loading indicator during conversation creation/send

    try {
      console.log('Starting conversation between', this.currentUserId, 'and', this.otherUserId);

      // Créer ou récupérer la conversation
      const conversationId = await this.chatService.getOrCreateConversation(
        this.currentUserId,
        this.otherUserId
      );

      console.log('Conversation created/found:', conversationId);

      // Envoyer le premier message
      await this.chatService.sendMessage(
        conversationId,
        this.currentUserId, // Sender ID
        this.initialMessage.trim() // Trimmed message
      );

      console.log('Initial message sent, navigating to chat detail:', conversationId);

      // Rediriger vers la conversation using NavController for potentially smoother transition
      // Use replaceUrl: true if you don't want the 'new chat' page in the back stack
      this.navCtrl.navigateForward(['/chat', conversationId], { replaceUrl: true });
      // Or stick with router: this.router.navigate(['/chat', conversationId], { replaceUrl: true });

    } catch (err) {
      console.error('Erreur lors de la création/envoi:', err);
      this.error = 'Une erreur est survenue. Veuillez réessayer.';
      // No need to set isLoading = false here, finally block handles it
    } finally {
      // Ensure isLoading is reset regardless of success or error
      this.isLoading = false;
      console.log('startConversation finished. isLoading set to false.');
    }
  }
}
