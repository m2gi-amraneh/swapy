export interface ServiceView {
  id?: string;
  userId: string;
  serviceId: string;
  viewedAt: Date;
  source?: string;
  duration?: number; 
}
