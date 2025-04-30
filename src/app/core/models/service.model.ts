export interface Service {
  id: string;
  providerId: string;
  title: string;
  name?: string; 
  description: string;
  price: number;
  category: string;
  location?: string;
  status: 'active' | 'pending' | 'inactive';
  createdAt: number;
  updatedAt?: number;
  duration?: number;
  rating?: number;
  reviewCount?: number;
  images?: string[];
  photos?: string[]; 
  ratings?: number[];
  views?: number;
}
