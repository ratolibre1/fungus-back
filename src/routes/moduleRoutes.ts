import express from 'express';
import {
  getAllModules,
  getMyModules,
  getModuleById,
  createModule,
  updateModule,
  toggleActiveState,
  toggleVisibility,
  deleteModule,
  initializeModules
} from '../controllers/moduleController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// Ruta para obtener los módulos del usuario actual
// Esta ruta es accesible para cualquier usuario autenticado
router.route('/my-modules')
  .get(protect, getMyModules);

// Ruta para inicializar los módulos del sistema
router.route('/initialize')
  .post(protect, authorize('admin'), initializeModules);

// Las siguientes rutas requieren autenticación y rol de administrador
router.use(protect);
router.use(authorize('admin'));

// Rutas para gestionar todos los módulos
router.route('/')
  .get(getAllModules)
  .post(createModule);

// Rutas para gestionar un módulo específico
router.route('/:id')
  .get(getModuleById)
  .put(updateModule)
  .delete(deleteModule);

// Rutas para cambiar estado y visibilidad
router.route('/:id/toggle-active')
  .patch(toggleActiveState);

router.route('/:id/toggle-visibility')
  .patch(toggleVisibility);

export default router; 