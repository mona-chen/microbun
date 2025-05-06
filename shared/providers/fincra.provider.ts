import { inject, injectable } from 'inversify';
import type { IApiClient } from './http.provider';
import { TYPES } from '@shared/containers/types';

// Define interfaces for request/response types
export interface FincraConfig {
  FINCRA_API_URL: string;
  FINCRA_BUSINESS_ID: string;
}

export interface BankInstitution {
  id: string;
  name: string;
  code: string;
  country: string;
  currency: string;
}

export interface KYCInformation {
  firstName: string;
  lastName: string;
  bvn: string;
}

export interface AccountInformation {
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string;
}

export interface VirtualAccountResponse {
  _id: string;
  status: string;
  isActive: boolean;
  verifiedKYCData: boolean;
  note: string;
  accountOpeningFee: number;
  pendingAdditionalInfoCount: number;
  isPermanent: boolean;
  isSuspended: boolean;
  entityName: string;
  virtualAccountType: string;
  currency: string;
  accountType: string;
  entityType: string;
  currencyType: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  accountInformation: AccountInformation;
  amount?: number;
}

export interface TemporaryAccountParams {
  amount: number;
  expiresAt?: number;
  merchantReference?: string;
}

export interface CreateBankAccountParams {
  firstName: string;
  lastName: string;
  bvn: string;
}

export interface VerifyAccountParams {
  accountNumber: string;
  bankCode: string;
}

export interface TransferParams {
  senderName: string;
  amount: number;
  bankCode: string;
  accountNumber: string;
  narration: string;
  reference: string;
  currency?: string;
}

export interface RefundParams {
  reference: string;
}

export interface IFincraProvider {
  getInstitutions(params?: { country?: string; currency?: string }): Promise<BankInstitution[]>;
  getCollectionByMerchantRef(merchantReference: string): Promise<any>;
  createBankAccount(params: CreateBankAccountParams): Promise<VirtualAccountResponse>;
  createTemporaryAccount(params: TemporaryAccountParams): Promise<VirtualAccountResponse>;
  verifyAccountNumber(params: VerifyAccountParams): Promise<any>;
  refund(params: RefundParams): Promise<any>;
  getBankLogo(bankName: string): Promise<any>;
  makeTransfer(params: TransferParams): Promise<any>;
  fetchPayoutByRef(reference: string): Promise<any>;
  fetchVirtualAccountById(accountId: string): Promise<VirtualAccountResponse>;
}

@injectable()
export class FincraProvider implements IFincraProvider {
  private readonly baseUrl: string;
  private readonly businessId: string;

  constructor(
    @inject(TYPES.ApiClient) private api: IApiClient,
    @inject(TYPES.FincraConfig) private config: FincraConfig
  ) {
    this.baseUrl = this.config.FINCRA_API_URL;
    this.businessId = this.config.FINCRA_BUSINESS_ID;
  }

  async getInstitutions(params?: { country?: string; currency?: string }): Promise<BankInstitution[]> {
    try {
      const response = await this.api.get<{ success: boolean; data: BankInstitution[] }>(
        `${this.baseUrl}core/banks?country=${params?.country || 'NG'}&currency=${params?.currency || 'NGN'}`
      );
      return response.data;
    } catch (error: any) {
      console.error(
        '[fincra]: Error fetching institutions:',
        error?.response?.data ?? error.message
      );
      throw error?.response?.data ?? error.message;
    }
  }

  async getCollectionByMerchantRef(merchantReference: string): Promise<any> {
    try {
      const response = await this.api.get<{ success: boolean; data: any }>(
        `${this.baseUrl}collections/merchant-reference/${merchantReference}`
      );
      return response.data;
    } catch (error: any) {
      console.error(
        '[fincra]: Error fetching merchantReference:',
        error?.response?.data ?? error.message
      );
      throw error?.response?.data ?? error.message;
    }
  }

  async createBankAccount(params: CreateBankAccountParams): Promise<VirtualAccountResponse> {
    const payload = {
      currency: 'NGN',
      KYCInformation: {
        firstName: params.firstName,
        lastName: params.lastName,
        bvn: params.bvn,
      },
      channel: 'globus',
      accountType: 'individual',
    };

    try {
      const response = await this.api.post<{ success: boolean; data: VirtualAccountResponse }>(
        `${this.baseUrl}profile/virtual-accounts/requests/`,
        payload
      );
      
      return response.data;
    } catch (error: any) {
      console.error(
        '[fincra]: Error generating account number:',
        error.response?.data ?? error.message
      );
      throw error.response?.data ?? error.message;
    }
  }

  async createTemporaryAccount(params: TemporaryAccountParams): Promise<VirtualAccountResponse> {
    const payload = {
      amount: params.amount,
      expiresAt: params.expiresAt ?? 30,
      merchantReference: params.merchantReference ?? `TA-${Date.now()}`,
    };

    try {
      const response = await this.api.post<{ success: boolean; data: VirtualAccountResponse }>(
        `${this.baseUrl}profile/virtual-accounts/transfer/`, 
        payload
      );
      
      // Validate response data
      if (!response.data || !response.data._id || !response.data.accountInformation) {
        throw new Error('Invalid response data from the API.');
      }

      return response.data;
    } catch (error: any) {
      console.error(
        '[fincra]: Error generating temporary account number:', 
        error.response?.data ?? error.message
      );
      throw (error.response?.data ?? error.message);
    }
  }

  async verifyAccountNumber(params: VerifyAccountParams): Promise<any> {
    try {
      const response = await this.api.post<{ success: boolean; data: any }>(
        `${this.baseUrl}core/accounts/resolve`, 
        {
          accountNumber: params.accountNumber,
          bankCode: params.bankCode,
        }
      );
      return response;
    } catch (error: any) {
      console.error(
        '[fincra]: Error verifying account number:',
        error.response?.data ?? error.message
      );
      
      const err = new Error(`Error verifying account number`);
      (err as any).isSessionError = true;
      throw err;
    }
  }

  async refund(params: RefundParams): Promise<any> {
    try {
      const response = await this.api.post<{ success: boolean; data: any }>(
        `${this.baseUrl}collections/refund`, 
        {
          transReference: params.reference
        }
      );
      return response;
    } catch (error: any) {
      console.error(
        '[fincra]: Error processing refund:',
        error.response?.data ?? error.message
      );
      
      const err = new Error(`Error processing refund`);
      (err as any).isSessionError = true;
      throw err;
    }
  }

  async getBankLogo(bankName: string): Promise<any> {
    try {
      const response = await this.api.get<any>(
        `https://brandi.uncode.fun/search/${bankName}`
      );
      return response;
    } catch (error: any) {
      console.error(
        '[fincra]: Error fetching bank logo:',
        error?.response?.data ?? error.message
      );
      throw error?.response?.data ?? error.message;
    }
  }

  async makeTransfer(params: TransferParams): Promise<any> {
    try {
      const nubanInfo = await this.verifyAccountNumber({
        accountNumber: params.accountNumber,
        bankCode: params.bankCode
      });

      if (nubanInfo.success) {
        const name = nubanInfo.data.accountName.split(' ');
        
        const payload = {
          sourceCurrency: params.currency || 'NGN',
          destinationCurrency: params.currency || 'NGN',
          amount: params.amount,
          business: this.businessId,
          description: params.narration,
          customerReference: params.reference,
          beneficiary: {
            firstName: name[0],
            lastName: name[1] || name[0], // Fallback if no last name
            type: 'individual',
            accountHolderName: params.senderName,
            accountNumber: params.accountNumber,
            bankCode: params.bankCode
          },
          paymentDestination: 'bank_account'
        };
        
        const resp = await this.api.post<{ success: boolean; data: any }>(
          `${this.baseUrl}disbursements/payouts`, payload
        );

        if (resp.success) {
          return resp.data;
        } else {
          throw new Error('Transfer failed');
        }
      }
      
      throw new Error('Account verification failed');
    } catch (error: any) {
      console.error(
        '[fincra]: Error transferring money',
        error.response?.data ?? error.message
      );

      if ((error as any).isSessionError) {
        throw error;
      } else {
        throw error?.response?.data ?? error.message;
      }
    }
  }

  async fetchPayoutByRef(reference: string): Promise<any> {
    if (!reference) {
      throw new Error('Reference parameter is required.');
    }
    
    try {
      const response = await this.api.get<{ success: boolean; data: any }>(
        `${this.baseUrl}disbursements/payouts/customer-reference/${reference}`
      );

      if (response.data) {
        return response.data;
      } else {
        throw new Error('Unable to fetch transaction');
      }
    } catch (error: any) {
      console.error('[fincra]: Error fetching payout:', error?.response?.data ?? error.message);
      throw error?.response?.data ?? error.message;
    }
  }

  async fetchVirtualAccountById(accountId: string): Promise<VirtualAccountResponse> {
    if (!accountId) {
      throw new Error('Account ID is required.');
    }
    
    try {
      const response = await this.api.get<{ success: boolean; data: VirtualAccountResponse }>(
        `${this.baseUrl}profile/virtual-accounts/${accountId}`
      );

      if (response.data) {
        return response.data;
      } else {
        throw new Error('Unable to fetch virtual account');
      }
    } catch (error: any) {
      console.error('[fincra]: Error fetching virtual account:', error?.response?.data ?? error.message);
      throw error?.response?.data ?? error.message;
    }
  }
}