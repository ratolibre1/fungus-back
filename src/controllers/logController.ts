import { Request, Response } from 'express';
import logService from '../services/logService';
import { LogCollectionType, LogOperation } from '../models/Log';

/**
 * @desc    Obtener todos los logs con paginación y filtros
 * @route   GET /api/logs
 * @access  Private (admin)
 */
export const getLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extraer parámetros de consulta
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    // Construir objeto de filtros
    const filters: any = {};

    // Filtro por operación
    if (req.query.operation) {
      const operation = req.query.operation as string;
      if (Object.values(LogOperation).includes(operation as LogOperation)) {
        filters.operation = operation;
      } else {
        res.status(400).json({
          success: false,
          message: 'Tipo de operación inválido'
        });
        return;
      }
    }

    // Filtro por colección
    if (req.query.collection) {
      const collection = req.query.collection as string;
      if (Object.values(LogCollectionType).includes(collection as LogCollectionType)) {
        filters.collectionType = collection;
      } else {
        res.status(400).json({
          success: false,
          message: 'Tipo de colección inválido'
        });
        return;
      }
    }

    // Filtro por rango de fechas
    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string);
    }

    if (req.query.endDate) {
      // Ajustar la fecha de fin para incluir todo el día
      const endDate = new Date(req.query.endDate as string);
      endDate.setHours(23, 59, 59, 999);
      filters.endDate = endDate;
    }

    // Filtro por ID de documento
    if (req.query.documentId) {
      filters.documentId = req.query.documentId as string;
    }

    // Filtro por ID de usuario
    if (req.query.userId) {
      filters.userId = req.query.userId as string;
    }

    // Obtener logs paginados con filtros
    const result = await logService.getLogsPaginated(page, limit, filters);

    res.status(200).json({
      success: true,
      count: result.logs.length,
      pagination: result.pagination,
      data: result.logs
    });
  } catch (error: any) {
    console.error('Error al obtener logs:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener logs'
    });
  }
};

/**
 * @desc    Obtener un log específico por ID
 * @route   GET /api/logs/:id
 * @access  Private (admin)
 */
export const getLogById = async (req: Request, res: Response): Promise<void> => {
  try {
    const log = await logService.getLogById(req.params.id);

    if (!log) {
      res.status(404).json({
        success: false,
        message: 'Log no encontrado'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: log
    });
  } catch (error: any) {
    console.error('Error al obtener log:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener log'
    });
  }
};

/**
 * @desc    Eliminar un log
 * @route   DELETE /api/logs/:id
 * @access  Private (admin)
 */
export const deleteLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const log = await logService.deleteLog(req.params.id);

    if (!log) {
      res.status(404).json({
        success: false,
        message: 'Log no encontrado'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Log eliminado correctamente',
      data: log
    });
  } catch (error: any) {
    console.error('Error al eliminar log:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al eliminar log'
    });
  }
};

/**
 * @desc    Eliminar logs antiguos (por defecto logs más antiguos que 90 días)
 * @route   DELETE /api/logs/cleanup
 * @access  Private (admin)
 */
export const cleanupLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    // Permitir personalizar el período de retención
    let days = 90; // valor predeterminado

    if (req.query.days && !isNaN(parseInt(req.query.days as string))) {
      days = parseInt(req.query.days as string);
    }

    const olderThan = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const deletedCount = await logService.deleteOldLogs(olderThan);

    res.status(200).json({
      success: true,
      message: `Se eliminaron ${deletedCount} logs más antiguos que ${days} días.`
    });
  } catch (error: any) {
    console.error('Error al limpiar logs:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al limpiar logs'
    });
  }
}; 