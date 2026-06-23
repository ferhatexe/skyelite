import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, err);

  const statusCode = err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Sunucu tarafında bir hata oluştu.' 
    : err.message || 'Bilinmeyen bir hata oluştu.';

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
