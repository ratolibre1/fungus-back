import mongoose from 'mongoose';
import Transaction, { ITransaction, TransactionType } from './Transaction';

// Interfaz específica para compras (extiende ITransaction)
export interface IPurchase extends ITransaction {
  type: 'purchase';
  // Las compras usan counterparty para referenciar PROVEEDORES
  // Todos los demás campos vienen de Transaction
}

// Crear el discriminator para Purchase
const Purchase = Transaction.discriminator<IPurchase>(
  TransactionType.PURCHASE,
  new mongoose.Schema({
    // No necesitamos campos adicionales específicos para compras
    // Todo viene del esquema base Transaction
  })
);

export default Purchase; 