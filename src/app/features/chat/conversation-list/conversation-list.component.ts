import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Conversation } from '../../../core/models/chat.model';
import { UserProfile } from '../../../core/models/user.model';
import { ChatService } from '../../../core/services/chat.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-conversation-list',
  templateUrl: './conversation-list.component.html',
  styleUrls: ['./conversation-list.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, DatePipe]
})
export class ConversationListComponent implements OnInit {
  conversations$!: Observable<(Conversation & { otherUser: UserProfile | null, unreadCount: number })[]>;
  currentUserId: string | null = null;
  isLoading = true;

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.authService.user$.pipe(
      switchMap(user => {
        if (!user) return of([]);
        this.currentUserId = user.uid;
        
        return this.chatService.getUserConversations(user.uid).pipe(
          switchMap(conversations => {
            if (conversations.length === 0) {
              this.isLoading = false;
              return of([]);
            }
            
            return combineLatest(
              conversations.map(conversation => {
                // Trouver l'ID de l'autre participant
                const otherUserId = conversation.participants.find(id => id !== user.uid) || '';
                
                // Récupérer les informations de l'autre utilisateur
                const otherUser$ = this.userService.getUser(otherUserId);
                
                // Récupérer le nombre de messages non lus
                const unreadCount$ = this.chatService.getUnreadMessageCount(conversation.id, user.uid);
                
                return combineLatest([of(conversation), otherUser$, unreadCount$]).pipe(
                  map(([conversation, otherUser, unreadCount]) => ({
                    ...conversation,
                    otherUser,
                    unreadCount
                  }))
                );
              })
            );
          })
        );
      })
    ).subscribe(conversationsWithUsers => {
      this.conversations$ = of(conversationsWithUsers);
      this.isLoading = false;
    });
  }

  async deleteConversation(conversationId: string, event: Event) {
    event.stopPropagation();
    if (confirm('Êtes-vous sûr de vouloir supprimer cette conversation ?')) {
      await this.chatService.deleteConversation(conversationId);
    }
  }

  getLastMessageTime(timestamp: number): string {
    const now = new Date();
    const messageDate = new Date(timestamp);
    
    // Si c'est aujourd'hui, afficher l'heure
    if (messageDate.toDateString() === now.toDateString()) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Si c'est cette semaine, afficher le jour
    const daysDiff = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 7) {
      return messageDate.toLocaleDateString([], { weekday: 'short' });
    }
    
    // Sinon afficher la date
    return messageDate.toLocaleDateString();
  }

  getLastMessagePreview(content: string): string {
    return content.length > 30 ? content.substring(0, 30) + '...' : content;
  }
}
