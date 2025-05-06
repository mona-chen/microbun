// apps/compliance/src/controllers/kyc.controller.ts
import { body, param, validationResult } from 'express-validator';
import { BaseController } from '@shared/base/base.controller';
import type { IReq, IRes } from '@shared/types/config';
import { validateRequest } from '@shared/utils/validate-request';
import type { NextFunction } from 'express';
import type { NotificationService } from '../services/notification.service';
import type { NotificationRecord } from '../interfaces/notification.interface';

export class NotificationController extends BaseController {
  private notificationService: NotificationService;


  constructor(
    notificationService: NotificationService,
    messagingClient: any

  ) {
    super({ messagingClient, basePath: '/notification' });
    this.notificationService = notificationService;
  }

  protected initializeRoutes(): void {
    // Validation middleware
    const validateCreateNotification = [
      body('recipient').isMongoId().notEmpty(),
      body('title').isString().notEmpty(),
      body('body').isString().notEmpty(),
      body('type').isString().notEmpty(),
    body('data').optional().isObject(),
    ];

  
    // Define routes
    this.router.post('/',
        validateCreateNotification,
      validateRequest,
      this.asyncHandler(this.createNotification.bind(this))
    );


    this.router.get('/:userId/',
      param('userId').isMongoId().notEmpty(),
      validateRequest,
      this.asyncHandler(this.getUserNotifications.bind(this))
    );

    this.router.get('/:userId/read',
        param('userId').isMongoId().notEmpty(),
        validateRequest,
        this.asyncHandler(this.getUserNotifications.bind(this))
      );


    this.router.get('/health', this.healthCheck.bind(this));
  }

         /*======== Route handlers  =========*/

      // API endpoints for notifications
      async createNotification (req: IReq, res: IRes, next: NextFunction) : Promise<IRes>  {
        try {
          const { recipient, title, body, type, data } = req.body;
          
          
          // Create notification record
          const result = await this.notificationService.createNotification({
            notificationOwner: recipient,
            title,
            body,
            status: 'PENDING',
            type,
            otherData: data
          } as NotificationRecord);
          
       
          return this.created(res, result, "Notification created successfully");
        } catch (error:any) {
            return this.badRequest(res, error.message, {});
        }
      };
   
      // Get user notifications endpoint
         async getUserNotifications  (req: IReq, res: IRes, next: NextFunction): Promise<IRes>  {
        try {
          const { userId } = req.params;
          const { page, perPage } = req.query;
          
          const notifications = await this.notificationService.getUserNotifications(
            userId, 
            { 
              page: page ? Number(page) : 1, 
              perPage: perPage ? Number(perPage) : 10 
            }
          );
          
     
          return this.ok(res, notifications, "Notifications fetched successfully");
        } catch (error:any) {
            return this.badRequest(res, error.message, {});
        }
      };
  
      // Mark notifications as read endpoint
      async markNotificationAsRead(req: IReq, res: IRes, next: NextFunction) : Promise<IRes>  {
        try {
          const { userId } = req.params;
          
        const notification =  await this.notificationService.updateNotificationStatus(userId, 'READ');
          
          return this.ok(res, notification, "Notifications marked as read");
     
        } catch (error:any) {
         
          return  this.badRequest(res, error.message, {});
          
        }
      };
  

  healthCheck(req: IReq, res: IRes): IRes {
    return this.ok(res, { status: 'ok' }, 'Compliance service is healthy');
  }
}