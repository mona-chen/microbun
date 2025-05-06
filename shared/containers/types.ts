// Type definitions for dependency injection
export const TYPES = {
  ApiClient: Symbol.for('ApiClient'),
  FincraProvider: Symbol.for('FincraProvider'),
  FincraConfig: Symbol.for('FincraConfig'),
  PaymentService: Symbol.for('PaymentService'),
  WalletServiceProvider: Symbol.for('WalletServiceProvider'),
  WalletService: Symbol.for('WalletService'),
  WalletController: Symbol.for('WalletController'),
  UserService: Symbol.for('UserService'),
  UserProvider: Symbol.for('UserProvider'),
  EventPublisher: Symbol.for('EventPublisher')
};
