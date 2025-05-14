import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Obtener la URI de MongoDB desde las variables de entorno
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fungus';

// Opciones de conexión
const options = {
  // Estas son opciones recomendadas para conexiones estables con MongoDB
};

// Variable para mantener la conexión
let connection: typeof mongoose | null = null;

/**
 * Inicia la conexión a MongoDB
 */
export const connectDB = async (): Promise<typeof mongoose> => {
  try {
    if (connection) {
      console.log('Usando conexión existente a MongoDB');
      return connection;
    }

    const conn = await mongoose.connect(MONGO_URI);
    connection = mongoose;

    console.log(`MongoDB conectado: ${conn.connection.host}`);

    // Manejar eventos de conexión
    mongoose.connection.on('error', (err) => {
      console.error(`Error de conexión MongoDB: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB desconectado');
    });

    // Manejo de señales de cierre para cerrar conexión correctamente
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('Conexión a MongoDB cerrada por finalización de la aplicación');
      process.exit(0);
    });

    return mongoose;
  } catch (error: any) {
    console.error(`Error al conectar a MongoDB: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Obtiene la instancia de conexión a MongoDB
 */
export const getConnection = (): typeof mongoose | null => {
  return connection;
};

/**
 * Cierra la conexión a MongoDB
 */
export const closeConnection = async (): Promise<void> => {
  if (connection) {
    await mongoose.connection.close();
    connection = null;
    console.log('Conexión a MongoDB cerrada');
  }
};

export default {
  connectDB,
  getConnection,
  closeConnection
}; 