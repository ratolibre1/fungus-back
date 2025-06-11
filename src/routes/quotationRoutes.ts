import express from 'express';
import {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotation,
  deleteQuotation,
  changeQuotationStatus,
  previewQuotationCalculation
} from '../controllers/quotationController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// Proteger todas las rutas de cotizaciones
router.use(protect);

// Ruta para preview de cálculo (debe ir antes de /:id)
router.route('/preview')
  .post(previewQuotationCalculation); // Preview de cálculo de cotización

// Rutas para el CRUD de cotizaciones
router.route('/')
  .get(getQuotations)       // Obtener todas las cotizaciones
  .post(createQuotation);   // Crear una nueva cotización

router.route('/:id')
  .get(getQuotationById)    // Obtener una cotización por ID
  .put(updateQuotation)     // Actualizar una cotización
  .delete(deleteQuotation); // Eliminar una cotización (borrado lógico)

// Ruta para cambiar el estado de una cotización
router.route('/:id/status')
  .patch(changeQuotationStatus);

export default router; 