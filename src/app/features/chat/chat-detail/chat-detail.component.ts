import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, Subscription, combineLatest, of } from 'rxjs';
import { map, switchMap, tap, catchError, finalize } from 'rxjs/operators';

import { ChatService } from '../../../core/services/chat.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { Message } from '../../../core/models/chat.model';
import { UserProfile } from '../../../core/models/user.model';

@Component({
  selector: 'app-chat-detail',
  templateUrl: './chat-detail.component.html',
  styleUrls: ['./chat-detail.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    RouterModule
  ]
})
export class ChatDetailComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messageContainer') messageContainer!: ElementRef;
  
  conversationId!: string;
  messages: Message[] = [];
  otherUser: UserProfile | null = null;
  currentUserId: string | null = null;
  newMessage: string = '';
  isLoading = true;
  error: string = '';
  shouldScrollToBottom = true;
  
  private subscriptions: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private chatService: ChatService,
    private authService: AuthService,
    private userService: UserService
  ) {}

  ngOnInit() {
    console.log('ChatDetailComponent initialized');
    this.conversationId = this.route.snapshot.paramMap.get('id') || '';
    console.log('Conversation ID:', this.conversationId);
    
    if (!this.conversationId) {
      this.error = 'Invalid conversation ID';
      this.isLoading = false;
      return;
    }
    
    this.loadMessages();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  loadMessages() {
    this.isLoading = true;
    this.error = '';
    
    console.log('Loading messages for conversation:', this.conversationId);
    
    const authSub = this.authService.user$.pipe(
      tap(user => {
        console.log('Current user:', user);
        this.currentUserId = user ? user.uid : null;
        
        if (user) {
          // Mark messages as read when opening the conversation
          this.chatService.markMessagesAsRead(this.conversationId, user.uid);
        }
      }),
      switchMap(user => {
        if (!user) {
          this.isLoading = false;
          this.error = 'Please log in to view messages';
          return of(null);
        }
        
        // Get conversation details to find the other user
        return this.chatService.getUserConversations(user.uid).pipe(
          map(conversations => conversations.find(conv => conv.id === this.conversationId)),
          switchMap(conversation => {
            if (!conversation) {
              this.error = 'Conversation not found';
              this.isLoading = false;
              return of(null);
            }
            
            const otherUserId = conversation.participants.find(id => id !== user.uid);
            
            if (!otherUserId) {
              this.error = 'Could not find the other participant';
              this.isLoading = false;
              return of(null);
            }
            
            // Get other user's profile
            const otherUser$ = this.userService.getUser(otherUserId);
            
            // Get messages
            const messages$ = this.chatService.getConversationMessages(this.conversationId);
            
            return combineLatest([otherUser$, messages$]).pipe(
              tap(([otherUser, messages]) => {
                console.log('Other user:', otherUser);
                console.log('Messages:', messages);
                
                this.otherUser = otherUser;
                this.messages = messages;
                this.shouldScrollToBottom = true;
                this.isLoading = false;
              }),
              catchError(err => {
                console.error('Error loading conversation data:', err);
                this.error = 'Failed to load conversation data. Please try again.';
                this.isLoading = false;
                return of(null);
              })
            );
          }),
          catchError(err => {
            console.error('Error finding conversation:', err);
            this.error = 'Failed to find conversation. Please try again.';
            this.isLoading = false;
            return of(null);
          })
        );
      })
    ).subscribe({
      error: (err) => {
        console.error('Unexpected error in chat detail component:', err);
        this.error = 'An unexpected error occurred. Please try again.';
        this.isLoading = false;
      }
    });
    
    this.subscriptions.add(authSub);
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.currentUserId) return;
    
    console.log('Sending message:', this.newMessage);
    
    this.chatService.sendMessage(this.conversationId, this.currentUserId, this.newMessage)
      .then(() => {
        console.log('Message sent successfully');
        this.newMessage = '';
        this.shouldScrollToBottom = true;
      })
      .catch(error => {
        console.error('Error sending message:', error);
        // Show error toast or message
      });
  }

  scrollToBottom() {
    if (this.messageContainer) {
      this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
    }
  }

  getMessageClasses(message: Message) {
    return {
      'sent': message.senderId === this.currentUserId,
      'received': message.senderId !== this.currentUserId
    };
  }

  getFormattedDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
