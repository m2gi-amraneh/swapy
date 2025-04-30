import firebase from 'firebase/compat/app';

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export type UserRole = 'client' | 'provider';

export interface BaseUserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: UserRole;
  createdAt: firebase.firestore.Timestamp | number;
  lastActive?: firebase.firestore.Timestamp | number;
  isOnline?: boolean;
  phone?: string;
  businessName?: string;
  address?: Address;
}

export type UserProfile = BaseUserProfile & (ClientProfile | ProviderProfile);

export interface ClientProfile {
  favoriteServices?: string[];
  savedProviders?: string[];
  preferences?: {
    notifications?: boolean;
    language?: string;
  };
}

export interface ProviderProfile {
  businessName: string;
  profession: string;
  bio?: string;
  services?: string[];
  availability?: {
    [day: string]: {
      start: string;
      end: string;
    }[];
  };
  rating?: number;
  reviewCount?: number;
  verified?: boolean;
  badges?: string[];
  specialties?: string[];
  languages?: string[];
  certifications?: string[];
}
