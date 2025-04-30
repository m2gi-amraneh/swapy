export type PaymentMethod = 'cash' | 'card' | 'baridiMob' | 'edahabia' | 'wallet';

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  bookingId: string;
  clientId: string;
  providerId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  receipt?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}
