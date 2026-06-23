import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db';

export const saveLocation = async (req: Request, res: Response, next: NextFunction) => {
  const { courier_id, latitude, longitude, accuracy, speed, heading, timestamp } = req.body;

  try {
    if (!courier_id || latitude === undefined || longitude === undefined || accuracy === undefined) {
      return res.status(400).json({ success: false, message: 'Eksik konum parametreleri.' });
    }

    // Insert location into database
    const query = `
      INSERT INTO locations (courier_id, latitude, longitude, accuracy, speed, heading, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_TIMESTAMP))
      RETURNING *
    `;

    const result = await db.query(query, [
      courier_id,
      latitude,
      longitude,
      accuracy,
      speed !== undefined ? speed : null,
      heading !== undefined ? heading : null,
      timestamp ? new Date(timestamp).toISOString() : null
    ]);

    // Update courier status to active since we just got a location update
    await db.query('UPDATE couriers SET status = $1 WHERE id = $2', ['active', courier_id]);

    res.status(201).json({
      success: true,
      location: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

export const getLocationHistory = async (req: Request, res: Response, next: NextFunction) => {
  const { courierId } = req.params;
  const limit = parseInt(req.query.limit as string || '100', 10);

  try {
    const query = `
      SELECT id, latitude, longitude, accuracy, speed, heading, timestamp
      FROM locations
      WHERE courier_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;

    const result = await db.query(query, [courierId, limit]);

    // Return in chronological order
    const history = result.rows.reverse();

    res.json({
      success: true,
      history
    });
  } catch (error) {
    next(error);
  }
};
