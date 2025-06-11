import express from 'express';
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  searchClients,
  getClientDetails,
  getClientMetrics,
  getClientTransactions
} from '../controllers/clientController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Todas las rutas de clientes son protegidas
router.use(protect);

// Ruta de búsqueda (debe ir antes que las rutas con parámetros)
router.route('/search').get(searchClients);

// Rutas para el CRUD básico
router.route('/')
  .get(getClients)
  .post(createClient);

// Ruta para obtener historial de compras de un cliente
router.route('/:id/details')
  .get(getClientDetails);

router.route('/:id')
  .get(getClientById)
  .put(updateClient)
  .delete(deleteClient);

// Rutas específicas para detalles, métricas y transacciones
router.route('/:id/metrics').get(getClientMetrics);
router.route('/:id/transactions').get(getClientTransactions);

export default router; 