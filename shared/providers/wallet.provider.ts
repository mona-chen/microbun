import { injectable } from 'inversify';
import { ServiceRegistryManager } from '@shared/utils/registery';
import { HTTPClient } from '@shared/providers/http.provider';
import { logger } from '@shared/utils/logger';

export interface WalletServiceConfig {
  basePath?: string;
}

export interface IWalletServiceProvider {
  getUserProfile(userId: string): Promise<any>;
  getWalletByUserId(userId: string): Promise<any>;
  getWalletBalance(walletId: string): Promise<any>;
}

@injectable()
export class WalletServiceProvider implements IWalletServiceProvider {
  private readonly basePath: string;
  private readonly httpClient: HTTPClient;

  constructor(config: WalletServiceConfig = {}) {
    this.basePath = config.basePath || '';
    this.httpClient = new HTTPClient();
  }

  private async getServiceUrl(): Promise<string> {
    const services = await ServiceRegistryManager.discoverServices('Wallet');
    if (services.length === 0) {
      throw new Error('Wallet service not available');
    }
    const service = services[0]; // Get first available service
    return `http://${service.host}:${service.port}${this.basePath}`;
  }

  async getUserProfile(userId: string): Promise<any> {
    try {
      const baseUrl = await this.getServiceUrl();
      return await this.httpClient.get(`${baseUrl}/users/${userId}/profile`);
    } catch (error) {
      logger.error('Error fetching user profile from wallet service:', error);
      throw error;
    }
  }

  async getWalletByUserId(userId: string): Promise<any> {
    try {
      const baseUrl = await this.getServiceUrl();
      return await this.httpClient.get(`${baseUrl}/users/${userId}/wallets`);
    } catch (error) {
      logger.error('Error fetching user wallets from wallet service:', error);
      throw error;
    }
  }

  async getWalletBalance(walletId: string): Promise<any> {
    try {
      const baseUrl = await this.getServiceUrl();
      return await this.httpClient.get(`${baseUrl}/wallets/${walletId}/balance`);
    } catch (error) {
      logger.error('Error fetching wallet balance from wallet service:', error);
      throw error;
    }
  }
} 