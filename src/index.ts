import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';

// Importar rutas
import healthRoutes from './routes/health';
import userRoutes from './routes/userRoutes';
import productRoutes from './routes/productRoutes';
import consumableRoutes from './routes/consumableRoutes';
import clientRoutes from './routes/clientRoutes';
import supplierRoutes from './routes/supplierRoutes';
import contactRoutes from './routes/contactRoutes';
import logRoutes from './routes/logRoutes';
import quotationRoutes from './routes/quotationRoutes';
import saleRoutes from './routes/saleRoutes';
import purchaseRoutes from './routes/purchaseRoutes';

// Configuración de variables de entorno
dotenv.config();

// Crear aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// Log del puerto que se usará
console.log(`Puerto configurado: ${PORT}`);

// Configuración de CORS
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de logging para peticiones
app.use((req, res, next) => {
  console.log(`${req.method} 🍄 ${req.path}`);
  next();
});

// Rutas
app.use('/health', healthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/consumables', consumableRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);

// Ruta base
app.get('/', (req, res) => {
  res.json({ message: 'API de Fungus funcionando correctamente' });
});

// Iniciar servidor
const startServer = async () => {
  try {
    // Conectar a MongoDB
    await connectDB();

    // Iniciar servidor Express
    app.listen(Number(PORT), '0.0.0.0', async () => {
      console.log(`Servidor corriendo en puerto ${PORT} y expuesto en todas las interfaces (0.0.0.0)`);
    });
  } catch (error: any) {
    console.error(`Error al iniciar el servidor: ${error.message}`);
    process.exit(1);
  }
};

startServer(); 