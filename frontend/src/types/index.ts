export interface Courier {
  id: number;
  name: string;
  device_id: string;
  device_info?: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  last_update?: string | null;
}

export interface LocationHistory {
  id: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: string;
}

export interface Admin {
  id: number;
  email: string;
}

export interface AuthState {
  token: string | null;
  admin: Admin | null;
  isAuthenticated: boolean;
  loading: boolean;
}
