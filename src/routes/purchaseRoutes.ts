import express from 'express';
import {
  createPurchase,
  getPurchases,
  getPurchaseById,
  updatePurchase,
  deletePurchase,
  changePurchaseStatus,
  previewPurchaseCalculation
} from '../controllers/purchaseController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// Proteger todas las rutas de compras
router.use(protect);

// Ruta para preview de cálculo (debe ir antes de /:id)
router.route('/preview')
  .post(previewPurchaseCalculation); // Preview de cálculo de compra

// Rutas para el CRUD de compras
router.route('/')
  .get(getPurchases)       // Obtener todas las compras
  .post(createPurchase);   // Crear una nueva compra

router.route('/:id')
  .get(getPurchaseById)    // Obtener una compra por ID
  .put(updatePurchase)     // Actualizar una compra
  .delete(deletePurchase); // Eliminar una compra (borrado lógico)

// Ruta para cambiar el estado de una compra
router.route('/:id/status')
  .patch(changePurchaseStatus);

export default router; 