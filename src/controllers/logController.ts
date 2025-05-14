import { Request, Response } from 'express';
import logService from '../services/logService';
import { LogCollectionType } from '../models/Log';

/**
 * @desc    Obtener todos los logs
 * @route   GET /api/logs
 * @access  Private (admin)
 */
export const getLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    // Si hay un filtro por colección
    if (req.query.collection) {
      const collection = req.query.collection as string;

      // Validar que sea una colección válida
      if (Object.values(LogCollectionType).includes(collection as LogCollectionType)) {
        const logs = await logService.getLogsByCollection(
          collection as LogCollectionType,
          limit
        );

        res.status(200).json({
          success: true,
          count: logs.length,
          data: logs
        });
        return;
      } else {
        res.status(400).json({
          success: false,
          message: 'Tipo de colección inválido'
        });
        return;
      }
    }

    // Si hay un filtro por documento
    if (req.query.document) {
      const documentId = req.query.document as string;
      const logs = await logService.getLogsByDocument(documentId);

      res.status(200).json({
        success: true,
        count: logs.length,
        data: logs
      });
      return;
    }

    // Si hay un filtro por usuario
    if (req.query.user) {
      const userId = req.query.user as string;
      const logs = await logService.getLogsByUser(userId, limit);

      res.status(200).json({
        success: true,
        count: logs.length,
        data: logs
      });
      return;
    }

    // Sin filtros, obtener todos los logs (con límite)
    const userId = req.user && req.user._id ? req.user._id.toString() : '';
    const logs = await logService.getLogsByUser(userId, limit);

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error: any) {
    console.error('Error al obtener logs:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener logs'
    });
  }
}; 