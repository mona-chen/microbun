export const EXCHANGE_TYPES = {
  TOPIC: 'topic',
  DIRECT: 'direct',
  FANOUT: 'fanout',
} as const;

export type ExchangeType = typeof EXCHANGE_TYPES[keyof typeof EXCHANGE_TYPES];

export const EXCHANGES = {
  AUTH: 'user.events',
  PAYMENT: 'payment.events',
  NOTIFICATION: 'notification.events',
  NOTIFICATION_BROADCAST: 'notification.broadcast',
  NOTIFICATION_DIRECT: 'notification.direct',
  BUSINESS: 'business.events',
  WALLET: 'wallet.events',
  COMPLIANCE: 'compliance.events',
  DEAD_LETTER: 'dead.letter',
} as const;

export type Exchange = typeof EXCHANGES[keyof typeof EXCHANGES];

export const ExchangeConfig: Record<Exchange, ExchangeType> = {
  [EXCHANGES.AUTH]: EXCHANGE_TYPES.TOPIC,
  [EXCHANGES.PAYMENT]: EXCHANGE_TYPES.TOPIC,
  [EXCHANGES.NOTIFICATION]: EXCHANGE_TYPES.TOPIC,
  [EXCHANGES.NOTIFICATION_BROADCAST]: EXCHANGE_TYPES.FANOUT,
  [EXCHANGES.NOTIFICATION_DIRECT]: EXCHANGE_TYPES.DIRECT,
  [EXCHANGES.BUSINESS]: EXCHANGE_TYPES.TOPIC,
  [EXCHANGES.WALLET]: EXCHANGE_TYPES.TOPIC,
  [EXCHANGES.COMPLIANCE]: EXCHANGE_TYPES.TOPIC,
  [EXCHANGES.DEAD_LETTER]: EXCHANGE_TYPES.TOPIC,
};