import mongoose, { Schema, Document } from 'mongoose';
import { IContact } from './Client';
import { IItem } from './Item';
import { IUser } from './User';
import { IQuotation } from './Quotation';

export enum DocumentType {
  INVOICE = 'factura',
  RECEIPT = 'boleta'
}

export interface ISaleItem {
  product: mongoose.Types.ObjectId | IItem;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

export interface ISale extends Document {
  correlative: number;
  documentType: DocumentType;
  documentNumber: number;
  date: Date;
  client: mongoose.Types.ObjectId | IContact;
  items: ISaleItem[];
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  quotationRef?: mongoose.Types.ObjectId | IQuotation;
  seller: mongoose.Types.ObjectId | IUser;
  observations: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SaleItemSchema = new Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: [true, 'El producto es obligatorio']
  },
  quantity: {
    type: Number,
    required: [true, 'La cantidad es obligatoria'],
    min: [1, 'La cantidad debe ser al menos 1']
  },
  unitPrice: {
    type: Number,
    required: [true, 'El precio unitario es obligatorio'],
    min: [0, 'El precio no puede ser negativo']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'El descuento no puede ser negativo']
  },
  subtotal: {
    type: Number,
    required: [true, 'El subtotal es obligatorio']
  }
});

const SaleSchema: Schema = new Schema(
  {
    correlative: {
      type: Number,
      required: [true, 'El correlativo es obligatorio'],
      unique: true
    },
    documentType: {
      type: String,
      enum: Object.values(DocumentType),
      required: [true, 'El tipo de documento es obligatorio']
    },
    documentNumber: {
      type: Number,
      required: [true, 'El número de documento es obligatorio']
    },
    date: {
      type: Date,
      default: Date.now
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: [true, 'El cliente es obligatorio']
    },
    items: [SaleItemSchema],
    netAmount: {
      type: Number,
      required: [true, 'El monto neto es obligatorio']
    },
    taxAmount: {
      type: Number,
      required: [true, 'El monto de impuesto es obligatorio']
    },
    totalAmount: {
      type: Number,
      required: [true, 'El monto total es obligatorio']
    },
    quotationRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quotation',
      required: false
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El vendedor es obligatorio']
    },
    observations: {
      type: String,
      default: ''
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Índices para búsquedas rápidas
SaleSchema.index({ documentType: 1, documentNumber: 1 });
SaleSchema.index({ date: 1 });
SaleSchema.index({ client: 1 });
SaleSchema.index({ seller: 1 });
SaleSchema.index({ quotationRef: 1 });

export default mongoose.model<ISale>('Sale', SaleSchema); 