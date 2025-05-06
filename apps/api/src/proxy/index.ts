import type { IReq, IRes } from '@shared/types/config';
import type { Application } from 'express';
import { createProxyMiddleware, fixRequestBody, type Options } from 'http-proxy-middleware';
import serviceRoutes from '../routes';
import { authMiddleware } from '../middleware/auth.middleware';
import Logger from '@shared/utils/logger';
import { appConfig } from '@shared/config/environment';
import { rateLimitMiddleware } from '../middleware/rate-limit.middleware';


/**
 * Sets up proxy routes for the application
 * 
 * @param app Express application
 */
function setupProxy(app: Application) {
  const logger = Logger.getLogger('ProxyService');
  
  
  // Setup proxy routes - order matters (most specific first)
  Object.entries(serviceRoutes).forEach(([path, config]) => {
    logger.info(`Setting up proxy route: ${path} -> ${config.target}`);
    

    // Configure middleware stack
    const middlewares: any[] = [];
    

    // 1. Apply authentication middleware if required
    if (config.auth) {
      logger.debug(`Adding auth middleware for ${path}`);
      middlewares.push(authMiddleware);
    }
    
    // 2. Apply rate limiting if configured
    if (config.rateLimit && config.rateLimit > 0) {
      logger.debug(`Adding rate limit (${config.rateLimit}/min) for ${path}`);
      middlewares.push(rateLimitMiddleware(path, config.rateLimit));
    }
    
    // 3. Create and configure the proxy middleware
    const proxyOptions = {
      target: config.target,
      changeOrigin: true,
      pathRewrite: config.pathRewrite,
      timeout: config.timeout || 30000, // Default 30s timeout
      
      // Event handlers
      on: {
        proxyReq: (proxyReq: any, req: IReq, _res: IRes) => {
          fixRequestBody(proxyReq, req);
          
          logger.debug(`Proxying ${req.method} request to ${config.target}${req.path}`);
          
          // Add standard headers
          proxyReq.setHeader('X-Request-ID', req.id as string);
          proxyReq.setHeader('X-Internal-Token', appConfig.INTERNAL_SERVICE_SECRET as string);
          proxyReq.setHeader('X-Forwarded-For', req.ip);
          proxyReq.setHeader('Host', new URL(config.target).hostname);
          // Add custom headers if configured
          if (config.headers) {
            Object.entries(config.headers).forEach(([key, value]) => {
              proxyReq.setHeader(key, value);
            });
          }
          
          // Forward user context if available
          if (req.user) {
            proxyReq.setHeader('X-User-Id', req.user.id);
            proxyReq.setHeader('X-User-Email', req.user.email);
            proxyReq.setHeader('X-User-Roles', req.user.roles?.join(',') || '');
            proxyReq.setHeader('X-User-Permissions', req.user.permissions?.join(',') || '');
          }
          
          // Handle request body for modifying methods
          if (
            req.body &&
            Object.keys(req.body).length > 0 &&
            ['POST', 'PUT', 'PATCH'].includes(req.method)
          ) {
            const bodyData = JSON.stringify(req.body);
            
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
            proxyReq.end(); // Important to end the request
          }
        },
        
        proxyRes: (proxyRes: any, req: IReq, _res: IRes) => {
          const service = path.split('/')[2]; // Extract service name from path
          const status = proxyRes.statusCode;
          
          // Log at appropriate level based on status code
          if (status >= 400) {
            logger.warn({
              id: req.id,
              service,
              method: req.method,
              path: req.originalUrl,
              status,
              message: `Error response from ${service} service`
            });
          } else {
            logger.debug({
              id: req.id,
              service,
              method: req.method,
              path: req.originalUrl,
              status,
              message: `Successful response from ${service} service`
            });
          }
        },
        
        error: (err: any, req: IReq, res: IRes) => {
          logger.error({
            id: req.id,
            error: err.message,
            code: err.code,
            path: req.path,
            stack: err.stack,
          });
          
          // Handle common error scenarios
          switch (err.code) {
            case 'ECONNREFUSED':
              res.status(502).json({
                error: 'Bad Gateway',
                message: 'The target service is unavailable',
                requestId: req.id
              });
              break;
              
            case 'ETIMEDOUT':
              res.status(504).json({
                error: 'Gateway Timeout',
                message: 'The target service took too long to respond',
                requestId: req.id
              });
              break;
              
            case 'ECONNRESET':
              res.status(502).json({
                error: 'Connection Reset',
                message: 'The connection was reset while processing your request',
                requestId: req.id
              });
              break;
              
            default:
              res.status(500).json({
                error: 'Proxy Error',
                message: 'An unexpected error occurred while processing your request',
                requestId: req.id
              });
          }
        }
      },
    };
    
    // Add proxy middleware to the stack
    middlewares.push(createProxyMiddleware(proxyOptions as any));
    
    // Apply all middlewares to the route
    app.use(path, ...middlewares);
  });
  
  logger.info(`Proxy setup complete with ${Object.keys(serviceRoutes).length} routes`);
}


export default setupProxy;
