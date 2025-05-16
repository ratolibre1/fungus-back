import express from 'express';
import {
  registerUser,
  loginUser,
  getUserProfile,
  changePassword,
  resetUserPassword
} from '../controllers/userController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Rutas simples sin comentarios para evitar problemas de TypeScript
router.route('/register').post(registerUser);
router.route('/login').post(loginUser);
router.route('/me').get(protect, getUserProfile);
router.route('/change-password').post(protect, changePassword);
router.route('/reset-password').post(protect, resetUserPassword);

export default router; 