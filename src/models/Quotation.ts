import mongoose, { Schema, Document } from 'mongoose';
import Transaction, { ITransaction, TransactionType } from './Transaction';

// Interfaz para el documento de Cotización
export interface IQuotation extends ITransaction {
  validUntil?: Date;
}

// Esquema específico para cotizaciones
const QuotationSchema: Schema = new Schema({
  validUntil: {
    type: Date,
    validate: {
      validator: async function (this: IQuotation, value: Date) {
        if (!value) return true; // Si no hay validUntil, es válido

        // En operaciones de update, this.date puede no estar disponible
        // Obtener la fecha desde la BD si es necesario
        let emissionDate = this.date;

        if (!emissionDate && this._id) {
          // Si no tenemos la fecha y es un update, la obtenemos de la BD
          const existingDoc = await mongoose.model('Transaction').findById(this._id);
          emissionDate = existingDoc?.date;
        }

        // Si aún no tenemos fecha de emisión, usar fecha actual como fallback
        if (!emissionDate) {
          emissionDate = new Date();
        }

        return value > emissionDate;
      },
      message: 'La fecha de validez debe ser posterior a la fecha de emisión'
    }
  }
});

// Crear el modelo de Cotización como un discriminador de Transaction
const Quotation = Transaction.discriminator<IQuotation>(
  TransactionType.QUOTATION,
  QuotationSchema
);

export default Quotation; 