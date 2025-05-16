import mongoose, { Schema, Document } from 'mongoose';

export interface IModule extends Document {
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  path: string;
  isActive: boolean;
  isVisible: boolean;
  order: number;
  allowedRoles: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ModuleSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre del módulo es obligatorio'],
      unique: true,
      trim: true
    },
    displayName: {
      type: String,
      required: [true, 'El nombre de visualización es obligatorio'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    icon: {
      type: String,
      trim: true
    },
    path: {
      type: String,
      required: [true, 'La ruta del módulo es obligatoria'],
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isVisible: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      default: 0
    },
    allowedRoles: {
      type: [String],
      default: ['admin']
    }
  },
  {
    timestamps: true
  }
);

// Índices para consultas rápidas
ModuleSchema.index({ name: 1 });
ModuleSchema.index({ isActive: 1, isVisible: 1 });
ModuleSchema.index({ order: 1 });

export default mongoose.model<IModule>('Module', ModuleSchema); 