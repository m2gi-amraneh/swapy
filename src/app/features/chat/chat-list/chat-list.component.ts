import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { Observable, Subscription, combineLatest, of } from 'rxjs';
import { map, switchMap, tap, catchError, finalize } from 'rxjs/operators';

import { ChatService } from '../../../core/services/chat.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { Conversation } from '../../../core/models/chat.model';
import { UserProfile } from '../../../core/models/user.model';

interface ConversationWithUser extends Conversation {
  otherUser: UserProfile | {
    uid: string;
    displayName: string;
    photoURL: string;
    firstName?: string;
    lastName?: string;
    role?: 'client' | 'provider';
    createdAt?: number;
    updatedAt?: number;
  };
  unreadCount: number;
}

@Component({
  selector: 'app-chat-list',
  templateUrl: './chat-list.component.html',
  styleUrls: ['./chat-list.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule
  ]
})
export class ChatListComponent implements OnInit, OnDestroy {
  conversations: ConversationWithUser[] = [];
  currentUserId: string | null = null;
  isLoading = true;
  error: string = '';
  private subscriptions: Subscription = new Subscription();

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private userService: UserService
  ) {}

  ngOnInit() {
    console.log('ChatListComponent initialized');
    this.loadConversations();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadConversations() {
    this.isLoading = true;
    this.error = '';
    
    console.log('Loading conversations');
    
    const authSub = this.authService.user$.pipe(
      tap(user => {
        console.log('Current user:', user);
        this.currentUserId = user ? user.uid : null;
      }),
      switchMap(user => {
        if (!user) {
          this.isLoading = false;
          this.error = 'Please log in to view your messages';
          return of([]);
        }
        
        return this.chatService.getUserConversations(user.uid).pipe(
          switchMap(conversations => {
            if (conversations.length === 0) {
              this.isLoading = false;
              return of([]);
            }
            
            const conversationsWithUsers = conversations.map(conversation => {
              const otherUserId = conversation.participants.find(id => id !== user.uid);
              
              if (!otherUserId) {
                return of({
                  ...conversation,
                  otherUser: {
                    uid: 'unknown',
                    displayName: 'Unknown User',
                    photoURL: ''
                  },
                  unreadCount: 0
                });
              }
              
              return combineLatest([
                this.userService.getUser(otherUserId),
                this.chatService.getUnreadMessageCount(conversation.id, user.uid)
              ]).pipe(
                map(([otherUser, unreadCount]) => ({
                  ...conversation,
                  otherUser: otherUser || {
                    uid: otherUserId,
                    displayName: 'Utilisateur',
                    photoURL: ''
                  },
                  unreadCount
                })),
                catchError(err => {
                  console.error(`Error loading user ${otherUserId} or unread count:`, err);
                  return of({
                    ...conversation,
                    otherUser: {
                      uid: otherUserId,
                      displayName: 'Utilisateur',
                      photoURL: ''
                    },
                    unreadCount: 0
                  });
                })
              );
            });
            
            return conversationsWithUsers.length > 0 
              ? combineLatest(conversationsWithUsers)
              : of([]);
          }),
          tap(conversationsWithUsers => {
            console.log('Conversations loaded:', conversationsWithUsers);
            this.conversations = conversationsWithUsers.sort((a, b) => {
              const timeA = a.lastMessage?.timestamp || 0;
              const timeB = b.lastMessage?.timestamp || 0;
              return timeB - timeA;
            });
            this.isLoading = false;
          }),
          catchError(err => {
            console.error('Error loading conversations:', err);
            this.error = 'Failed to load conversations. Please try again.';
            this.isLoading = false;
            return of([]);
          })
        );
      })
    ).subscribe({
      error: (err) => {
        console.error('Unexpected error in chat list component:', err);
        this.error = 'An unexpected error occurred. Please try again.';
        this.isLoading = false;
      }
    });
    
    this.subscriptions.add(authSub);
  }

  doRefresh(event: any) {
    this.loadConversations();
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }

  getRelativeTime(timestamp?: number): string {
    if (!timestamp) return 'Jamais';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    // Less than a minute
    if (diff < 60000) {
      return 'À l\'instant';
    }
    
    // Less than an hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `Il y a ${minutes} min`;
    }
    
    // Less than a day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `Il y a ${hours}h`;
    }
    
    // Less than a week
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `Il y a ${days}j`;
    }
    
    // Format as date
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR');
  }
}
