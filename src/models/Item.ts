import mongoose, { Schema, Document } from 'mongoose';

export interface IItem extends Document {
  name: string;
  description?: string;
  netPrice: number;
  dimensions?: string;
  stock: number | null;
  isInventoried: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Esquema base para Item
const ItemSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      maxlength: [100, 'El nombre no puede tener más de 100 caracteres']
    },
    description: {
      type: String,
      required: false,
      trim: true
    },
    netPrice: {
      type: Number,
      required: [true, 'El precio neto es obligatorio'],
      min: [0, 'El precio no puede ser negativo']
    },
    dimensions: {
      type: String,
      required: false,
      trim: true
    },
    stock: {
      type: Number,
      default: null,
      validate: {
        validator: function (value: number | null) {
          // Permitir null o números no negativos
          return value === null || value >= 0;
        },
        message: 'El stock no puede ser negativo'
      }
    },
    isInventoried: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    discriminatorKey: 'itemType' // Clave para discriminar entre tipos de items
  }
);

// Modelo base
const Item = mongoose.model<IItem>('Item', ItemSchema);

// Modelos derivados - ahora simplificados
export const Product = Item.discriminator(
  'Product',
  new Schema({
    // Campos específicos de productos si los necesitas en el futuro
  })
);

export const Consumable = Item.discriminator(
  'Consumable',
  new Schema({
    // Campos específicos de consumibles si los necesitas en el futuro
  })
);

export default Item; 