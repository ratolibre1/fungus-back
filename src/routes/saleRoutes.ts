import express from 'express';
import {
  createSale,
  getSales,
  getSaleById,
  updateSale,
  deleteSale,
  changeSaleStatus,
  previewSaleCalculation,
  convertQuotationToSale
} from '../controllers/saleController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// Proteger todas las rutas de ventas
router.use(protect);

// Ruta para preview de cálculo (debe ir antes de /:id)
router.route('/preview')
  .post(previewSaleCalculation); // Preview de cálculo de venta

// Ruta para convertir cotización a venta (debe ir antes de /:id)
router.route('/convert/:quotationId')
  .post(convertQuotationToSale); // Convertir cotización a venta

// Rutas para el CRUD de ventas
router.route('/')
  .get(getSales)       // Obtener todas las ventas
  .post(createSale);   // Crear una nueva venta

router.route('/:id')
  .get(getSaleById)    // Obtener una venta por ID
  .put(updateSale)     // Actualizar una venta
  .delete(deleteSale); // Eliminar una venta (borrado lógico)

// Ruta para cambiar el estado de una venta
router.route('/:id/status')
  .patch(changeSaleStatus);

export default router; 