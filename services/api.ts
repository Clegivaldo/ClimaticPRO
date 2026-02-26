
import { API_BASE_URL, MOCK_SENSORS } from '../constants';
import { ApiResponse, LoginResponse, DeviceListData } from '../types';

class ApiService {
  private token: string | null = null;
  private cache: Map<string, { time: number, data: any }> = new Map();
  private CACHE_DURATION = 55000; 

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('climatic_token', token);
  }

  getToken() {
    if (!this.token) {
        this.token = localStorage.getItem('climatic_token');
    }
    return this.token;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('climatic_token');
    this.cache.clear();
  }

  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    if (token === 'DEMO_TOKEN') {
        // Mock responses for demo mode
        return {} as T;
    }

    const isGet = !options.method || options.method === 'GET';
    const cacheKey = endpoint;

    if (isGet) {
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.time < this.CACHE_DURATION)) {
            return cached.data;
        }
    }

    const headers = new Headers(options.headers);
    
    if (token) {
      headers.append('Authorization', token);
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const json: ApiResponse<T> = await response.json();

        if (json.code != 0 && json.code != "0") {
             if (json.code == 3 || json.code == "3") {
                 this.logout();
                 throw new Error("Sessão expirada. Faça login novamente.");
             }

             let errorMessage = json.message || '';
             
             if (errorMessage === '无效账号' || errorMessage === 'Invalid account') {
                 errorMessage = 'Conta não encontrada. Para telefones, certifique-se que a conta foi criada previamente. Para acesso imediato, use um e-mail.';
             } 
             else if (errorMessage === '验证码错误' || errorMessage === 'Verification code error') {
                 errorMessage = 'Código de verificação incorreto.';
             } 
             else if (errorMessage.includes('频繁') || errorMessage.includes('frequency') || errorMessage.includes('请求频率过快')) {
                 errorMessage = 'Muitas requisições. Aguarde alguns segundos...';
             }
             
            throw new Error(errorMessage || 'Erro na comunicação com o servidor');
        }
        
        if (isGet) {
            this.cache.set(cacheKey, { time: Date.now(), data: json.data });
        }

        return json.data;
    } catch (error: any) {
        if (isGet && (error.message.includes('Muitas requisições') || error.message.includes('frequency'))) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                return cached.data;
            }
        }
        console.error("API Request Failed:", error);
        throw error;
    }
  }

  async getVerificationCode(account: string) {
    const encodedAccount = encodeURIComponent(encodeURIComponent(account));
    return this.request(`/code?account=${encodedAccount}`);
  }

  async login(account: string, code: string, timeZone = "GMT+08:00") {
    return this.request<LoginResponse>('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account, code, timeZone })
    });
  }

  async getAllDeviceData(size = 100) {
    if (this.getToken() === 'DEMO_TOKEN') {
        return MOCK_SENSORS;
    }

    try {
        const response: any = await this.request(`/data/all?page=0&size=${size}&pageSize=${size}&limit=${size}`);
        
        if (Array.isArray(response)) {
            return response;
        } 
        if (response && Array.isArray(response.list)) {
            return response.list;
        }
        if (response && Array.isArray(response.data)) {
            return response.data;
        }

        return [];
    } catch (e) {
        console.error("Error fetching all devices:", e);
        throw e;
    }
  }

  async getJhtDeviceData(mac: string, page = 0, size = 50) {
    return this.request<DeviceListData>(`/data?bleMac=${mac}&page=${page}&size=${size}`);
  }

  async getJhtPulDeviceData(mac: string, page = 0, size = 50) {
    return this.request<DeviceListData>(`/htplu?bleMac=${mac}&page=${page}&size=${size}`);
  }

  async getJtpUpDeviceData(mac: string, page = 0, size = 50) {
    return this.request<DeviceListData>(`/pt?bleMac=${mac}&page=${page}&size=${size}`);
  }

  async getJwUpDeviceData(mac: string, page = 0, size = 50) {
    return this.request<DeviceListData>(`/water?bleMac=${mac}&page=${page}&size=${size}`);
  }

  async getHistoryByDeviceType(mac: string, type: string = '') {
      const t = type.toLowerCase();
      if (t.includes('pt100') || t.includes('thermocouple')) {
          return this.getJtpUpDeviceData(mac);
      }
      if (t.includes('pressure') || t.includes('uv') || t.includes('light')) {
          return this.getJhtPulDeviceData(mac);
      }
      if (t.includes('water')) {
          return this.getJwUpDeviceData(mac);
      }
      return this.getJhtDeviceData(mac);
  }
}

export const api = new ApiService();
