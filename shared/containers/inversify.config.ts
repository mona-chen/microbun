import { Container } from 'inversify';
import { ApiClient } from '../providers/http.provider';
import { FincraProvider } from '../providers/fincra.provider';
import { WalletServiceProvider } from '../providers/wallet.provider';
import { TYPES } from './types';
import { UserProvider } from '@shared/providers/user.provider';
import { RabbitMQService } from '@shared/events';

// Create and configure the container
const container = new Container();

// Bind HTTP client
container.bind<ApiClient>(TYPES.ApiClient).to(ApiClient).inSingletonScope();

// Bind Fincra provider
container.bind<FincraProvider>(TYPES.FincraProvider).to(FincraProvider).inSingletonScope();
container.bind(TYPES.FincraConfig).toConstantValue({
  apiUrl: String(process.env.FINCRA_API_URL || ''),
  businessId: String(process.env.FINCRA_BUSINESS_ID || '')
});

// Bind Wallet service provider
container.bind<WalletServiceProvider>(TYPES.WalletServiceProvider).to(WalletServiceProvider).inSingletonScope();
container.bind<UserProvider>(TYPES.UserProvider).to(UserProvider).inSingletonScope();
container.bind(TYPES.EventPublisher).toConstantValue(RabbitMQService.getInstance());

export { container, TYPES };