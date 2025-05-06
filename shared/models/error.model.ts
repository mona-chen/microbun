// apps/api/src/models/error.model.ts
import { Model } from 'objection';
import { v4 as uuidv4 } from 'uuid';

export class ErrorStack extends Model {
  id!: number;
  uuid!: string;
  status!: string;
  statusCode!: number;
  code!: string;
  message!: string;
  stack?: string;
  metadata?: any;
  createdAt!: Date;

  static get tableName() {
    return 'error_stack';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['status', 'statusCode', 'message'],
      properties: {
        id: { type: 'integer' },
        uuid: { type: 'string', format: 'uuid' },
        status: { type: 'string' },
        statusCode: { type: 'integer' },
        code: { type: 'string' },
        message: { type: 'string' },
        stack: { type: ['string', 'null'] },
        metadata: { type: ['object', 'null'] },
        createdAt: { type: 'string', format: 'date-time' },
      },
    };
  }

  $beforeInsert() {
    this.uuid = uuidv4();
    this.createdAt = new Date();
  }
}
