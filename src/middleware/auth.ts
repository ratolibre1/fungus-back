import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Clave secreta para JWT
const JWT_SECRET = process.env.JWT_SECRET || 'fungus_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '5d';

// Extender el tipo Request de Express para incluir la propiedad user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

/**
 * Middleware para proteger rutas - verifica el token JWT
 */
export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let token;

  // Verificar si existe el token en los headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Extraer el token (formato: Bearer TOKEN)
      token = req.headers.authorization.split(' ')[1];

      // Verificar el token
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string };

      // Buscar el usuario por ID y añadirlo a la request
      const user = await User.findById(decoded.id);

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Usuario no encontrado'
        });
        return;
      }

      req.user = user;
      next();
      return;
    } catch (error) {
      console.error('Error al autenticar token:', error);
      res.status(401).json({
        success: false,
        message: 'No autorizado, token inválido'
      });
      return;
    }
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'No autorizado, no se proporcionó token'
    });
    return;
  }
};

/**
 * Middleware para verificar el rol de usuario
 * @param roles Roles permitidos
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autorizado, usuario no existe'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `El rol ${req.user.role} no está autorizado para acceder a este recurso`
      });
      return;
    }

    next();
  };
};

/**
 * Función para generar un token JWT
 * @param id ID del usuario
 */
export const generateToken = (id: string): string => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
  });
}; 