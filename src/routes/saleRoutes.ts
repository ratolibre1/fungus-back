import express from 'express';
import {
  getSales,
  getSaleById,
  createSale,
  updateSale,
  deleteSale,
  getSalesByPeriod,
  getSalesByClient,
  generateInvoicePDF
} from '../controllers/saleController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Rutas protegidas
router.use(protect);

// Rutas básicas CRUD
router.route('/')
  .get(getSales)
  .post(createSale);

router.route('/:id')
  .get(getSaleById)
  .put(updateSale)
  .delete(deleteSale);

// Rutas específicas
router.route('/period').post(getSalesByPeriod);
router.route('/client/:clientId').get(getSalesByClient);
router.route('/:id/pdf').get(generateInvoicePDF);

export default router; 