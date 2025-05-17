import express from 'express';
import { getLogs, getLogById, deleteLog, cleanupLogs } from '../controllers/logController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// Todas las rutas de logs están protegidas y requieren rol de admin
router.use(protect);
router.use(authorize('admin'));

// Rutas para el CRUD de logs
router.route('/')
  .get(getLogs); // Obtener logs con paginación y filtros

router.route('/cleanup')
  .delete(cleanupLogs); // Eliminar logs antiguos

router.route('/:id')
  .get(getLogById)     // Obtener un log específico
  .delete(deleteLog);  // Eliminar un log

export default router; 