import express from 'express';
import {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  convertToSale,
  filterQuotations,
  getPendingQuotations
} from '../controllers/quotationController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Rutas protegidas
router.use(protect);

// Rutas básicas CRUD
router.route('/')
  .get(getQuotations)
  .post(createQuotation);

router.route('/:id')
  .get(getQuotationById)
  .put(updateQuotation)
  .delete(deleteQuotation);

// Rutas específicas
router.route('/:id/convert').post(convertToSale);
router.route('/filter').post(filterQuotations);
router.route('/pending').get(getPendingQuotations);

export default router; 