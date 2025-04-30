export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Address {
  id?: string;
  street: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  coordinates?: Coordinates;
  isDefault?: boolean;
  label?: string; // e.g., "Home", "Work", etc.
}

export interface City {
  id: string;
  name: string;
  state: string;
  country: string;
  coordinates?: Coordinates;
}
