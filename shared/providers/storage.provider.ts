import { BaseController } from '@shared/base/base.controller';
import express from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import { S3StorageProvider } from './s3.provider';
import type { IReq, IRes } from '@shared/types/config';

type S3RouterConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  region?: string;
  acl?: "private" | "public-read" | "public-read-write" | "authenticated-read";
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export class StorageRouter extends BaseController {
  private config: Required<S3RouterConfig>;
  private storageProvider: S3StorageProvider;


  constructor(config: S3RouterConfig) {

    super(
      {

        basePath: '/api',
      }
    );
    this.config = {
      ...config,
      region: config.region || 'us-east-1',
      acl: config.acl || 'private'
    };

    this.storageProvider = new S3StorageProvider(this.config);
  
  }

   initializeRoutes() {
    this.router.post('/upload', upload.single('file'), this.uploadHandler.bind(this));
    this.router.get('/files/:key(*)', this.downloadHandler.bind(this));
    this.router.get('/presigned/:key(*)', this.presignedDownloadHandler.bind(this));
    this.router.post('/presigned-upload', express.json(), this.presignedUploadHandler.bind(this));
    this.router.get('/list', this.listHandler.bind(this));
    this.router.delete('/files/:key(*)', this.deleteHandler.bind(this));
  }

  private async uploadHandler(req: any, res: IRes) {
    try {
      if (!req.file) return this.badRequest(res, 'No file uploaded');

      const key = req.body.key || `uploads/${Date.now()}-${req.file.originalname}`;
      const file = await this.storageProvider.uploadFile(key, req.file.buffer, {
        contentType: req.file.mimetype,
        metadata: { originalName: req.file.originalname }
      });

      this.ok(res,  file, 'File uploaded successfully', );
    } catch (error) {
      this.badRequest(res, 'Failed to upload file', error);
    }
  }

  private async downloadHandler(req: IReq, res: IRes) {
    try {
      const key = req.params.key;
      const exists = await this.storageProvider.fileExists(key);
      if (!exists) return this.notFound(res, 'File not found');

      const fileStream = await this.storageProvider.getFileStream(key);

      if (fileStream instanceof Readable) {
        const { HeadObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
        const client = new S3Client({
          credentials: {
            accessKeyId: this.config.accessKeyId,
            secretAccessKey: this.config.secretAccessKey,
          },
          endpoint: this.config.endpoint,
          region: this.config.region,
        });

        const head = await client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
        const filename = key.split('/').pop();

        res.setHeader('Content-Type', head.ContentType || 'application/octet-stream');
        res.setHeader('Content-Length', head.ContentLength || 0);
        res.setHeader('Content-Disposition', head.ContentDisposition || `attachment; filename="${filename}"`);

        fileStream.pipe(res);
      } else {
        const buffer = await this.streamToBuffer(fileStream);
        const filename = key.split('/').pop() || 'file';
        const contentType = this.getContentTypeFromFilename(filename) || 'application/octet-stream';

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Content-Type', contentType);

        res.send(buffer);
      }
    } catch (error) {
        this.badRequest(res, 'Failed to download file', error);
    }
  }

  private async presignedDownloadHandler(req: IReq, res: IRes) {
    try {
      const key = req.params.key;
      const expiresIn = parseInt((req.query.expiresIn as string) || '3600', 10);
      const exists = await this.storageProvider.fileExists(key);

      if (!exists) return res.status(404).json({ error: 'File not found' });

      const url = await this.storageProvider.getPresignedUrl(key, { expiresIn });
      res.json({ url, expiresIn });
    } catch (error) {
        this.badRequest(res, 'Failed to generate presigned URL', error);
    }
  }

  private async presignedUploadHandler(req: IReq, res: IRes) {
    try {
      const { key, contentType, expiresIn = 3600 } = req.body;
      if (!key) return res.status(400).json({ error: 'Key is required' });

      const url = await this.storageProvider.getPresignedUploadUrl(key, { contentType, expiresIn });
      res.json({ url, key, expiresIn });
    } catch (error) {
        this.badRequest(res, 'Failed to generate presigned upload URL', error);
    }
  }

  private async listHandler(req: IReq, res: IRes) {
    try {
      const prefix = req.query.prefix as string | undefined;
      const maxKeys = req.query.maxKeys ? parseInt(req.query.maxKeys as string) : undefined;
      const continuationToken = req.query.continuationToken as string | undefined;

      const result = await this.storageProvider.listFiles({ prefix, maxKeys, continuationToken });
      res.json(result);
    } catch (error) {
      this.errorHandler(res, 'Failed to list files', error);
    }
  }

  private async deleteHandler(req: IReq, res: IRes) {
    try {
      const key = req.params.key;
      const exists = await this.storageProvider.fileExists(key);
      if (!exists) return res.status(404).json({ error: 'File not found' });

      await this.storageProvider.deleteFile(key);
      res.json({ message: 'File deleted successfully', key });
    } catch (error) {
      this.errorHandler(res, 'Failed to delete file', error);
    }
  }

  private errorHandler(res: IRes, message: string, error: unknown) {
    console.error(message, error);
    res.status(500).json({
      error: message,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  private async streamToBuffer(stream: ReadableStream): Promise<Buffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    return Buffer.concat((chunks as any).map(chunk => Buffer.from(chunk)));
  }

  private getContentTypeFromFilename(filename: string): string | null {
    const extension = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      txt: 'text/plain',
      csv: 'text/csv',
      html: 'text/html',
      json: 'application/json',
      xml: 'application/xml',
      zip: 'application/zip',
      mp3: 'audio/mpeg',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      svg: 'image/svg+xml',
    };
    return extension ? mimeTypes[extension] || null : null;
  }
}
