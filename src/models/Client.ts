import mongoose, { Schema, Document } from 'mongoose';

export interface IContact extends Document {
  name: string;
  rut: string;
  email?: string;
  phone?: string;
  address?: string;
  isCustomer: boolean;
  isSupplier: boolean;
  isDeleted: boolean;
  needsReview: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Función para validar formato y dígito verificador de RUT chileno
const validateRut = (rut: string): boolean => {
  // Eliminar puntos y guiones
  let cleanRut = rut.replace(/[.-]/g, '');

  // Separar cuerpo y dígito verificador
  let body = cleanRut.slice(0, -1);
  let dv = cleanRut.slice(-1).toUpperCase();

  // Comprobar formato básico
  if (!/^\d{7,8}[0-9K]$/i.test(cleanRut)) {
    return false;
  }

  // Calcular dígito verificador
  let sum = 0;
  let multiplier = 2;

  // Suma ponderada
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body.charAt(i)) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  // Calcular dígito esperado
  let expectedDV = 11 - (sum % 11);
  let calculatedDV: string;

  if (expectedDV === 11) {
    calculatedDV = '0';
  } else if (expectedDV === 10) {
    calculatedDV = 'K';
  } else {
    calculatedDV = expectedDV.toString();
  }

  // Comparar dígito calculado con el entregado
  return calculatedDV === dv;
};

// Función para normalizar formato de RUT
const normalizeRut = function (this: IContact) {
  if (this.rut) {
    // Eliminar puntos y guión
    let cleanRut = this.rut.replace(/[.-]/g, '');

    // Separar cuerpo y dígito verificador
    let body = cleanRut.slice(0, -1);
    let dv = cleanRut.slice(-1).toUpperCase();

    // Formatear como 12345678-9
    this.rut = body + '-' + dv;
  }
};

const ContactSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre del contacto es obligatorio'],
      trim: true,
      maxlength: [100, 'El nombre no puede tener más de 100 caracteres']
    },
    rut: {
      type: String,
      required: [true, 'El RUT es obligatorio'],
      trim: true,
      validate: {
        validator: validateRut,
        message: 'El RUT no es válido. Verifique el formato y dígito verificador'
      }
    },
    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Por favor ingrese un email válido'
      ]
    },
    phone: {
      type: String,
      required: false,
      trim: true
    },
    address: {
      type: String,
      required: false,
      trim: true
    },
    isCustomer: {
      type: Boolean,
      default: false
    },
    isSupplier: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    needsReview: {
      type: Boolean,
      default: false,
      description: 'Indica si los datos fueron importados y necesitan ser revisados por un usuario'
    }
  },
  {
    timestamps: true
  }
);

// Middleware pre-save para normalizar RUT
ContactSchema.pre('save', normalizeRut);

// Middleware para normalizar RUT antes de actualizar
ContactSchema.pre('findOneAndUpdate', function (this: any) {
  const update = this.getUpdate() as any;

  // Solo proceder si se está actualizando el rut
  if (update && update.rut) {
    // Eliminar puntos y guión
    let cleanRut = update.rut.replace(/[.-]/g, '');

    // Separar cuerpo y dígito verificador
    let body = cleanRut.slice(0, -1);
    let dv = cleanRut.slice(-1).toUpperCase();

    // Formatear como 12345678-9
    update.rut = body + '-' + dv;
  }
});

// Índices para búsquedas rápidas
ContactSchema.index({ email: 1 });
ContactSchema.index({ name: 'text' }); // Para búsquedas de texto
ContactSchema.index({ isCustomer: 1 });
ContactSchema.index({ isSupplier: 1 });
ContactSchema.index({ needsReview: 1 }); // Para filtrar contactos que necesitan revisión

export default mongoose.model<IContact>('Contact', ContactSchema); 