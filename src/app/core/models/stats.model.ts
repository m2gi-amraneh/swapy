export interface AppStats {
  id: string;
  totalUsers: number;
  totalServices: number;
  totalBookings: number;
  totalReviews: number;
  totalCompletedBookings: number;
  totalCanceledBookings: number;
  totalRevenue: number;
  updatedAt: number;
}

export interface DailyStats {
  id: string;
  date: string; // Format YYYY-MM-DD
  newUsers: number;
  newServices: number;
  newBookings: number;
  newReviews: number;
  completedBookings: number;
  canceledBookings: number;
  revenue: number;
}

export interface CategoryStats {
  id: string;
  categoryId: string;
  totalServices: number;
  totalBookings: number;
  totalReviews: number;
  averageRating: number;
  updatedAt: number;
}

export interface UserStats {
  id: string;
  userId: string;
  role: 'client' | 'provider';
  totalBookings: number;
  totalReviews: number;
  totalCanceledBookings: number;
  totalCompletedBookings: number;
  averageRating?: number; // Pour les prestataires
  totalRevenue?: number; // Pour les prestataires
  updatedAt: number;
}
