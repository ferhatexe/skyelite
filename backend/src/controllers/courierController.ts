import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../config/db';

export const createCourier = async (req: Request, res: Response, next: NextFunction) => {
  const { name } = req.body;

  try {
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Kurye adı zorunludur.' });
    }

    // Generate unique device ID placeholder
    const deviceId = crypto.randomBytes(16).toString('hex');

    const result = await db.query(
      'INSERT INTO couriers (name, device_id, status) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), deviceId, 'inactive']
    );

    res.status(201).json({
      success: true,
      courier: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

export const getAllCouriers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get all couriers with their latest location information
    const query = `
      SELECT 
        c.id, 
        c.name, 
        c.device_id, 
        c.device_info, 
        c.status, 
        c.created_at,
        l.latitude, 
        l.longitude, 
        l.accuracy, 
        l.speed, 
        l.heading, 
        l.timestamp AS last_update
      FROM couriers c
      LEFT JOIN locations l ON l.id = (
        SELECT id 
        FROM locations 
        WHERE courier_id = c.id 
        ORDER BY timestamp DESC 
        LIMIT 1
      )
      ORDER BY c.created_at DESC;
    `;

    const result = await db.query(query);

    res.json({
      success: true,
      couriers: result.rows[0] ? result.rows : []
    });
  } catch (error) {
    next(error);
  }
};

export const getCourierByDeviceId = async (req: Request, res: Response, next: NextFunction) => {
  const { deviceId } = req.params;

  try {
    const result = await db.query(
      'SELECT id, name, device_id, status FROM couriers WHERE device_id = $1',
      [deviceId]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, courier: null });
    }

    res.json({
      success: true,
      courier: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCourier = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM couriers WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Kurye bulunamadı.' });
    }

    res.json({
      success: true,
      message: 'Kurye başarıyla silindi.',
      courier: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};
