export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  updatedAt: number;
  createdAt: number;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'payment' | 'refund';
  description: string;
  paymentId?: string;
  bookingId?: string;
  createdAt: number;
  status: 'pending' | 'completed' | 'failed';
}
