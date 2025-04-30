export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  timestamp: number;
  read: boolean;
  type: 'text' | 'image' | 'file';
  metadata?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    imageUrl?: string;
  };
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: {
    content: string;
    timestamp: number;
    senderId: string;
  };
  createdAt: number;
  updatedAt: number;
  metadata?: {
    serviceId?: string;
    bookingId?: string;
  };
}
