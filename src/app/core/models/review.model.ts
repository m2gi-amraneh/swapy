export interface Review {
  id: string;
  serviceId: string;
  providerId: string;
  clientId: string;
  bookingId: string;
  rating: number;
  comment?: string;
  photos?: string[];
  providerResponse?: {
    comment: string;
    createdAt: number;
  };
  createdAt: number;
  updatedAt: number;
}
