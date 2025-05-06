import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
    HeadObjectCommand,
    S3ServiceException,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand
  } from "@aws-sdk/client-s3";
  import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
  import { Readable } from "stream";
  
  export interface S3ProviderConfig {
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    endpoint: string;
    region?: string;
    virtualHostedStyle?: boolean;
    forcePathStyle?: boolean;
    sessionToken?: string;
    acl?: "private" | "public-read" | "public-read-write" | "authenticated-read";
  }
  
  export interface S3File {
    key: string;
    size: number;
    lastModified: Date;
    contentType?: string;
    etag?: string;
    url: string;
  }
  
  export interface ListFilesOptions {
    prefix?: string;
    maxKeys?: number;
    continuationToken?: string;
    delimiter?: string;
  }
  
  export interface UploadOptions {
    contentType?: string;
    metadata?: Record<string, string>;
    acl?: string;
    cacheControl?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    retry?: number;
  }
  
  export interface PresignedUrlOptions {
    expiresIn?: number; // in seconds
    contentType?: string;
    contentDisposition?: string;
  }
  
  export class S3StorageProvider {
    private client: S3Client;
    private bucket: string;
    private acl?: string;
  
    constructor(private config: S3ProviderConfig) {
      if (!config.bucket) {
        throw new Error("Bucket name is required");
      }
  
      this.bucket = config.bucket;
      this.acl = config.acl;
  
      // Determine if we should use path style addressing
      const forcePathStyle = config.forcePathStyle ?? this.shouldUsePathStyle();
      
      this.client = new S3Client({
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
          sessionToken: config.sessionToken,
        },
        endpoint: config.endpoint,
        region: config.region || "us-east-1",
        forcePathStyle: forcePathStyle,
      });
    }
  
    private shouldUsePathStyle(): boolean {
      // MinIO and local development typically require path style addressing
      return this.config.endpoint?.includes('minio') ||
             this.config.endpoint?.includes('localhost') ||
             !this.config.endpoint?.includes('amazonaws.com');
    }
  
    /**
     * Upload a file to S3
     */
    async uploadFile(
      key: string,
      data: Buffer | Blob | ReadableStream | Readable | string,
      options?: UploadOptions
    ): Promise<S3File> {
      try {
        // Convert different input types to acceptable format
        let body: any;
        if (typeof data === 'string') {
          body = data;
        } else if (Buffer.isBuffer(data)) {
          body = data;
        } else if (data instanceof Blob) {
          body = await data.arrayBuffer();
        } else if (data instanceof ReadableStream || data instanceof Readable) {
          body = data;
        } else {
          throw new Error("Unsupported data type for upload");
        }
  
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: options?.contentType,
          Metadata: options?.metadata,
        //   ACL: options?.acl || this.acl,
          CacheControl: options?.cacheControl,
          
          ContentDisposition: options?.contentDisposition,
          ContentEncoding: options?.contentEncoding,
        });
  
        await this.client.send(command);
        
        // Get the file metadata
        const headCommand = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
        
        const headResponse = await this.client.send(headCommand);
        
        return {
          key,
          size: headResponse.ContentLength || 0,
          lastModified: headResponse.LastModified || new Date(),
          contentType: headResponse.ContentType,
          etag: headResponse.ETag?.replace(/"/g, ''),
          url: this.getObjectUrl(key),
        };
      } catch (error) {
        this.handleS3Error(error, `Failed to upload file ${key}`);
      }
    }
  
    /**
     * Begin a multipart upload and return the upload ID
     */
    async beginMultipartUpload(
      key: string,
      options?: UploadOptions
    ): Promise<{ uploadId: string; key: string }> {
      try {
        const command = new CreateMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: options?.contentType,
          Metadata: options?.metadata,
        //   ACL: options?.acl || this.acl,
          CacheControl: options?.cacheControl,
          ContentDisposition: options?.contentDisposition,
          ContentEncoding: options?.contentEncoding,
        });
  
        const response = await this.client.send(command);
        
        if (!response.UploadId) {
          throw new Error("Failed to initiate multipart upload - no upload ID returned");
        }
  
        return {
          uploadId: response.UploadId,
          key,
        };
      } catch (error) {
        this.handleS3Error(error, `Failed to initiate multipart upload for ${key}`);
      }
    }
  
    /**
     * Upload a part of a multipart upload
     */
    async uploadPart(
      key: string,
      uploadId: string,
      partNumber: number,
      data: Buffer | Blob | ReadableStream | Readable
    ): Promise<{ etag: string; partNumber: number }> {
      try {
        // Convert data to appropriate format
        let body: any;
        if (Buffer.isBuffer(data)) {
          body = data;
        } else if (data instanceof Blob) {
          body = await data.arrayBuffer();
        } else {
          body = data;
        }
  
        const command = new UploadPartCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: body,
        });
  
        const response = await this.client.send(command);
        
        if (!response.ETag) {
          throw new Error(`Failed to upload part ${partNumber} - no ETag returned`);
        }
  
        return {
          etag: response.ETag.replace(/"/g, ''),
          partNumber,
        };
      } catch (error) {
        this.handleS3Error(error, `Failed to upload part ${partNumber} for ${key}`);
      }
    }
  
    /**
     * Complete a multipart upload
     */
    async completeMultipartUpload(
      key: string,
      uploadId: string,
      parts: { etag: string; partNumber: number }[]
    ): Promise<S3File> {
      try {
        const command = new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: parts.map(part => ({
              ETag: `"${part.etag}"`,
              PartNumber: part.partNumber,
            })),
          },
        });
  
        await this.client.send(command);
        
        // Get the file metadata
        const headCommand = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
        
        const headResponse = await this.client.send(headCommand);
        
        return {
          key,
          size: headResponse.ContentLength || 0,
          lastModified: headResponse.LastModified || new Date(),
          contentType: headResponse.ContentType,
          etag: headResponse.ETag?.replace(/"/g, ''),
          url: this.getObjectUrl(key),
        };
      } catch (error) {
        this.handleS3Error(error, `Failed to complete multipart upload for ${key}`);
      }
    }
  
    /**
     * Abort a multipart upload
     */
    async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
      try {
        const command = new AbortMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
        });
  
        await this.client.send(command);
      } catch (error) {
        this.handleS3Error(error, `Failed to abort multipart upload for ${key}`);
      }
    }
  
    /**
     * Download a file from S3 as a buffer
     */
    async downloadFile(key: string): Promise<Buffer> {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
  
        const response = await this.client.send(command);
        
        if (!response.Body) {
          throw new Error(`No data returned for key ${key}`);
        }
  
        // Handle Node.js Readable stream
        if (response.Body instanceof Readable) {
          return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
           (response?.Body as any)?.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
           (response?.Body as any)?.on('end', () => resolve(Buffer.concat(chunks as any)));
           (response?.Body as any)?.on('error', reject);
            // response.Body?.transformToByteArray().then((data: Uint8Array) => {
            //   resolve(Buffer.from(data));
            // }
            // ).catch((err: Error) => {
            //   reject(err);
            // }
            // );
          });
        }
        
        // Handle web ReadableStream
        if (response.Body instanceof ReadableStream) {
          const reader = response.Body.getReader();
          const chunks: Uint8Array[] = [];
          
          // Read all chunks
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          
          // Combine chunks into a single buffer
          const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
          const result = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
          }
          
          return Buffer.from(result);
        }
        
        // Handle ArrayBuffer or other types
        return Buffer.from(await response.Body.transformToByteArray());
      } catch (error) {
        this.handleS3Error(error, `Failed to download file ${key}`);
      }
    }
  
    /**
     * Get a readable stream of a file
     */
    async getFileStream(key: string): Promise<ReadableStream | Readable> {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
  
        const response = await this.client.send(command);
        
        if (!response.Body) {
          throw new Error(`No data returned for key ${key}`);
        }
  
        return response.Body as any;
      } catch (error) {
        this.handleS3Error(error, `Failed to get file stream for ${key}`);
      }
    }
  
    /**
     * Delete a file from S3
     */
    async deleteFile(key: string): Promise<void> {
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
  
        await this.client.send(command);
      } catch (error) {
        this.handleS3Error(error, `Failed to delete file ${key}`);
      }
    }
  
    /**
     * Check if a file exists
     */
    async fileExists(key: string): Promise<boolean> {
      try {
        const command = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
  
        await this.client.send(command);
        return true;
      } catch (error) {
        if (error instanceof S3ServiceException && error.name === 'NotFound') {
          return false;
        }
        this.handleS3Error(error, `Failed to check if file ${key} exists`);
      }
    }
  
    /**
     * List files in S3 with the given prefix
     */
    async listFiles(options?: ListFilesOptions): Promise<{
      files: S3File[];
      nextContinuationToken?: string;
      isTruncated: boolean;
    }> {
      try {
        const command = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: options?.prefix,
          MaxKeys: options?.maxKeys,
          ContinuationToken: options?.continuationToken,
          Delimiter: options?.delimiter,
        });
  
        const response = await this.client.send(command);
        
        const files = (response.Contents || []).map(item => ({
          key: item.Key!,
          size: item.Size || 0,
          lastModified: item.LastModified || new Date(),
          etag: item.ETag?.replace(/"/g, ''),
          url: this.getObjectUrl(item.Key!),
        }));
  
        return {
          files,
          nextContinuationToken: response.NextContinuationToken,
          isTruncated: response.IsTruncated || false,
        };
      } catch (error) {
        this.handleS3Error(error, `Failed to list files with prefix ${options?.prefix || ''}`);
      }
    }
  
    /**
     * Generate a presigned URL for getting an object
     */
    async getPresignedUrl(key: string, options?: PresignedUrlOptions): Promise<string> {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ResponseContentType: options?.contentType,
          ResponseContentDisposition: options?.contentDisposition,
        });
  
        return await getSignedUrl(this.client, command, {
          expiresIn: options?.expiresIn || 3600, // Default 1 hour
        });
      } catch (error) {
        this.handleS3Error(error, `Failed to generate presigned URL for ${key}`);
      }
    }
  
    /**
     * Generate a presigned URL for uploading an object
     */
    async getPresignedUploadUrl(key: string, options?: PresignedUrlOptions & UploadOptions): Promise<string> {
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: options?.contentType,
          ContentDisposition: options?.contentDisposition, 
        //   acl: options?.acl || this.acl,
          Metadata: options?.metadata,
        });
  
        return await getSignedUrl(this.client, command, {
          expiresIn: options?.expiresIn || 3600, // Default 1 hour
        });
      } catch (error) {
        this.handleS3Error(error, `Failed to generate presigned upload URL for ${key}`);
      }
    }
  
    /**
     * Get a public URL for an object
     */
    getObjectUrl(key: string): string {
      const endpoint = this.config.endpoint.replace(/\/+$/, ''); // Remove trailing slashes
      
      // Different URL formation based on path style vs virtual hosted style
      if (this.shouldUsePathStyle()) {
        return `${endpoint}/${this.bucket}/${key}`;
      } else {
        // For virtual hosted style
        return `${endpoint}/${key}`;
      }
    }
  
    /**
     * Handle S3 errors with consistent error messages
     */
    private handleS3Error(error: unknown, message: string): never {
      if (error instanceof S3ServiceException) {
        throw new S3ProviderError(
          `${message}: ${error.message} (Code: ${error.$metadata.httpStatusCode})`,
          error
        );
      }
      throw new S3ProviderError(
        `${message}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }
  
  export class S3ProviderError extends Error {
    constructor(message: string, public originalError: unknown) {
      super(message);
      this.name = "S3ProviderError";
    }
  }


  