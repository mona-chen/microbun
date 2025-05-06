// shared/utils/heartbeat-manager.ts
import axios from 'axios';
import Logger from './logger';

interface HeartbeatOptions {
  serviceRegistryUrl: string;
  serviceId: string;
  heartbeatInterval: number;
  statusGetter?: () => Promise<'UP' | 'DOWN' | 'STARTING' | 'STOPPING'>;
  retryDelay?: number;
  maxRetries?: number;
}

export class HeartbeatManager {
  private serviceRegistryUrl: string;
  private serviceId: string;
  private heartbeatInterval: number;
  private statusGetter: () => Promise<'UP' | 'DOWN' | 'STARTING' | 'STOPPING'>;
  private retryDelay: number;
  private maxRetries: number;
  private logger = Logger.getLogger('HeartbeatManager');
  private intervalId: NodeJS.Timeout | null = null;
  private retryCount = 0;

  constructor(options: HeartbeatOptions) {
    this.serviceRegistryUrl = options.serviceRegistryUrl;
    this.serviceId = options.serviceId;
    this.heartbeatInterval = options.heartbeatInterval;
    this.statusGetter = options.statusGetter || (() => Promise.resolve('UP'));
    this.retryDelay = options.retryDelay || 5000;
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Start sending periodic heartbeats to the service registry
   */
  public start(): void {
    if (this.intervalId) {
      this.logger.warn('Heartbeat already running');
      return;
    }

    this.logger.info(`Starting heartbeat for service ID: ${this.serviceId}`);
    
    // Send immediate heartbeat
    this.sendHeartbeat();
    
    // Schedule regular heartbeats
    this.intervalId = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  /**
   * Stop sending heartbeats
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('Heartbeat stopped');
    }
  }

  /**
   * Send a single heartbeat to the service registry
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      const status = await this.statusGetter();
      const endpoint = `${this.serviceRegistryUrl}/heartbeat/${this.serviceId}`;
      
      this.logger.debug(`Sending heartbeat to ${endpoint} with status: ${status}`);
      
      const response = await axios.put(endpoint, { status });
      
      if (response.status === 200) {
        this.logger.debug('Heartbeat sent successfully');
        this.retryCount = 0; // Reset retry count on success
      } else {
        this.handleHeartbeatFailure(new Error(`Unexpected response: ${response.status}`));
      }
    } catch (error) {
      this.handleHeartbeatFailure(error as Error);
    }
  }

  /**
   * Handle heartbeat failures with retries
   */
  private handleHeartbeatFailure(error: Error): void {
    this.logger.error(`Failed to send heartbeat: ${error.message}`);
    
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.logger.info(`Retrying heartbeat in ${this.retryDelay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
      
      setTimeout(() => {
        this.sendHeartbeat();
      }, this.retryDelay);
    } else {
      this.logger.error(`Max retries (${this.maxRetries}) reached for heartbeat. Service may be marked as down.`);
      // Reset retry count for next scheduled heartbeat
      this.retryCount = 0;
    }
  }
}