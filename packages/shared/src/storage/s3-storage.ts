import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export interface S3StorageConfig {
  endpoint?: string
  region?: string
  bucket: string
  accessKeyId?: string
  secretAccessKey?: string
  forcePathStyle?: boolean
  useMock?: boolean
  publicUrl?: string
}

export interface UploadResult {
  key: string
  size: number
  url: string
  bucket: string
  mimeType: string
}

export interface RetrievedFile {
  buffer: Buffer
  mimeType: string
  contentLength: number
}

interface MockStorageItem {
  buffer: Buffer
  mimeType: string
  metadata?: Record<string, string>
}

export class S3StorageService {
  readonly bucket: string
  readonly endpoint?: string
  readonly publicUrl?: string
  private client: S3Client | null = null
  private mockStore: Map<string, MockStorageItem> = new Map()
  private isMock: boolean

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket || 'xatxoot-media'
    this.endpoint = config.endpoint
    this.publicUrl = config.publicUrl

    const isTest =
      typeof process !== 'undefined' &&
      (process.env.NODE_ENV === 'test' ||
        process.env.BUN_ENV === 'test' ||
        Boolean(process.env.BUN_TEST) ||
        (Array.isArray(process.argv) &&
          process.argv.some((a) => typeof a === 'string' && a.includes('test'))))

    this.isMock = config.useMock ?? isTest

    if (!this.isMock) {
      this.initClient(config)
    }
  }

  private initClient(config: S3StorageConfig): void {
    try {
      this.client = new S3Client({
        endpoint: config.endpoint,
        region: config.region || 'us-east-1',
        credentials:
          config.accessKeyId && config.secretAccessKey
            ? {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
              }
            : undefined,
        forcePathStyle: config.forcePathStyle ?? true,
      })
    } catch {
      this.isMock = true
    }
  }

  resetMock(): void {
    this.mockStore.clear()
  }

  async uploadFile(
    key: string,
    buffer: Buffer | Uint8Array,
    mimeType: string,
    options?: { bucket?: string; metadata?: Record<string, string> },
  ): Promise<UploadResult> {
    const targetBucket = options?.bucket || this.bucket
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)

    if (this.isMock || !this.client) {
      this.mockStore.set(`${targetBucket}/${key}`, {
        buffer: buf,
        mimeType,
        metadata: options?.metadata,
      })

      const url = this.publicUrl
        ? `${this.publicUrl.replace(/\/+$/, '')}/${key}`
        : `/api/v1/media/${key}`

      return {
        key,
        size: buf.length,
        url,
        bucket: targetBucket,
        mimeType,
      }
    }

    const command = new PutObjectCommand({
      Bucket: targetBucket,
      Key: key,
      Body: buf,
      ContentType: mimeType,
      Metadata: options?.metadata,
    })

    await this.client.send(command)

    const url = this.publicUrl
      ? `${this.publicUrl.replace(/\/+$/, '')}/${key}`
      : `${this.endpoint || ''}/${targetBucket}/${key}`

    return {
      key,
      size: buf.length,
      url,
      bucket: targetBucket,
      mimeType,
    }
  }

  async getFile(key: string, options?: { bucket?: string }): Promise<RetrievedFile | null> {
    const targetBucket = options?.bucket || this.bucket

    if (this.isMock || !this.client) {
      const item = this.mockStore.get(`${targetBucket}/${key}`)
      if (!item) return null
      return {
        buffer: item.buffer,
        mimeType: item.mimeType,
        contentLength: item.buffer.length,
      }
    }

    try {
      const command = new GetObjectCommand({
        Bucket: targetBucket,
        Key: key,
      })
      const response = await this.client.send(command)

      if (!response.Body) return null

      const bytes = await response.Body.transformToByteArray()
      const buffer = Buffer.from(bytes)

      return {
        buffer,
        mimeType: response.ContentType || 'application/octet-stream',
        contentLength: response.ContentLength || buffer.length,
      }
    } catch {
      return null
    }
  }

  async fileExists(key: string, options?: { bucket?: string }): Promise<boolean> {
    const targetBucket = options?.bucket || this.bucket

    if (this.isMock || !this.client) {
      return this.mockStore.has(`${targetBucket}/${key}`)
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: targetBucket,
        Key: key,
      })
      await this.client.send(command)
      return true
    } catch {
      return false
    }
  }

  async getSignedUrl(
    key: string,
    expiresInSeconds = 3600,
    options?: { bucket?: string },
  ): Promise<string> {
    const targetBucket = options?.bucket || this.bucket

    if (this.isMock || !this.client) {
      const base = this.endpoint || 'http://localhost:9000'
      return `${base}/${targetBucket}/${key}?X-Amz-Expires=${expiresInSeconds}&mock-signature=true`
    }

    const command = new GetObjectCommand({
      Bucket: targetBucket,
      Key: key,
    })

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
  }

  async deleteFile(key: string, options?: { bucket?: string }): Promise<void> {
    const targetBucket = options?.bucket || this.bucket

    if (this.isMock || !this.client) {
      this.mockStore.delete(`${targetBucket}/${key}`)
      return
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: targetBucket,
        Key: key,
      })
      await this.client.send(command)
    } catch {
      // Ignore delete errors
    }
  }
}

export function createStorageService(config?: Partial<S3StorageConfig>): S3StorageService {
  return new S3StorageService({
    bucket: config?.bucket || process.env.S3_BUCKET || 'xatxoot-media',
    endpoint: config?.endpoint || process.env.S3_ENDPOINT,
    region: config?.region || process.env.S3_REGION || 'us-east-1',
    accessKeyId: config?.accessKeyId || process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: config?.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: config?.forcePathStyle ?? process.env.S3_FORCE_PATH_STYLE !== 'false',
    useMock: config?.useMock,
    publicUrl: config?.publicUrl || process.env.S3_PUBLIC_URL,
  })
}
