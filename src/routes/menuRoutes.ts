import express from 'express';
import {
  getAllMenuItems,
  getMyMenu,
  getMenuItemByName,
  createMenuItem,
  updateMenuItem,
  toggleItemActive,
  deleteMenuItem,
  initializeMenu
} from '../controllers/menuController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// Rutas públicas
router.route('/')
  .get(getAllMenuItems);

// Ruta para obtener el menú del usuario actual
// Esta ruta es accesible para cualquier usuario autenticado
router.route('/my-menu')
  .get(protect, getMyMenu);

// Ruta para inicializar el menú del sistema
router.route('/initialize')
  .post(protect, authorize('admin'), initializeMenu);

// Las siguientes rutas requieren autenticación y rol de administrador
router.use(protect);
router.use(authorize('admin'));

// Ruta para crear un nuevo elemento de menú
router.route('/')
  .post(createMenuItem);

// Rutas para gestionar elementos de menú por nombre
router.route('/:name')
  .get(getMenuItemByName)
  .patch(updateMenuItem)
  .delete(deleteMenuItem);

// Ruta para activar/desactivar un elemento
router.route('/:name/toggle-active')
  .patch(toggleItemActive);

export default router; 