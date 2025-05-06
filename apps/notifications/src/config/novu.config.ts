import { Novu } from '@novu/node';
import { envConfig } from './env.config';

export class NovuConfig {
  private static instance: Novu;

  public static getInstance(): Novu {
    if (!this.instance) {
      this.instance = new Novu(envConfig.NOVU_API_KEY, {
        backendUrl: envConfig.NOVU_BACKEND_URL
      });
    }
    return this.instance;
  }
}

// Predefined notification templates
export const NOTIFICATION_TEMPLATES = {
  USER_SIGNUP: 'user-signup',
  PAYMENT_RECEIVED: 'payment-received',
  ACCOUNT_VERIFICATION: 'account-verification',
  PASSWORD_RESET: 'password-reset',
  
  // Wallet templates
  WALLET_CREATED: 'walletCreated',
  TRANSFER_COMPLETED: 'transferCompleted',
  WITHDRAWAL_COMPLETED: 'withdrawalCompleted',
  DEPOSIT_COMPLETED: 'depositCompleted'
} as const;