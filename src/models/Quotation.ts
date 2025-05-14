import mongoose, { Schema, Document } from 'mongoose';
import { IContact } from './Client';
import { IItem } from './Item';
import { IUser } from './User';

export enum QuotationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CONVERTED = 'converted'
}

export interface IQuotationItem {
  product: mongoose.Types.ObjectId | IItem;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

export interface IQuotation extends Document {
  correlative: number;
  date: Date;
  client: mongoose.Types.ObjectId | IContact;
  items: IQuotationItem[];
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: QuotationStatus;
  seller: mongoose.Types.ObjectId | IUser;
  observations: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QuotationItemSchema = new Schema({
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

const QuotationSchema: Schema = new Schema(
  {
    correlative: {
      type: Number,
      required: [true, 'El correlativo es obligatorio'],
      unique: true
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
    items: [QuotationItemSchema],
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
    status: {
      type: String,
      enum: Object.values(QuotationStatus),
      default: QuotationStatus.PENDING
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
QuotationSchema.index({ date: 1 });
QuotationSchema.index({ client: 1 });
QuotationSchema.index({ status: 1 });
QuotationSchema.index({ seller: 1 });

export default mongoose.model<IQuotation>('Quotation', QuotationSchema); 