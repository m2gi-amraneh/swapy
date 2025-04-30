import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collectionData, 
  docData 
} from '@angular/fire/firestore';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { Message, Conversation } from '../models/chat.model';
import { UserService } from './user.service';
import { NotificationService } from './notification.service';
import { writeBatch } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  constructor(
    private firestore: Firestore,
    private userService: UserService,
    private notificationService: NotificationService
  ) {}

  /**
   * Crée ou récupère une conversation entre deux utilisateurs
   */
  async getOrCreateConversation(user1Id: string, user2Id: string, metadata?: Conversation['metadata']): Promise<string> {
    // Vérifier si une conversation existe déjà
    const conversationsRef = collection(this.firestore, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', user1Id)
    );
    
    const querySnapshot = await getDocs(q);
    
    // Chercher une conversation existante
    for (const docSnapshot of querySnapshot.docs) {
      const data = docSnapshot.data() as Conversation;
      if (data.participants.includes(user2Id) && data.participants.length === 2) {
        return docSnapshot.id;
      }
    }

    // Créer une nouvelle conversation
    const conversationId = doc(collection(this.firestore, 'conversations')).id;
    const timestamp = Date.now();

    const newConversation: Conversation = {
      id: conversationId,
      participants: [user1Id, user2Id],
      createdAt: timestamp,
      updatedAt: timestamp,
      lastMessage: {
        content: '',
        senderId: '',
        timestamp: timestamp
      },
      metadata: metadata || {}
    };

    await setDoc(doc(this.firestore, 'conversations', conversationId), newConversation);
    
    return conversationId;
  }

  /**
   * Récupère toutes les conversations d'un utilisateur
   */
  getUserConversations(userId: string): Observable<Conversation[]> {
    const conversationsRef = collection(this.firestore, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );
    
    return collectionData(q, { idField: 'id' }) as Observable<Conversation[]>;
  }

  /**
   * Récupère les messages d'une conversation
   */
  getConversationMessages(conversationId: string, messageLimit: number = 50): Observable<Message[]> {
    const messagesRef = collection(this.firestore, 'messages');
    const q = query(
      messagesRef,
      where('conversationId', '==', conversationId),
      orderBy('timestamp', 'desc'),
      limit(messageLimit)
    );
    
    return collectionData(q, { idField: 'id' }).pipe(
      map(messages => (messages as Message[]).reverse())
    );
  }

  /**
   * Envoie un message dans une conversation
   */
  async sendMessage(
    conversationId: string, 
    senderId: string, 
    content: string, 
    type: Message['type'] = 'text', 
    metadata?: Message['metadata']
  ): Promise<string> {
    const messageId = doc(collection(this.firestore, 'messages')).id;
    const timestamp = Date.now();
    
    const message: Message = {
      id: messageId,
      conversationId,
      senderId,
      content,
      type,
      timestamp,
      read: false,
      metadata: metadata || {}
    };
    
    // Ajouter le message
    await setDoc(doc(this.firestore, 'messages', messageId), message);
    
    // Mettre à jour la conversation
    await updateDoc(doc(this.firestore, 'conversations', conversationId), {
      lastMessage: {
        content: content.length > 50 ? content.substring(0, 47) + '...' : content,
        senderId,
        timestamp
      },
      updatedAt: timestamp
    });
    
    // Envoyer une notification aux autres participants
    const conversationDoc = await getDocs(query(collection(this.firestore, 'conversations'), where('id', '==', conversationId))).then(snapshot => snapshot.docs[0]);
    
    if (conversationDoc) {
      const conversationData = conversationDoc.data() as Conversation;
      const otherParticipants = conversationData.participants.filter(id => id !== senderId);
      
      // Obtenir le nom de l'expéditeur
      const sender = await this.userService.getUser(senderId).pipe(
        map(user => user?.displayName || 'Utilisateur'),
        take(1)
      ).toPromise();
      
      for (const participantId of otherParticipants) {
        await this.notificationService.notifyNewMessage(
          participantId, 
          senderId, 
          sender as string, 
          conversationId, 
          content
        );
      }
    }

    return messageId;
  }

  /**
   * Marque les messages comme lus
   */
  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    const messagesRef = collection(this.firestore, 'messages');
    const q = query(
      messagesRef,
      where('conversationId', '==', conversationId),
      where('senderId', '!=', userId),
      where('read', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const batch = writeBatch(this.firestore);
      
      querySnapshot.docs.forEach(docSnapshot => {
        batch.update(doc(this.firestore, 'messages', docSnapshot.id), { read: true });
      });
      
      await batch.commit();
    }
  }

  /**
   * Récupère le nombre de messages non lus par conversation
   */
  getUnreadMessageCount(conversationId: string, userId: string): Observable<number> {
    const messagesRef = collection(this.firestore, 'messages');
    const q = query(
      messagesRef,
      where('conversationId', '==', conversationId),
      where('senderId', '!=', userId),
      where('read', '==', false)
    );
    
    return collectionData(q).pipe(
      map(messages => messages.length)
    );
  }

  /**
   * Récupère le nombre total de messages non lus pour un utilisateur
   */
  getTotalUnreadCount(userId: string): Observable<number> {
    return this.getUserConversations(userId).pipe(
      switchMap(conversations => {
        if (conversations.length === 0) {
          return of(0);
        }
        
        const unreadObservables = conversations.map(conversation => 
          this.getUnreadMessageCount(conversation.id, userId)
        );
        
        return combineLatest(unreadObservables).pipe(
          map(counts => counts.reduce((total, count) => total + count, 0))
        );
      })
    );
  }

  /**
   * Supprime une conversation et ses messages
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const messagesRef = collection(this.firestore, 'messages');
    const q = query(messagesRef, where('conversationId', '==', conversationId));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const batch = writeBatch(this.firestore);
      
      querySnapshot.docs.forEach(docSnapshot => {
        batch.delete(doc(this.firestore, 'messages', docSnapshot.id));
      });
      
      // Supprimer la conversation
      batch.delete(doc(this.firestore, 'conversations', conversationId));
      
      await batch.commit();
    } else {
      // Si pas de messages, supprimer uniquement la conversation
      await deleteDoc(doc(this.firestore, 'conversations', conversationId));
    }
  }
}