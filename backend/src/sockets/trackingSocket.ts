import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { db } from '../config/db';
import { logger } from '../config/logger';

interface SocketData {
  role?: 'admin' | 'courier';
  courierId?: number;
  courierName?: string;
  adminId?: number;
}

export const initTrackingSocket = (io: Server) => {
  // Middleware to authenticate socket connections
  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    const role = socket.handshake.auth.role || socket.handshake.query.role;

    if (!role) {
      return next(new Error('Yetkisiz bağlantı: Rol belirtilmedi.'));
    }

    try {
      if (role === 'admin') {
        if (!token) return next(new Error('Yetkisiz bağlantı: Token eksik.'));
        
        const decoded = jwt.verify(token, env.JWT_SECRET) as { id: number; email: string };
        socket.data.role = 'admin';
        socket.data.adminId = decoded.id;
        return next();
      } 
      
      if (role === 'courier') {
        const deviceId = socket.handshake.auth.deviceId || socket.handshake.query.deviceId;
        const courierName = socket.handshake.auth.courierName || socket.handshake.query.courierName;
        const deviceInfo = socket.handshake.auth.deviceInfo || socket.handshake.query.deviceInfo || 'Bilinmeyen Cihaz';

        if (!deviceId || !courierName) {
          return next(new Error('Yetkisiz bağlantı: Cihaz kimliği veya kurye adı eksik.'));
        }

        // Check if courier device already exists
        const result = await db.query(
          'SELECT id FROM couriers WHERE device_id = $1',
          [deviceId]
        );

        let courierId: number;

        if (result.rows.length > 0) {
          courierId = result.rows[0].id;
          // Update courier details
          await db.query(
            'UPDATE couriers SET name = $1, status = $2, device_info = $3 WHERE id = $4',
            [courierName.trim(), 'active', deviceInfo, courierId]
          );
        } else {
          // Insert new courier
          const insertRes = await db.query(
            'INSERT INTO couriers (name, device_id, device_info, status) VALUES ($1, $2, $3, $4) RETURNING id',
            [courierName.trim(), deviceId, deviceInfo, 'active']
          );
          courierId = insertRes.rows[0].id;
        }

        socket.data.role = 'courier';
        socket.data.courierId = courierId;
        socket.data.courierName = courierName.trim();
        socket.data.deviceInfo = deviceInfo;
        return next();
      }

      return next(new Error('Geçersiz rol.'));
    } catch (error) {
      logger.error('Socket authentication error:', error);
      return next(new Error('Kimlik doğrulama hatası.'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const role = socket.data.role;

    if (role === 'admin') {
      socket.join('admins');
      logger.info(`Admin connected: ID ${socket.data.adminId}, Socket: ${socket.id}`);

      // Handle on-demand location pull request from admin
      socket.on('request_courier_location', (data: { courierId: number }) => {
        const { courierId } = data;
        logger.info(`Admin (Socket: ${socket.id}) requested location pull for courier ID ${courierId}`);
        io.to(`courier_${courierId}`).emit('pull_location_request');
      });
    } else if (role === 'courier') {
      const courierId = socket.data.courierId!;
      const courierName = socket.data.courierName!;
      const deviceInfo = socket.data.deviceInfo!;
      
      socket.join(`courier_${courierId}`);
      logger.info(`Courier connected: ${courierName} (ID: ${courierId}), Socket: ${socket.id}`);

      // Set status to active in database and notify admins
      try {
        io.to('admins').emit('courier_status_changed', {
          courierId,
          status: 'active',
          name: courierName,
          device_info: deviceInfo
        });
      } catch (err) {
        logger.error('Error emitting status change on connect:', err);
      }

      // Handle location update
      socket.on('location_update', async (data: {
        latitude: number;
        longitude: number;
        accuracy: number;
        speed?: number | null;
        heading?: number | null;
        timestamp?: number | string;
      }) => {
        try {
          const { latitude, longitude, accuracy, speed, heading, timestamp } = data;

          if (latitude === undefined || longitude === undefined || accuracy === undefined) {
            return socket.emit('error_message', { message: 'Geçersiz konum formatı.' });
          }

          const parsedTimestamp = timestamp ? new Date(timestamp) : new Date();

          // Save to database
          await db.query(
            `INSERT INTO locations (courier_id, latitude, longitude, accuracy, speed, heading, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              courierId, 
              latitude, 
              longitude, 
              accuracy, 
              speed !== undefined ? speed : null, 
              heading !== undefined ? heading : null, 
              parsedTimestamp.toISOString()
            ]
          );

          // Broadcast to admins
          io.to('admins').emit('courier_location_changed', {
            courierId,
            latitude,
            longitude,
            accuracy,
            speed: speed || null,
            heading: heading || null,
            last_update: parsedTimestamp.toISOString()
          });

          logger.debug(`Location updated for ${courierName} (ID: ${courierId}): ${latitude}, ${longitude}`);
        } catch (err) {
          logger.error('Error processing location update:', err);
          socket.emit('error_message', { message: 'Konum kaydedilirken hata oluştu.' });
        }
      });
    }

    socket.on('disconnect', async () => {
      if (socket.data.role === 'courier') {
        const courierId = socket.data.courierId!;
        const courierName = socket.data.courierName!;
        logger.info(`Courier disconnected: ${courierName} (ID: ${courierId})`);

        try {
          // Set status to inactive in database and notify admins
          await db.query('UPDATE couriers SET status = $1 WHERE id = $2', ['inactive', courierId]);
          io.to('admins').emit('courier_status_changed', {
            courierId,
            status: 'inactive',
            name: courierName
          });
        } catch (err) {
          logger.error('Error updating courier status on disconnect:', err);
        }
      } else if (socket.data.role === 'admin') {
        logger.info(`Admin disconnected: ID ${socket.data.adminId}`);
      }
    });
  });
};
