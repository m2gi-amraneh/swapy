// src/app/core/models/booking.model.ts

// Add 'awaiting_completion' and potentially 'in_progress' if needed
export type BookingStatus = 'pending' | 'confirmed' | 'canceled' | 'completed' | 'payment_pending' | 'in_progress' | 'awaiting_completion';

export interface Booking {
  id: string;
  serviceId: string;
  clientId: string;
  providerId: string;
  date: string; // Consider storing as Timestamp for easier querying if needed
  time: string; // Or combine date/time into a single Timestamp field
  status: BookingStatus;
  statusComment?: string;
  notes?: string;

  // Cancellation details
  canceledBy?: string; // 'client' or 'provider' or userId
  cancelReason?: string;
  canceledAt?: number; // Timestamp

  // Completion details
  clientCompletedAt?: number; // Timestamp when client marked as complete
  providerCompletedAt?: number; // Timestamp when provider marked as complete
  completedAt?: number; // Timestamp when *both* marked as complete (final completion)

  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
  totalPrice: number;
  timeSlot?: string; // Redundant if date/time cover it
  serviceName?: string; // Good for quick display, but can be fetched
  serviceImage?: string; // Good for quick display, but can be fetched
  extraFees?: number;
  appointmentDate?: string; // Redundant if 'date'/'time' or a Timestamp is used
  address?: string; // Address where the service takes place
}
