export interface IntruderLog {
  id: string;
  timestamp: number;
  imageData: string; // Base64
  attemptNumber: number;
  aiAnalysis?: string;
}

export interface AppSettings {
  alertEmail: string;
  triggerThreshold: number;
  enableCapture: boolean;
}

export enum AppState {
  SETUP = 'SETUP',
  LOCKED = 'LOCKED',
  UNLOCKED = 'UNLOCKED'
}

export enum SecurityStatus {
  IDLE = 'IDLE',
  CHECKING = 'CHECKING',
  BREACH_DETECTED = 'BREACH_DETECTED',
  GRANTED = 'GRANTED'
}
