export type NotificationType =
  'message' |
  'booking' |
  'booking_request' | 'booking_in_progress' |
  'booking_confirmation' |
  'booking_cancellation' |
  'booking_completed' |
  'payment_received' |
  'payment_confirmed' | 'payment_reminder' |
  'review' |
  'service_update' |
  'system';

export interface NotificationMetadata {
  [key: string]: any;
  conversationId?: string;
  senderId?: string;
  bookingId?: string;
  serviceId?: string;
  serviceName?: string;
  providerId?: string;
  clientId?: string;
  reviewerId?: string;
  rating?: number;
  reason?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  body?: string;
  metadata?: NotificationMetadata;
  read: boolean;
  createdAt: number;
  updatedAt: number;
}
