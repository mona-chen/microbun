// BaseController.ts
import type { RabbitMQService } from '@shared/events';
import type { IReq, IRes } from '@shared/types/config';
import Logger from '@shared/utils/logger';
import type { HttpStatusCode } from 'axios';
import { Router, type NextFunction } from 'express';
import { Model, type ModelClass } from 'objection';

export interface ControllerOptions {
  basePath?: string;
  messagingClient?: RabbitMQService; // This would be your messaging client interface
}

export abstract class BaseController {
  public router: Router;
  public basePath: string;
  protected messagingClient: RabbitMQService;
  private loggerName?: string;
  public logger: Logger;

  constructor(options: ControllerOptions = {}) {
    this.router = Router();
    this.basePath = options.basePath || '';
    this.messagingClient = options.messagingClient as RabbitMQService;
    this.loggerName = this.constructor.name
    this.initializeRoutes();
    this.logRoutes();
    this.logger =  Logger.getLogger(this.loggerName ?? "")
  }

  // Abstract method that must be implemented by subclasses
  protected abstract initializeRoutes(): void;

  // Utility method to handle async route handlers
  protected asyncHandler(fn: (req: IReq, res: IRes, next: NextFunction) => Promise<any>) {
    return (req: IReq, res: IRes, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Publish event to messaging system
  protected async publishEvent(exchange: string, routingKey: string, data: any): Promise<void> {
    if (!this.messagingClient) {
      console.warn('No messaging client provided, skipping event publication');
      return;
    }

    try {
       this.messagingClient.publishEvent(exchange, routingKey, data);
    } catch (error) {
      console.error('Error publishing event:', error);
      throw error;
    }
  }

  // Common CRUD operations that can be used by controllers
  protected async findById<T extends Model>(
    modelClass: ModelClass<T>,
    id: string,
    relations: string[] = []
  ): Promise<T | undefined> {
    const query = modelClass.query().findById(id);
    
    if (relations.length > 0) {
      relations.forEach(relation => {
        query.withGraphFetched(relation);
      });
    }
    
    return query as unknown as Promise<T | undefined>;
  }

  protected async create<T extends Model>(
    modelClass: ModelClass<T>,
    data: Partial<T>
  ): Promise<T> {
    return modelClass.query().insert(data) as unknown as Promise<T>;
  }

  protected async update<T extends Model>(
    modelClass: ModelClass<T>,
    id: string,
    data: Partial<T>
  ): Promise<T | undefined> {
    const updated = await modelClass.query().patchAndFetchById(id, data) as unknown as T;
    return updated;
  }

  protected async delete<T extends Model>(
    modelClass: ModelClass<T>,
    id: string
  ): Promise<number> {
    return modelClass.query().deleteById(id).execute();
  }

  // Error response helper methods
  protected badRequest(res: IRes, message = 'Bad request', errors?: any): IRes {
    return res.status(400).json({ status: "fail", message, errors });
  }

  protected unauthorized(res: IRes, message = 'Unauthorized'): IRes {
    return res.status(401).json({ status: "fail", message });
  }

  protected forbidden(res: IRes, message = 'Forbidden'): IRes {
    return res.status(403).json({ status: "fail", message });
  }

  protected notFound(res: IRes, message = 'Resource not found'): IRes {
    return res.status(404).json({ status: "fail", message });
  }

  protected conflict(res: IRes, message = 'Conflict'): IRes {
    return res.status(409).json({ status: "fail", message });
  }

  protected serverError(res: IRes, message = 'Internal server error'): IRes {
    return res.status(500).json({ status: "fail", message });
  }

  // Success response helper methods
  protected ok(res: IRes, data?: any, message = 'Success'): IRes {
    return res.status(200).json({ status: "success", message, data });
  }

  protected created(res: IRes, data?: any, message = 'Created successfully'): IRes {
    return res.status(201).json({ status: "success", message, data });
  }

  protected noContent(res: IRes): IRes {
    return res.status(204).send();
  }

  protected send(res: IRes, message, code: HttpStatusCode): IRes {
    return res.status(code).json({ status: "success", message });
  }

  // Get router to be used by the application
  public getRouter(): Router {
    return this.router;
  }

  // Log all routes
  private logRoutes() {
    const logger =  Logger.getLogger('Routes');
    const routes = this.router.stack
      .filter(layer => layer.route)
      .map(layer => {
        const route = layer.route;
        const methods = Object.keys((route as any)?.methods).join(', ').toUpperCase();
        return `${methods} ${this.basePath}${route?.path}`;
      });

    logger.log(`Routes for ${this.constructor.name} Loaded:`);
    routes.forEach(route => logger.log(route));
  }
}