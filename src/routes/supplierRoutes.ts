import express from 'express';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  searchSuppliers,
  getSupplierDetails
} from '../controllers/supplierController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Todas las rutas de proveedores son protegidas
router.use(protect);

// Ruta de búsqueda (debe ir antes que las rutas con parámetros)
router.route('/search').get(searchSuppliers);

// Rutas para el CRUD básico
router.route('/')
  .get(getSuppliers)
  .post(createSupplier);

router.route('/:id')
  .get(getSupplierById)
  .put(updateSupplier)
  .delete(deleteSupplier);

// Ruta para obtener detalles del proveedor
router.route('/:id/details')
  .get(getSupplierDetails);

export default router; 