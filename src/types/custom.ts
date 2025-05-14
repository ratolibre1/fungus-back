import { IUser } from '../models/User';
import mongoose from 'mongoose';

// Extender la interfaz Request de Express para incluir la propiedad user
// La declaración de user se hace en auth.ts, así que comentamos esta parte
declare global {
  namespace Express {
    // La declaración original está en auth.ts - asegúrate que sea consistente
    // interface Request {
    //   user?: IUser & { _id: mongoose.Types.ObjectId };
    // }
  }
}

// Tipos para los productos y consumibles con propiedades conocidas
export interface IItemWithFields {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  netPrice: number;
  dimensions?: string;
  stock: number;
} 