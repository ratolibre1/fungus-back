import { Request, Response } from 'express';
import User, { IUser } from '../models/User';
import { generateToken } from '../middleware/auth';
import { Document } from 'mongoose';

/**
 * @desc    Registrar un nuevo usuario
 * @route   POST /api/users/register
 * @access  Public
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  console.log('Request body:', req.body);

  try {
    const { name, email, password } = req.body;

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
      password
    });

    if (user) {
      const userId = (user as unknown as { _id: { toString(): string } })._id.toString();
      res.status(201).json({
        success: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
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

    // Verificar contraseña
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
        role: user.role
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