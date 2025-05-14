import express from 'express';
import {
  getPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  deletePurchase,
  getPurchasesBySupplier,
  getExpensesByCategory
} from '../controllers/purchaseController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Rutas protegidas
router.use(protect);

// Rutas básicas CRUD
router.route('/')
  .get(getPurchases)
  .post(createPurchase);

router.route('/:id')
  .get(getPurchaseById)
  .put(updatePurchase)
  .delete(deletePurchase);

// Rutas específicas
router.route('/supplier/:supplierId').get(getPurchasesBySupplier);
router.route('/expenses').post(getExpensesByCategory);

export default router; 