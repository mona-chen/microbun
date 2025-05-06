// shared/utils/registry.ts
import { config } from "@shared/config/environment";
import Logger from "@shared/utils/logger";
import axios from "axios";

interface ServiceRegistrationParams {
  port: number;
  name?: string;
  version?: string;
  description?: string;
  host?: string;
  healthEndpoint?: string;
}

interface ServiceRegistryConfig {
  url: string;
  heartbeatInterval?: number;
  retryDelay?: number;
  maxRetries?: number;
}

export class ServiceRegistryManager {
  private static logger = Logger.getLogger("ServiceRegistryManager");
  private static serviceId: string | null = null;
  private static heartbeatInterval: NodeJS.Timeout | null = null;
  private static appName: string = '';
  private static registryConfig: ServiceRegistryConfig;
  private static retryCount: number = 0;
  private static isRegistering: boolean = false;

  /**
   * Register the service with the service registry
   * @param params Service registration parameters
   * @returns Promise resolving to the service ID or null
   */
  static async register({
    port, 
    name = 'app-service', 
    version = '1.0.0', 
    description = '',
    host = process.env.HOST as string || 'localhost',
    healthEndpoint = '/health'
  }: ServiceRegistrationParams): Promise<string | null> {
    // Prevent multiple simultaneous registration attempts
    if (this.isRegistering) {
      this.logger.warn("Registration already in progress");
      return this.serviceId;
    }

    this.isRegistering = true;
    this.appName = name;
    
    this.registryConfig = {
      url: config.SERVICE_REGISTRY?.url as string || 'http://localhost:3011',
      heartbeatInterval: config.SERVICE_REGISTRY?.heartbeatInterval || 30000,
      retryDelay: config.SERVICE_REGISTRY?.retryDelay || 10000,
      maxRetries: config.SERVICE_REGISTRY?.maxRetries || 5
    };

    try {
      this.logger.info(`Registering ${name} with service registry at ${this.registryConfig.url}`);
      
      const response = await axios.post(`${this.registryConfig.url}/register`, {
        name,
        host,
        port,
        healthEndpoint,
        version,
        description
      });

      const { serviceId } = response.data;
      this.serviceId = serviceId;
      this.retryCount = 0; // Reset retry count on successful registration
      this.isRegistering = false;

      this.logger.info(`Registered ${name} with service registry, ID: ${serviceId}`);
      
      // Set up process termination handlers for clean deregistration
      this.setupTerminationHandlers();
      
      // Start periodic heartbeats
      this.startHeartbeat();

      return serviceId;
    } catch (error) {
      this.isRegistering = false;
      return this.handleRegistrationError(error);
    }
  }

  /**
   * Set up handlers for process termination to ensure clean deregistration
   */
  private static setupTerminationHandlers(): void {
    // Only set up once
    if (!process.listenerCount('SIGINT')) {
      process.on('SIGINT', async () => {
        await this.deregister();
        process.exit(0);
      });
    }
    
    if (!process.listenerCount('SIGTERM')) {
      process.on('SIGTERM', async () => {
        await this.deregister();
        process.exit(0);
      });
    }
  }

  /**
   * Start sending periodic heartbeats to the service registry
   */
  private static startHeartbeat(): void {
    // Clear any existing heartbeat interval
    this.stopHeartbeat();

    if (!this.serviceId) {
      this.logger.warn("Cannot start heartbeat: No service ID");
      return;
    }

    this.logger.info(`Starting heartbeat for service ${this.appName} (ID: ${this.serviceId})`);
    
    // Send an initial heartbeat immediately
    this.sendHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.registryConfig.heartbeatInterval);
  }

  /**
   * Send a single heartbeat to the service registry
   */
  private static async sendHeartbeat(): Promise<void> {

    if (!this.serviceId) return;

    try {
      const response = await axios.put(
        `${this.registryConfig.url}/heartbeat/${this.serviceId}`, 
        { status: 'UP' }
      );
      
      if (response.status === 200) {
        this.logger.info(`Heartbeat sent successfully for ${this.appName}`);
      } else {
        this.logger.warn(`Unexpected heartbeat response: ${response.status}`);
      }
    } catch (error) {
      this.logger.error('Failed to send heartbeat:', this.getErrorMessage(error));
      
      // If we're getting 404s, the service might need to be re-registered
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        this.logger.warn('Service not found in registry, attempting to re-register');
        this.serviceId = null;
        this.stopHeartbeat();
        this.register({
          port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
          name: this.appName
        });
      }
    }
  }

  /**
   * Handle registration errors with retry mechanism
   * @param error Registration error
   * @returns null to indicate registration failure
   */
  private static handleRegistrationError(error: unknown): null {
    this.logger.error(
      `Failed to register ${this.appName} service with registry:`, 
      this.getErrorMessage(error)
    );

    // Implement exponential backoff for retries
    if (this.retryCount < (this.registryConfig.maxRetries || 5)) {
      const delay = this.registryConfig.retryDelay! * Math.pow(2, this.retryCount);
      this.retryCount++;
      
      this.logger.info(
        `Retrying registration in ${delay}ms (attempt ${this.retryCount}/${this.registryConfig.maxRetries})`
      );
      
      setTimeout(() => {
        this.register({
          port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
          name: this.appName
        });
      }, delay);
    } else {
      this.logger.error(`Max retries (${this.registryConfig.maxRetries}) reached. Giving up on service registration.`);
    }
    
    return null;
  }

  /**
   * Safely extract error message
   * @param error Error object
   * @returns Error message string
   */
  private static getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      return `${error.message} - ${JSON.stringify(error.response?.data || {})}`;
    }
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Clean up method to stop heartbeats
   */
  static stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      this.logger.debug(`Heartbeat stopped for service ${this.appName}`);
    }
  }

  /**
   * Deregister the service from the registry
   * @returns Promise resolving to true if successful, false otherwise
   */
  static async deregister(): Promise<boolean> {
    if (!this.serviceId) {
      this.logger.warn("Cannot deregister: No service ID");
      return false;
    }

    try {
      this.stopHeartbeat();
      
      this.logger.info(`Deregistering service ${this.appName} (ID: ${this.serviceId})`);
      
      const response = await axios.delete(
        `${this.registryConfig.url}/services/${this.serviceId}`
      );
      
      if (response.status === 200) {
        this.logger.info(`Service ${this.appName} deregistered successfully`);
        this.serviceId = null;
        return true;
      } else {
        this.logger.warn(`Unexpected deregistration response: ${response.status}`);
        return false;
      }
    } catch (error) {
      this.logger.error('Failed to deregister service:', this.getErrorMessage(error));
      return false;
    }
  }

  /**
   * Discover services by name
   * @param serviceName Optional name of service to discover
   * @returns Promise resolving to array of service information
   */
  static async discoverServices(serviceName?: string): Promise<any[]> {
    try {
      const url = serviceName
        ? `${this.registryConfig.url}/services?name=${serviceName}`
        : `${this.registryConfig.url}/services`;
        
      const response = await axios.get(url);
      
      if (response.status === 200) {
        return response.data;
      } else {
        this.logger.warn(`Unexpected discovery response: ${response.status}`);
        return [];
      }
    } catch (error) {
      this.logger.error('Failed to discover services:', this.getErrorMessage(error));
      return [];
    }
  }

  /**
   * Get the current service ID
   */
  static getServiceId(): string | null {
    return this.serviceId;
  }

  /**
   * Call a service with load balancing
   * @param serviceName Name of the service to call
   * @param endpoint Endpoint to call on the service
   * @param data Optional data to send with the request
   * @returns Promise resolving to the response from the service
   */
  static async callWithLB(serviceName: string, endpoint: string, data?: any) {
    let requestCounter = 0;
    const services = await this.discoverServices(serviceName);
    
    if (services.length === 0) {
      throw new Error(`${serviceName} service not available`);
    }
    
    // Round-robin selection
    const serviceIndex = requestCounter % services.length;
    requestCounter++;
    
    const service = services[serviceIndex];
    const url = `http://${service.host}:${service.port}/${endpoint}`;
    
    if (data) {
      return axios.post(url, data);
    }
    return axios.get(url);
  }
}