import { Router } from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/authController';
import * as courierController from '../controllers/courierController';
import * as locationController from '../controllers/locationController';
import { protectAdmin } from '../middleware/auth';
import { authLimiter, locationLimiter } from '../middleware/rateLimiter';

const router = Router();

// Auth Routes
router.post(
  '/auth/login', 
  authLimiter,
  body('email').isEmail().withMessage('Geçerli bir e-posta adresi giriniz.'),
  body('password').notEmpty().withMessage('Şifre zorunludur.'),
  authController.login
);
router.get('/auth/me', protectAdmin, authController.getMe);

// Courier Management (Admin protected)
router.post(
  '/couriers', 
  protectAdmin, 
  body('name').trim().notEmpty().withMessage('Kurye adı zorunludur.'),
  courierController.createCourier
);
router.get('/couriers', protectAdmin, courierController.getAllCouriers);
router.delete('/couriers/:id', protectAdmin, courierController.deleteCourier);

// Public Courier Endpoint (For checking device registration status)
router.get('/couriers/device/:deviceId', courierController.getCourierByDeviceId);

// Location Routes
router.post(
  '/locations', 
  locationLimiter,
  body('courier_id').isInt().withMessage('Geçerli kurye id giriniz.'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Geçerli enlem giriniz.'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Geçerli boylam giriniz.'),
  body('accuracy').isFloat({ min: 0 }).withMessage('Geçerli doğruluk değeri giriniz.'),
  locationController.saveLocation
);
router.get('/locations/:courierId/history', protectAdmin, locationController.getLocationHistory);

export default router;
