import express from 'express';
import { getLogs } from '../controllers/logController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// Todas las rutas de logs están protegidas y requieren rol de admin
router.use(protect);
router.use(authorize('admin'));

// Ruta para obtener logs
router.route('/').get(getLogs);

export default router; 