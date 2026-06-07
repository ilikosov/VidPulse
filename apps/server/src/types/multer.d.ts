declare module 'multer' {
  import { RequestHandler } from 'express';

  export class MulterError extends Error {
    constructor(code: string);
    code: string;
  }

  export interface File {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }

  export interface MulterInstance {
    single(fieldName: string): RequestHandler;
  }

  export interface MulterOptions {
    storage?: unknown;
    limits?: {
      fileSize?: number;
    };
    fileFilter?: (
      req: unknown,
      file: File,
      callback: (error: Error | null, acceptFile?: boolean) => void,
    ) => void;
  }

  interface MulterFactory {
    (options?: MulterOptions): MulterInstance;
    memoryStorage(): unknown;
    MulterError: typeof MulterError;
  }

  const multer: MulterFactory;
  export default multer;
}

declare namespace Express {
  interface Request {
    file?: import('multer').File;
  }
}
