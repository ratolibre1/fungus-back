import mongoose, { Schema, Document } from 'mongoose';
import { IContact } from './Client';
import { IUser } from './User';

export enum PurchaseDocumentType {
  INVOICE = 'factura',
  RECEIPT = 'boleta'
}

export interface IPurchaseItem {
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface IPurchase extends Document {
  number: number;
  documentType: PurchaseDocumentType;
  documentNumber: string;
  supplier: mongoose.Types.ObjectId | IContact;
  date: Date;
  description: string;
  items: IPurchaseItem[];
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  user: mongoose.Types.ObjectId | IUser;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseItemSchema = new Schema({
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
  subtotal: {
    type: Number,
    required: [true, 'El subtotal es obligatorio']
  }
});

const PurchaseSchema: Schema = new Schema(
  {
    number: {
      type: Number,
      required: [true, 'El número es obligatorio'],
      unique: true
    },
    documentType: {
      type: String,
      enum: Object.values(PurchaseDocumentType),
      required: [true, 'El tipo de documento es obligatorio']
    },
    documentNumber: {
      type: String,
      required: [true, 'El número de documento es obligatorio'],
      trim: true
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: [true, 'El proveedor es obligatorio']
    },
    date: {
      type: Date,
      default: Date.now
    },
    description: {
      type: String,
      required: [true, 'La descripción es obligatoria'],
      trim: true
    },
    items: [PurchaseItemSchema],
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
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El usuario es obligatorio']
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
PurchaseSchema.index({ documentType: 1, documentNumber: 1 });
PurchaseSchema.index({ date: 1 });
PurchaseSchema.index({ supplier: 1 });

export default mongoose.model<IPurchase>('Purchase', PurchaseSchema); 