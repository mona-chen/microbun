import { HttpStatusCode } from 'axios';
import { success } from './response';
class AppError extends Error {
  statusCode: HttpStatusCode;
  status: string;
  isOperational: boolean;
  constructor(message: any, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    this.name = "AppError"
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {

 constructor(message: string){
   super(message, HttpStatusCode.BadRequest);
 }
}



export default AppError;
