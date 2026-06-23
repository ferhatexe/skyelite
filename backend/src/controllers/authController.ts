import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const ADMIN_PIN = '1453';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  const { pin } = req.body;

  try {
    if (!pin) {
      return res.status(400).json({ success: false, message: 'PIN zorunludur.' });
    }

    if (pin !== ADMIN_PIN) {
      return res.status(401).json({ success: false, message: 'Geçersiz PIN kodu.' });
    }

    // Sign JWT
    const token = jwt.sign(
      { id: 1, email: 'admin@skyelite.com' },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    res.json({
      success: true,
      token,
      admin: {
        id: 1,
        email: 'admin@skyelite.com'
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: any, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      admin: { id: 1, email: 'admin@skyelite.com', created_at: new Date().toISOString() }
    });
  } catch (error) {
    next(error);
  }
};
