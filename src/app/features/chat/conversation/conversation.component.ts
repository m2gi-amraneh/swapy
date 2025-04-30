import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, IonContent, ActionSheetController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { Message, Conversation } from '../../../core/models/chat.model';
import { UserProfile } from '../../../core/models/user.model';
import { ChatService } from '../../../core/services/chat.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-conversation',
  templateUrl: './conversation.component.html',
  styleUrls: ['./conversation.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class ConversationComponent implements OnInit, AfterViewChecked {
  @ViewChild(IonContent) content!: IonContent;
  @ViewChild('messageInput') messageInput!: ElementRef;

  conversationId!: string;
  messages$!: Observable<Message[]>;
  otherUser$!: Observable<UserProfile | null>;
  currentUserId: string | null = null;
  newMessage: string = '';
  isLoading = true;
  shouldScrollToBottom = true;

  constructor(
    private route: ActivatedRoute,
    private chatService: ChatService,
    private authService: AuthService,
    private userService: UserService,
    private actionSheetCtrl: ActionSheetController
  ) {}

  ngOnInit() {
    this.conversationId = this.route.snapshot.paramMap.get('id') || '';
    
    this.authService.user$.pipe(
      tap(user => {
        this.currentUserId = user?.uid || null;
        if (user) {
          // Marquer les messages comme lus
          this.chatService.markMessagesAsRead(this.conversationId, user.uid);
        }
      }),
      switchMap(user => {
        if (!user || !this.conversationId) return of(null);
        
        return this.chatService.getConversationMessages(this.conversationId).pipe(
          tap(messages => {
            this.isLoading = false;
            this.shouldScrollToBottom = true;
          }),
          map(messages => {
            // Trier les messages par ordre chronologique
            return messages.sort((a, b) => a.timestamp - b.timestamp);
          })
        );
      })
    ).subscribe(messages => {
      if (messages) {
        this.messages$ = of(messages);
      }
    });

    // Récupérer les informations de l'autre utilisateur
    this.otherUser$ = this.authService.user$.pipe(
      switchMap(user => {
        if (!user || !this.conversationId) return of(null);
        
        return this.chatService.getUserConversations(user.uid).pipe(
          switchMap(conversations => {
            const conversation = conversations.find(c => c.id === this.conversationId);
            if (!conversation) return of(null);
            
            const otherUserId = conversation.participants.find(id => id !== user.uid);
            if (!otherUserId) return of(null);
            
            return this.userService.getUser(otherUserId);
          })
        );
      })
    );
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  scrollToBottom() {
    if (this.content) {
      this.content.scrollToBottom(300);
    }
  }

  async sendMessage() {
    if (!this.newMessage.trim() || !this.currentUserId) return;
    
    await this.chatService.sendMessage(
      this.conversationId,
      this.currentUserId,
      this.newMessage.trim()
    );
    
    this.newMessage = '';
    this.shouldScrollToBottom = true;
    
    // Focus sur l'input après envoi
    setTimeout(() => {
      this.messageInput.nativeElement.focus();
    }, 100);
  }

  getMessageTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getMessageDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  }

  shouldShowDate(message: Message, index: number, messages: Message[]): boolean {
    if (index === 0) return true;
    
    const currentDate = new Date(message.timestamp).toDateString();
    const previousDate = new Date(messages[index - 1].timestamp).toDateString();
    
    return currentDate !== previousDate;
  }

  isConsecutiveMessage(message: Message, index: number, messages: Message[]): boolean {
    if (index === 0) return false;
    
    const previousMessage = messages[index - 1];
    const timeDiff = message.timestamp - previousMessage.timestamp;
    
    // Si moins de 5 minutes d'écart et même expéditeur
    return timeDiff < 5 * 60 * 1000 && message.senderId === previousMessage.senderId;
  }

  async openAttachmentOptions() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Joindre',
      buttons: [
        {
          text: 'Photo',
          icon: 'image-outline',
          handler: () => {
            this.attachImage();
          }
        },
        {
          text: 'Fichier',
          icon: 'document-outline',
          handler: () => {
            this.attachFile();
          }
        },
        {
          text: 'Annuler',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  attachImage() {
    // Implémentation à venir
    console.log('Attacher une image');
  }

  attachFile() {
    // Implémentation à venir
    console.log('Attacher un fichier');
  }

  openImage(imageUrl?: string) {
    if (imageUrl) {
      window.open(imageUrl, '_blank');
    }
  }

  downloadFile(fileUrl?: string, fileName?: string) {
    if (fileUrl && fileName) {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }
}
