export const EXCHANGE_TYPES = {
    TOPIC: 'topic',
    DIRECT: 'direct',
    FANOUT: 'fanout',
  } as const;
  

export const EXCHANGES = {
  AUTH: 'user.events',
  PAYMENT: 'payment.events',
  NOTIFICATION: 'notification.events',
  BUSINESS: 'business.events',
  WALLET: 'wallet.events',
  COMPLIANCE: 'compliance.events',
  DEAD_LETTER: 'dead.letter',
} as const;

export const ExchangeConfig = {
  [EXCHANGES.AUTH]: EXCHANGE_TYPES.TOPIC,
  [EXCHANGES.PAYMENT]: EXCHANGE_TYPES.TOPIC,
  [EXCHANGES.NOTIFICATION]: EXCHANGE_TYPES.TOPIC,
  [EXCHANGES.BUSINESS]: EXCHANGE_TYPES.TOPIC,
  [EXCHANGES.WALLET]: EXCHANGE_TYPES.TOPIC,
  [EXCHANGES.COMPLIANCE]: EXCHANGE_TYPES.TOPIC,
  [EXCHANGES.DEAD_LETTER]: EXCHANGE_TYPES.TOPIC,
};