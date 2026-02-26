
export interface SensorData {
  mac: string;
  type?: string;
  alias?: string;
  power: number;
  time?: number;
  createTime?: number; // Used in historical lists
  temperature?: number;
  humidity?: number;
  hchoPpm?: number;
  co2?: number;
  tvocPpm?: number;
  pm25?: number;
  pm10?: number;
  light?: number;
  pressure?: number;
  vocIndex?: number;
  vocRaw?: number;
  uv?: number;
  o3Ppm?: number;
  water?: number; // For JW-U devices
  lastSync?: string; // Client-side helper
  status?: 'online' | 'offline'; // Client-side helper
  rawData?: string; // For debugging/parsing demonstration
}

export interface ApiResponse<T> {
  code: string | number;
  message: string;
  data: T;
}

export interface LoginResponse {
  token: string;
}

export interface DeviceListData {
  total: number;
  power?: number; // Sometimes returned at top level
  list: SensorData[];
}

export enum AppScreen {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  SCAN = 'SCAN',
  DETAILS = 'DETAILS',
  EXPORT = 'EXPORT',
  ALERTS = 'ALERTS',
  RECIPIENTS = 'RECIPIENTS',
  HISTORY = 'HISTORY',
  SETTINGS = 'SETTINGS',
  AI_CHAT = 'AI_CHAT',
  // New Settings Sub-screens
  SETTINGS_CONNECTIONS = 'SETTINGS_CONNECTIONS',
  SETTINGS_CALIBRATION = 'SETTINGS_CALIBRATION',
  SETTINGS_FIRMWARE = 'SETTINGS_FIRMWARE',
  SETTINGS_HELP = 'SETTINGS_HELP',
  SETTINGS_PRIVACY = 'SETTINGS_PRIVACY',
  SETTINGS_AI = 'SETTINGS_AI'
}
