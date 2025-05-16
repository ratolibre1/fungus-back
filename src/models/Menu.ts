import mongoose, { Schema, Document } from 'mongoose';

// Interfaces para el nuevo modelo de menú
export interface IMenuItem extends Document {
  name: string;
  type: 'group' | 'link';
  label: string;
  icon?: string;
  path?: string;
  roles: string[];
  isActive: boolean;
  order: number;
  children?: IMenuItem[];
}

// Esquema para elementos del menú (items y children)
const MenuItemSchema = new Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: ['group', 'link']
  },
  label: { type: String, required: true },
  icon: { type: String },
  path: { type: String },
  roles: {
    type: [String],
    required: true,
    default: ['admin']
  },
  isActive: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  children: { type: [Schema.Types.Mixed], default: undefined }
});

// Esquema del menú
const MenuSchema = new Schema(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['group', 'link']
    },
    label: { type: String, required: true },
    icon: { type: String },
    path: { type: String },
    roles: {
      type: [String],
      required: true,
      default: ['admin']
    },
    isActive: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    children: { type: [Schema.Types.Mixed], default: undefined }
  },
  {
    timestamps: true
  }
);

// Método para validar la estructura recursiva
MenuSchema.pre('save', function (next) {
  const validateItem = (item: any): boolean => {
    // Validar propiedades base
    if (!item.name || !item.type || !item.label || !Array.isArray(item.roles)) {
      return false;
    }

    // Validar propiedades específicas por tipo
    if (item.type === 'link' && !item.path) {
      return false;
    }

    // Si es un grupo, validar recursivamente los hijos (si existen)
    if (item.type === 'group' && item.children && Array.isArray(item.children)) {
      return item.children.every((child: any) => validateItem(child));
    }

    return true;
  };

  // Validar el menú
  if (!validateItem(this)) {
    return next(new Error('La estructura del menú es inválida'));
  }

  next();
});

// Índices para consultas rápidas
MenuSchema.index({ name: 1 });
MenuSchema.index({ type: 1 });

export default mongoose.model<IMenuItem>('Menu', MenuSchema); 