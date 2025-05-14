import express from 'express';
import {
  getConsumables,
  getConsumableById,
  createConsumable,
  updateConsumable,
  deleteConsumable
} from '../controllers/consumableController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Todas las rutas de consumibles ahora son protegidas
router.use(protect);

// Rutas CRUD básicas
router.route('/')
  .get(getConsumables)
  .post(createConsumable);

router.route('/:id')
  .get(getConsumableById)
  .put(updateConsumable)
  .delete(deleteConsumable);

export default router; 