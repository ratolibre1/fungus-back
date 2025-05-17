import { Request, Response } from 'express';
import User, { IUser } from '../models/User';
import { generateToken } from '../middleware/auth';
import { Document } from 'mongoose';
import bcrypt from 'bcrypt';

/**
 * @desc    Registrar un nuevo usuario
 * @route   POST /api/users/register
 * @access  Public
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  console.log('Request body:', req.body);

  try {
    const { name, email, password, isDefaultPassword } = req.body;

    // Verificar si ya existe el usuario
    const userExists = await User.findOne({ email });

    if (userExists) {
      res.status(400).json({
        success: false,
        message: 'Este correo ya está registrado'
      });
      return;
    }

    // Crear el usuario
    const user = await User.create({
      name,
      email,
      password,
      isDefaultPassword: true
    });

    if (user) {
      const userId = (user as unknown as { _id: { toString(): string } })._id.toString();
      res.status(201).json({
        success: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isDefaultPassword: user.isDefaultPassword
        },
        token: generateToken(userId)
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Datos de usuario inválidos'
      });
    }
  } catch (error: any) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error en el servidor'
    });
  }
};

/**
 * @desc    Autenticar usuario y obtener token
 * @route   POST /api/users/login
 * @access  Public
 */
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Verificar email y contraseña
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Por favor proporciona email y contraseña'
      });
      return;
    }

    // Buscar usuario por email
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Email o contraseña incorrectos'
      });
      return;
    }

    // Verificar si es contraseña por defecto (123456)
    if (user.isDefaultPassword && password === '123456') {
      // Si es la contraseña por defecto, permitir el login pero indicar que debe cambiarla
      const userId = (user as unknown as { _id: { toString(): string } })._id.toString();
      res.status(200).json({
        success: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isDefaultPassword: true
        },
        token: generateToken(userId),
        passwordChangeRequired: true
      });
      return;
    }

    // Verificar contraseña normal
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Email o contraseña incorrectos'
      });
      return;
    }

    // Generar token
    const userId = (user as unknown as { _id: { toString(): string } })._id.toString();
    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isDefaultPassword: user.isDefaultPassword
      },
      token: generateToken(userId)
    });
  } catch (error: any) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error en el servidor'
    });
  }
};

/**
 * @desc    Cambiar contraseña después del primer login
 * @route   POST /api/users/change-password
 * @access  Private
 */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { newPassword } = req.body;
    const user = req.user;

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
      return;
    }

    // Actualizar contraseña y quitar flag de contraseña por defecto
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(
      user._id,
      {
        password: hashedPassword,
        isDefaultPassword: false
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Contraseña actualizada correctamente'
    });
  } catch (error: any) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error en el servidor'
    });
  }
};

/**
 * @desc    Resetear contraseña de un usuario (solo para admin)
 * @route   POST /api/users/reset-password
 * @access  Private/Admin
 */
export const resetUserPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const adminUser = req.user;

    // Verificar que sea un administrador
    if (adminUser?.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'No tienes permisos para realizar esta acción'
      });
      return;
    }

    // Buscar el usuario por email
    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    // Establecer contraseña por defecto (123456)
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash('123456', salt);

    await User.findByIdAndUpdate(
      user._id,
      {
        password: defaultPassword,
        isDefaultPassword: true
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: `Contraseña de ${user.email} restablecida correctamente`
    });
  } catch (error: any) {
    console.error('Error al resetear contraseña:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error en el servidor'
    });
  }
};

/**
 * @desc    Obtener perfil del usuario actual
 * @route   GET /api/users/me
 * @access  Private
 */
export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isDefaultPassword: user.isDefaultPassword,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error: any) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error en el servidor'
    });
  }
}; 