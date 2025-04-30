export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  text?: string;
  imageUrl?: string;
  locationUrl?: string;
  read: boolean;
  createdAt: number;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: {
    text: string;
    senderId: string;
    createdAt: number;
  };
  unreadCount?: {
    [userId: string]: number;
  };
  createdAt: number;
  updatedAt: number;
}
