export enum RoomStatus {
  AVAILABLE = 'AVAILABLE',
  SELECTED = 'SELECTED',
  LOCKED = 'LOCKED',
}

export interface Room {
  id: string;
  building: string;
  floor: number;
  number: string;
  area: number;
  price?: number;
  status: RoomStatus;
  ownerId?: string | null;
  timestamp?: number;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  maxSelections: number;
  isAdmin: boolean;
}

export interface AppState {
  rooms: Room[];
  users: User[];
  currentUser: User | null;
}

export interface GenerateConfig {
  buildingCount: number;
  floorsPerBuilding: number;
  roomsPerFloor: number;
  baseArea: number;
  buildingPrefix: string;
}