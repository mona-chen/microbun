import { 
  validationResult,
  type ValidationChain,
  check,
  body,
  query,
  param,
  header,
  cookie,
  buildCheckFunction
} from 'express-validator';
import get from 'lodash.get';
import type { Request, Response, NextFunction } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';

// Extend the Request interface to include validationErrors
declare global {
  namespace Express {
    interface Request {
      validationErrors?: Record<string, string[]>;
      validationResult?: () => ValidationResult;
    }
  }
}

// Express middleware types
type RequestHandler = (
  req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>,
  res: Response,
  next: NextFunction
) => void;

// Custom ValidationResult type
interface ValidationResult {
  isEmpty: () => boolean;
  array: () => Array<{ param: string; msg: string; location: string; value?: any }>;
  mapped: () => Record<string, { msg: string; param: string; location: string; value?: any }>;
  formatWith: <T>(formatter: (error: any) => T) => {
    isEmpty: () => boolean;
    array: () => T[];
    mapped: () => Record<string, T>;
  };
  throw: () => void;
  getErrors?: () => Record<string, string[]>;
}

class Validator {
  private data: Record<string, any> = {};
  private errors: Record<string, string[]> = {}; // Errors grouped by fields
  private expressValidations: ValidationChain[] = []; // Store express-validator chains
  
  // Re-export express-validator's static methods
  static check = check;
  static body = body;
  static query = query;
  static param = param;
  static header = header;
  static cookie = cookie;
  static buildCheckFunction = buildCheckFunction;
  
  // Original custom validator functions
  validate(data: Record<string, any>): this {
    this.data = data;
    this.errors = {};
    return this;
  }

  private addError(field: string, message: string): void {
    if (!this.errors[field]) {
      this.errors[field] = [];
    }
    this.errors[field].push(message);
  }

  private resolveField(field: string): any {
    return get(this.data, field);
  }

  require(
    field: string,
    options:
      | {
          message?: string;
          type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
          minValue?: number;
          maxValue?: number;
          minLength?: number;
          maxLength?: number;
        }
      | string
      | null = null,
  ): this {
    let {
      message = undefined,
      type = undefined,
      minValue = undefined,
      maxValue = undefined,
      minLength = undefined,
      maxLength = undefined,
    } = typeof options === 'object' && options !== null ? options : {};

    if (typeof options === 'string') message = options;

    const value = this.resolveField(field);

    if (value === undefined || value === null || value === '') {
      this.addError(field, message || `${field} is required`);
    } else {
      if (type && typeof value !== type) {
        this.addError(field, message || `${field} must be a ${type}`);
      }
      if (minValue !== undefined && value < minValue) {
        this.addError(field, `${field} must be at least ${minValue}`);
      }
      if (maxValue !== undefined && value > maxValue) {
        this.addError(field, `${field} must be at most ${maxValue}`);
      }
      if (minLength !== undefined && value.length < minLength) {
        this.addError(field, `${field} must be at least ${minLength} characters long`);
      }
      if (maxLength !== undefined && value.length > maxLength) {
        this.addError(field, `${field} must not exceed ${maxLength} characters`);
      }
    }

    return this;
  }

  email(field: string, message = `${field} is not a valid email`): this {
    const value = this.resolveField(field);
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      this.addError(field, message);
    }
    return this;
  }

  phone(field: string, message = `${field} is not a valid phone number`): this {
    const value = this.resolveField(field);
    if (value && !/^\d{10,15}$/.test(value)) {
      this.addError(field, message);
    }
    return this;
  }

  password(
    field: string,
    message = `${field} must be at least 8 characters, include uppercase, lowercase, number, and special character`,
  ): this {
    const value = this.resolveField(field);
    if (
      !value ||
      value.length < 8 ||
      !/[A-Z]/.test(value) ||
      !/[a-z]/.test(value) ||
      !/\d/.test(value) ||
      !/[!@#\$%\^&*()_+{}\[\]:;<>,.?~\\\-]/.test(value)
    ) {
      this.addError(field, message);
    }
    return this;
  }

  number(field: string, message = `${field} must be a number`): this {
    const value = this.resolveField(field);
    if (typeof value !== 'number') {
      this.addError(field, message);
    }
    return this;
  }

  integer(field: string, message = `${field} must be an integer`): this {
    const value = this.resolveField(field);
    if (!Number.isInteger(value)) {
      this.addError(field, message);
    }
    return this;
  }

  array(field: string, message = `${field} must be an array`): this {
    const value = this.resolveField(field);
    if (!Array.isArray(value)) {
      this.addError(field, message);
    }
    return this;
  }

  enum(field: string, allowedValues: any[], message?: string): this {
    const value = this.resolveField(field);
    if (!allowedValues.includes(value)) {
      this.addError(field, message || `${field} must be one of ${allowedValues.join(', ')}`);
    }
    return this;
  }

  url(field: string, message = `${field} is not a valid URL`): this {
    const value = this.resolveField(field);
    const urlRegex =
      /^(https?:\/\/)?([\w\-]+(\.[\w\-]+)+)(:\d+)?(\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/;
    if (value && !urlRegex.test(value)) {
      this.addError(field, message);
    }
    return this;
  }

  custom(field: string, func: (value: any) => boolean, message = `Validation failed`): this {
    const value = this.resolveField(field);
    if (!func(value)) {
      this.addError(field, message);
    }
    return this;
  }

  isValid(): boolean {
    return Object.keys(this.errors).length === 0;
  }

  getErrors(): Record<string, string[]> {
    return this.errors;
  }

  validateAll(rules: { [key: string]: (v: Validator) => void }): this {
    for (const field in rules) {
      rules[field](this);
    }
    return this;
  }

  extractMessages(errors: any) {
    const messages: any = [];

    for (const key in errors) {
      if (errors.hasOwnProperty(key)) {
        errors[key].forEach((message: any) => {
          messages.push(message);
        });
      }
    }

    return messages;
  }

  end(): void {
    if (!this.isValid()) {
      const errorStack = JSON.stringify(this.errors, null, 2);
      const errorMessage = this.extractMessages(this.errors).join(', ') ?? '';
      const validationError = new Error(errorMessage);
      (validationError as any).isValidationError = true;
      (validationError as any).stack = errorStack;
      throw validationError;
    }
  }

  // Express-validator integration
  // This function transforms express-validator results to our format
  static validationResult(req: Request): ValidationResult {
    const expressResult = validationResult(req);
    
    // Format errors to match our structure
    const errors: Record<string, string[]> = {};
    if (!expressResult.isEmpty()) {
      expressResult.array().forEach((error:any) => {
        if (!errors[error.param]) {
          errors[error.param] = [];
        }
        errors[error.param].push(error.msg);
      });
    }
    
    return {
      ...expressResult,
      isEmpty: expressResult.isEmpty.bind(expressResult),
      array: expressResult.array.bind(expressResult),
      mapped: expressResult.mapped.bind(expressResult),
      formatWith: expressResult.formatWith.bind(expressResult),
      getErrors: () => errors,
      throw: () => {
        if (!expressResult.isEmpty()) {
          const errorMessage = Object.values(errors).flat().join(', ');
          const validationError = new Error(errorMessage);
          (validationError as any).isValidationError = true;
          (validationError as any).stack = JSON.stringify(errors, null, 2);
          throw validationError;
        }
      }
    };
  }

  // Create a middleware that runs validations and formats errors
  static createValidationMiddleware(validations: ValidationChain[]): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Run all the validations
      await Promise.all(validations.map(validation => validation.run(req)));
      
      // Format the results and attach to request
      const result = Validator.validationResult(req);
      req.validationErrors = result.getErrors!();
      req.validationResult = () => result;
      
      try {
        // Throw if there are validation errors
        result.throw();
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  // Legacy middleware compatibility
  middleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      this.validate(req.body);
      
      req.validationErrors = this.getErrors();
      req.validationResult = () => {
        const errors = this.getErrors();
        const isEmpty = Object.keys(errors).length === 0;
        
        return {
          isEmpty: () => isEmpty,
          array: () => {
            const result:any = [];
            for (const field in errors) {
              for (const message of errors[field]) {
                result.push({ param: field, msg: message, location: 'body', value: get(req.body, field) });
              }
            }
            return result;
          },
          mapped: () => {
            const mapped: Record<string, any> = {};
            for (const field in errors) {
              if (errors[field].length > 0) {
                mapped[field] = {
                  msg: errors[field][0],
                  param: field,
                  location: 'body',
                  value: get(req.body, field)
                };
              }
            }
            return mapped;
          },
          formatWith: <T>(formatter: (error: any) => T) => {
            const formatted = this.getErrors();
            return {
              isEmpty: () => Object.keys(formatted).length === 0,
              array: () => Object.entries(formatted).flatMap(([field, messages]) => 
                messages.map(msg => formatter({ param: field, msg, location: 'body', value: get(req.body, field) }))
              ),
              mapped: () => {
                const mappedFormatted: Record<string, T> = {};
                Object.entries(formatted).forEach(([field, messages]) => {
                  if (messages.length > 0) {
                    mappedFormatted[field] = formatter({ 
                      param: field, 
                      msg: messages[0], 
                      location: 'body', 
                      value: get(req.body, field) 
                    });
                  }
                });
                return mappedFormatted;
              }
            };
          },
          throw: () => this.end(),
          getErrors: () => errors
        };
      };
      
      next();
    };
  }
}

export default Validator;