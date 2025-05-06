import { inject, injectable } from 'inversify';
import { TYPES } from '../containers/types';
import { ApiClient } from './http.provider';
import { config } from '../config/environment';

export interface IUserProvider {
  getUserEmail(userId: string): Promise<string>;
  getUserProfile(userId: string): Promise<any>;
}

@injectable()
export class UserProvider implements IUserProvider {
  private apiClient: ApiClient;
  private baseUrl: string;

  constructor(
    @inject(TYPES.ApiClient) apiClient: ApiClient
  ) {
    this.apiClient = apiClient;
    this.baseUrl = config.USER_SERVICE_URL as string;
  }

  async getUserEmail(userId: string): Promise<string> {
    try {
      const response = await this.apiClient.get(`${this.baseUrl}/users/${userId}/email`);
      return response.data.email;
    } catch (error:any) {
      throw new Error(`Failed to get user email: ${error.message}`);
    }
  }

  async getUserProfile(userId: string): Promise<any> {
    try {
      const response = await this.apiClient.get(`${this.baseUrl}/users/${userId}/profile`);
      return response.data;
    } catch (error:any) {
      throw new Error(`Failed to get user profile: ${error.message}`);
    }
  }
} 