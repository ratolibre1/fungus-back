import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from './User';

// Tipos de operaciones que registraremos
export enum LogOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}

// Colecciones que monitoreamos
export enum LogCollectionType {
  PRODUCT = 'product',
  CONSUMABLE = 'consumable',
  CONTACT = 'contact',
  QUOTATION = 'quotation',
  SALE = 'sale',
  PURCHASE = 'purchase'
}

export interface ILog extends Document {
  operation: string;
  collectionType: string;
  documentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  details?: any;
  createdAt: Date;
}

const LogSchema: Schema = new Schema(
  {
    operation: {
      type: String,
      enum: Object.values(LogOperation),
      required: true
    },
    collectionType: {
      type: String,
      enum: Object.values(LogCollectionType),
      required: true
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    details: {
      type: mongoose.Schema.Types.Mixed, // Puede almacenar cualquier tipo de datos
      required: false
    }
  },
  {
    timestamps: true
  }
);

// Índices para consultas rápidas
LogSchema.index({ operation: 1, collectionType: 1 });
LogSchema.index({ documentId: 1 });
LogSchema.index({ userId: 1 });
LogSchema.index({ createdAt: -1 });

export default mongoose.model<ILog>('Log', LogSchema); 