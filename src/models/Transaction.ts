import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './User';

// Tipos de transacciones
export enum TransactionType {
  QUOTATION = 'quotation',
  PURCHASE = 'purchase',
  SALE = 'sale'
}

// Tipos de documentos
export enum DocumentType {
  FACTURA = 'factura',
  BOLETA = 'boleta'
}

// Estados de transacción
export enum TransactionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CONVERTED = 'converted',
  RECEIVED = 'received',
  INVOICED = 'invoiced',
  PAID = 'paid'
}

// Interfaz para los items de la transacción
export interface ITransactionItem {
  item?: Types.ObjectId;
  quantity: number;
  unitPrice: number;
  discount?: number;
  subtotal: number;
}

// Interfaz para el documento de Transacción
export interface ITransaction extends Document {
  type: string;
  correlative: number;
  documentType: string;
  documentNumber: string;
  date: Date;
  counterparty: Types.ObjectId;
  items: ITransactionItem[];
  taxRate?: number;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: string;
  user: Types.ObjectId;
  relatedQuotation?: Types.ObjectId;
  observations?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Esquema para los items de la transacción
const TransactionItemSchema: Schema = new Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: false // Ya no es requerido, usaremos el _id del subdocumento
  },
  quantity: {
    type: Number,
    required: [true, 'La cantidad es requerida'],
    min: [0.01, 'La cantidad debe ser mayor a 0']
  },
  unitPrice: {
    type: Number,
    required: [true, 'El precio unitario es requerido'],
    min: [0, 'El precio unitario no puede ser negativo']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'El descuento no puede ser negativo']
  },
  subtotal: {
    type: Number,
    required: [true, 'El subtotal es requerido'],
    min: [0, 'El subtotal no puede ser negativo']
  }
});

// Esquema base para las transacciones
const TransactionSchema: Schema = new Schema(
  {
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: [true, 'El tipo de transacción es requerido']
    },
    correlative: {
      type: Number,
      required: [true, 'El correlativo es requerido']
    },
    documentType: {
      type: String,
      enum: Object.values(DocumentType),
      required: [true, 'El tipo de documento es requerido']
    },
    documentNumber: {
      type: String,
      required: [true, 'El número de documento es requerido'],
      unique: true
    },
    date: {
      type: Date,
      required: [true, 'La fecha es requerida'],
      default: Date.now
    },
    counterparty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact', // Referencia al modelo Contact para clientes y proveedores
      required: [true, 'La contraparte es requerida']
    },
    items: [TransactionItemSchema],
    taxRate: {
      type: Number,
      default: 0.19 // Tasa de IVA por defecto en Chile
    },
    netAmount: {
      type: Number,
      required: [true, 'El monto neto es requerido'],
      min: [0, 'El monto neto no puede ser negativo']
    },
    taxAmount: {
      type: Number,
      required: [true, 'El monto de impuesto es requerido'],
      min: [0, 'El monto de impuesto no puede ser negativo']
    },
    totalAmount: {
      type: Number,
      required: [true, 'El monto total es requerido'],
      min: [0, 'El monto total no puede ser negativo']
    },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      required: [true, 'El estado es requerido'],
      default: TransactionStatus.PENDING
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El usuario es requerido']
    },
    relatedQuotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      validate: {
        validator: function (this: ITransaction, value: any) {
          return this.type !== TransactionType.QUOTATION || !value;
        },
        message: 'Las cotizaciones no pueden tener una cotización relacionada'
      }
    },
    observations: {
      type: String,
      maxlength: [500, 'Las observaciones no pueden exceder los 500 caracteres']
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    discriminatorKey: 'type'
  }
);

// Índices para consultas eficientes
TransactionSchema.index({ type: 1, correlative: 1 });
TransactionSchema.index({ documentNumber: 1 }, { unique: true });
TransactionSchema.index({ counterparty: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ user: 1 });
TransactionSchema.index({ isDeleted: 1 });
TransactionSchema.index({ createdAt: -1 });

// Crear y exportar el modelo
const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);

export default Transaction; 