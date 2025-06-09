import express from 'express';
import {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  searchContacts,
  getDualContacts,
  addSupplierRole,
  addCustomerRole,
  removeSupplierRole,
  removeCustomerRole
} from '../controllers/contactController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Todas las rutas de contactos son protegidas
router.use(protect);

// Ruta para contactos duales (que son cliente y proveedor)
router.route('/dual').get(getDualContacts);

// Ruta de búsqueda (debe ir antes que las rutas con parámetros)
router.route('/search').get(searchContacts);

// Rutas para el CRUD básico
router.route('/')
  .get(getContacts)
  .post(createContact);

router.route('/:id')
  .get(getContactById)
  .put(updateContact)
  .delete(deleteContact);

// Rutas específicas para manejo de roles
router.route('/:id/add-supplier-role').patch(addSupplierRole);
router.route('/:id/add-customer-role').patch(addCustomerRole);
router.route('/:id/remove-supplier-role').patch(removeSupplierRole);
router.route('/:id/remove-customer-role').patch(removeCustomerRole);

export default router; 