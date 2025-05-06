import nodemailer, { Transporter } from 'nodemailer';
import ejs from 'ejs';
import Mail from 'nodemailer/lib/mailer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import type User from '@apps/auth/src/models/user.model';
import type { Profile } from '@apps/auth/src/models/profile.model';
import { appConfig } from '@shared/config/environment';

dotenv.config();

interface EmailOptions {
  url?: string | object;
  passcode?: string;
  otpPurpose?: string;
}

class EmailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailConfigError';
  }
}

class EmailSendError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'EmailSendError';
  }
}

export default class Email {
  private to: string;
  private firstName: string;
  private url?: string | object;
  private passcode?: string;
  private otpPurpose?: string;
  private from: string;
  private transporter: Transporter;
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(
    user: Partial<Profile> & { email: Required<User['email']> },
    options: EmailOptions = {}
  ) {
    // Validate user and email
    if (!user || !user.email) {
      throw new EmailConfigError('User and email are required');
    }
    
    if (!Email.EMAIL_REGEX.test(user.email)) {
      throw new EmailConfigError(`Invalid email format: ${user.email}`);
    }

    this.to = user.email;
    this.firstName = user?.first_name || 'Buddy';
    this.url = options.url;
    this.passcode = options.passcode;
    this.otpPurpose = options.otpPurpose;
    
    // Validate email configuration
    this.validateEmailConfig();
    
    this.from = `${appConfig.EMAIL.FROM_NAME} <${appConfig.EMAIL.FROM}>`;
    this.transporter = this.createTransport();
  }

  private validateEmailConfig(): void {
    if (!appConfig.EMAIL.FROM_NAME || !appConfig.EMAIL.FROM) {
      throw new EmailConfigError('Missing FROM_NAME or FROM email configuration');
    }
    
    if (!appConfig.EMAIL.SMTP_HOST || !appConfig.EMAIL.SMTP_PORT) {
      throw new EmailConfigError('Missing SMTP_HOST or SMTP_PORT configuration');
    }
    
    if (!appConfig.EMAIL.USERNAME || !appConfig.EMAIL.PASSWORD) {
      throw new EmailConfigError('Missing EMAIL USERNAME or PASSWORD configuration');
    }
  }

  // Create different transports for different environments
  private createTransport(): Transporter {
    try {
      return nodemailer.createTransport({
        host: String(appConfig.EMAIL.SMTP_HOST).trim(),
        port: Number(appConfig.EMAIL.SMTP_PORT),
        auth: {
          user: String(appConfig.EMAIL.USERNAME).trim(),
          pass: String(appConfig.EMAIL.PASSWORD).trim(),
        },
        tls: {
          rejectUnauthorized: false, // Allow self-signed certificates
        },
        debug: process.env.EMAIL_DEBUG === 'true',
      });
    } catch (error) {
      throw new EmailConfigError(`Failed to create email transport: ${(error as Error).message}`);
    }
  }

  /**
   * Verify connection to the email server
   * @returns Promise that resolves if connection is successful
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      throw new EmailConfigError(`Email server connection failed: ${(error as Error).message}`);
    }
  }

  // Send the actual email
  async send(template: string, subject: string): Promise<void> {
    try {
      // Validate template exists
      const templatePath = path.resolve(process.cwd(), '../../shared/views',`${template}.ejs`);
      if (!fs.existsSync(templatePath)) {
        throw new EmailConfigError(`Email template not found: ${template}.ejs, ${templatePath}`,);
      }

      // 1) Render HTML based on the EJS template
      const html = await ejs.renderFile(templatePath, {
        firstName: this.firstName,
        url: this.url,
        passcode: this.passcode,
        otpPurpose: this.otpPurpose,
        subject,
        // Add date for better email context
        date: new Date().toLocaleDateString(),
      });

      // 2) Define email options
      const mailOptions: Mail.Options = {
        from: this.from,
        to: this.to,
        subject,
        html,
        text: this.htmlToPlainText(html),
      };

      // 3) Send email and verify connection first
      await this.verifyConnection();
      const info = await this.transporter.sendMail(mailOptions);
      
      // Log message ID for tracking in non-production environments
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Email sent: ${info.messageId}`);
      }
    } catch (error) {
      throw new EmailSendError(
        `Failed to send email "${subject}" to ${this.to}: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Convert HTML to plain text for email clients that don't support HTML
   */
  private htmlToPlainText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<script[^>]*>.*?<\/script>/gs, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async sendWelcome(): Promise<void> {
    await this.send('welcome', 'Welcome to the Hunt Finance Family!');
  }

  async sendPasswordReset(): Promise<void> {
    await this.send('passwordReset', 'Your password reset token (valid for only 10 minutes)');
  }

  async sendEmailOtp(): Promise<void> {
    await this.send('loginPasscode', 'Your One Time Password');
  }

  async sendBookingSuccessful(): Promise<void> {
    await this.send('successfulBooking', 'Yay! We Booked your seat');
  }

  async sendLoginPasscode(): Promise<void> {
    await this.send('loginPasscode', 'Your login passcode (valid for only 10 minutes)');
  }
  
  /**
   * Generic method to send custom template emails
   */
  async sendCustomEmail(template: string, subject: string): Promise<void> {
    await this.send(template, subject);
  }
}