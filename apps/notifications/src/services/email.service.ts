import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import * as fs from 'fs';
import * as path from 'path';
import * as ejs from 'ejs';
import { logger } from '@shared/utils/logger';
import { CircuitBreakerManager } from '@shared/utils/circuit-breaker';

// Define SendGrid types to avoid dependency
interface SendGridMessage {
  to: string | string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    content: string;
    filename: string;
    type?: string;
    disposition?: string;
  }>;
}

// Mock SendGrid module
const SendGrid = {
  setApiKey: (apiKey: string) => {
    logger.info('SendGrid API key set');
  },
  send: async (msg: SendGridMessage) => {
    logger.info(`[MOCK] SendGrid email sent to ${Array.isArray(msg.to) ? msg.to.join(', ') : msg.to}`);
    return true;
  }
};

/**
 * Email provider types
 */
export enum EmailProviderType {
  SMTP = 'smtp',
  SENDGRID = 'sendgrid'
}

/**
 * Email configuration interface
 */
export interface EmailConfig {
  provider: EmailProviderType;
  from: string;
  replyTo?: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    }
  };
  sendgrid?: {
    apiKey: string;
  };
  templateDir?: string;
}

/**
 * Email data interface
 */
export interface EmailData {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  templateName?: string;
  templateData?: Record<string, any>;
  attachments?: Mail.Attachment[];
  cc?: string | string[];
  bcc?: string | string[];
}

/**
 * Email provider interface
 */
interface EmailProvider {
  sendEmail(data: EmailData): Promise<boolean>;
}

/**
 * SMTP email provider implementation
 */
class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.smtp?.host,
      port: config.smtp?.port,
      secure: config.smtp?.secure,
      auth: {
        user: config.smtp?.auth.user,
        pass: config.smtp?.auth.pass
      }
    });
  }

  async sendEmail(data: EmailData): Promise<boolean> {
    try {
      // Prepare email content
      let html = data.html;
      let text = data.text;

      // If template is specified, render it
      if (data.templateName && this.config.templateDir) {
        const templatePath = path.join(this.config.templateDir, `${data.templateName}.ejs`);
        if (fs.existsSync(templatePath)) {
          html = await ejs.renderFile(templatePath, data.templateData || {});
        } else {
          logger.error(`Template not found: ${templatePath}`);
          return false;
        }
      }

      // Send email
      const result = await this.transporter.sendMail({
        from: this.config.from,
        to: data.to,
        cc: data.cc,
        bcc: data.bcc,
        subject: data.subject,
        text: text,
        html: html,
        attachments: data.attachments,
        replyTo: this.config.replyTo
      });

      logger.info(`Email sent: ${result.messageId}`);
      return true;
    } catch (error) {
      logger.error('Error sending email via SMTP', error);
      return false;
    }
  }
}

/**
 * SendGrid email provider implementation
 */
class SendGridEmailProvider implements EmailProvider {
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    if (config.sendgrid?.apiKey) {
      SendGrid.setApiKey(config.sendgrid.apiKey);
    } else {
      throw new Error('SendGrid API key is required');
    }
  }

  async sendEmail(data: EmailData): Promise<boolean> {
    try {
      // Prepare email content
      let html = data.html;
      let text = data.text;

      // If template is specified, render it
      if (data.templateName && this.config.templateDir) {
        const templatePath = path.join(this.config.templateDir, `${data.templateName}.ejs`);
        if (fs.existsSync(templatePath)) {
          html = await ejs.renderFile(templatePath, data.templateData || {});
        } else {
          logger.error(`Template not found: ${templatePath}`);
          return false;
        }
      }

      // Prepare email message
      const msg = {
        to: data.to,
        from: this.config.from,
        subject: data.subject,
        text: text,
        html: html,
        cc: data.cc,
        bcc: data.bcc,
        attachments: data.attachments?.map(attachment => ({
          content: attachment.content?.toString('base64'),
          filename: attachment.filename,
          type: attachment.contentType,
          disposition: 'attachment'
        }))
      };

      // Send email
      await SendGrid.send(msg);
      logger.info(`Email sent via SendGrid to ${Array.isArray(data.to) ? data.to.join(', ') : data.to}`);
      return true;
    } catch (error) {
      logger.error('Error sending email via SendGrid', error);
      return false;
    }
  }
}

/**
 * Email service for sending emails using different providers
 */
export class EmailService {
  private static instance: EmailService;
  private provider: EmailProvider;
  private config: EmailConfig;

  private constructor(config: EmailConfig) {
    this.config = config;
    
    // Create provider based on configuration
    switch (config.provider) {
      case EmailProviderType.SMTP:
        this.provider = new SmtpEmailProvider(config);
        break;
      case EmailProviderType.SENDGRID:
        this.provider = new SendGridEmailProvider(config);
        break;
      default:
        throw new Error(`Unsupported email provider: ${config.provider}`);
    }

    // Register circuit breaker for email operations
    CircuitBreakerManager.register('email-send', 
      (data: EmailData) => this.sendEmail(data),
      {
        failureThreshold: 3,
        retryBackoff: 'exponential',
        distributedTracking: true
      }
    );
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: EmailConfig): EmailService {
    if (!EmailService.instance) {
      if (!config) {
        // Default configuration from environment variables
        const provider = (process.env.EMAIL_PROVIDER as EmailProviderType) || EmailProviderType.SMTP;
        const config: EmailConfig = {
          provider,
          from: process.env.EMAIL_FROM as string || 'noreply@example.com',
          replyTo: process.env.EMAIL_REPLY_TO as string | undefined,
          templateDir: process.env.EMAIL_TEMPLATE_DIR as string || path.join(process.cwd(), 'shared/views')
        };

        if (provider === EmailProviderType.SMTP) {
          config.smtp = {
            host: process.env.SMTP_HOST as string || 'localhost',
            port: parseInt(process.env.SMTP_PORT as string || '587', 10),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER as string || '',
              pass: process.env.SMTP_PASS as string || ''
            }
          };
        } else if (provider === EmailProviderType.SENDGRID) {
          config.sendgrid = {
            apiKey: process.env.SENDGRID_API_KEY as string || ''
          };
        }

        EmailService.instance = new EmailService(config);
      } else {
        EmailService.instance = new EmailService(config);
      }
    }
    return EmailService.instance;
  }

  /**
   * Reconfigure the email service with new settings
   */
  public static reconfigure(config: EmailConfig): EmailService {
    EmailService.instance = new EmailService(config);
    return EmailService.instance;
  }

  /**
   * Send an email
   */
  async sendEmail(data: EmailData): Promise<boolean> {
    try {
      return await this.provider.sendEmail(data);
    } catch (error) {
      logger.error('Error sending email', error);
      return false;
    }
  }

  /**
   * Send an email using a template
   */
  async sendTemplateEmail(
    to: string | string[],
    subject: string,
    templateName: string,
    templateData: Record<string, any>,
    options: {
      cc?: string | string[];
      bcc?: string | string[];
      attachments?: Mail.Attachment[];
    } = {}
  ): Promise<boolean> {
    return this.sendEmail({
      to,
      subject,
      templateName,
      templateData,
      ...options
    });
  }
}