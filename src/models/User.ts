import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

// Interfaz para el documento de Usuario
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Esquema de Usuario
const UserSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Por favor ingresa tu nombre'],
      trim: true,
      maxlength: [50, 'El nombre no puede tener más de 50 caracteres']
    },
    email: {
      type: String,
      required: [true, 'Por favor ingresa tu email'],
      unique: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Por favor ingresa un email válido'
      ]
    },
    password: {
      type: String,
      required: [true, 'Por favor ingresa tu contraseña'],
      minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
      select: false // No incluir por defecto en las consultas
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    }
  },
  {
    timestamps: true
  }
);

// Encriptar contraseña antes de guardar
UserSchema.pre<IUser>('save', async function (next) {
  // Solo hash la contraseña si ha sido modificada (o es nueva)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Generar un salt
    const salt = await bcrypt.genSalt(10);
    // Hash la contraseña con el salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Método para comparar contraseñas
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

export default mongoose.model<IUser>('User', UserSchema); 