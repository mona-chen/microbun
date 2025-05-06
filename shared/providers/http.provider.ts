import axios,  { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { injectable } from 'inversify';

export interface IApiClient {
  get<T = any>(url: string): Promise<T>;
  post<T = any>(url: string, data?: any): Promise<T>;
  patch<T = any>(url: string, data?: any): Promise<T>;
  request<T = any>(method: string, url: string, data?: any): Promise<T>;
}

@injectable()
export class ApiClient implements IApiClient {
  private bearer: string;
  private authWord: string;
  private headers: Record<string, string>;

  constructor(bearer = '', authWord = '', headers = {}) {
    this.bearer = bearer;
    this.authWord = authWord;
    this.headers = headers;
  }

  async get<T = any>(url: string): Promise<T> {
    return this.request<T>('GET', url);
  }

  async post<T = any>(url: string, data?: any): Promise<T> {
    return this.request<T>('POST', url, data);
  }

  async patch<T = any>(url: string, data?: any): Promise<T> {
    return this.request<T>('PATCH', url, data);
  }

  async request<T = any>(method: string, url: string, data?: any): Promise<T> {
    const options: AxiosRequestConfig = {
      method,
      url,
      headers: {
        accept: 'application/json',
        Authorization: `${this.authWord || 'Bearer'} ${String(this.bearer)}`,
        ...this.headers,
      },
      data: data || undefined,
    };

    try {
      const response: AxiosResponse<T> = await axios.request(options);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export {ApiClient as HTTPClient}