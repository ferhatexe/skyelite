import { Request } from 'express';

export interface AdminPayload {
  id: number;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  admin?: AdminPayload;
}

export interface Courier {
  id: number;
  name: string;
  device_id: string;
  device_info?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface LocationData {
  id?: number;
  courier_id: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: string;
}
