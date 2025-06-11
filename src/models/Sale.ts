import mongoose, { Schema, Document } from 'mongoose';
import Transaction, { ITransaction, TransactionType } from './Transaction';

// Interfaz para el documento de Venta
export interface ISale extends ITransaction {
  relatedQuotation?: mongoose.Types.ObjectId;
}

// Esquema específico para ventas
const SaleSchema: Schema = new Schema({
  relatedQuotation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    validate: {
      validator: function (this: ISale, value: any) {
        // Las ventas pueden tener una cotización relacionada, pero no es obligatorio
        return true;
      },
      message: 'La cotización relacionada debe ser válida'
    }
  }
});

// Crear el modelo de Venta como un discriminador de Transaction
const Sale = Transaction.discriminator<ISale>(
  TransactionType.SALE,
  SaleSchema
);

export default Sale; 