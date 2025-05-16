import mongoose from 'mongoose';
import Log, { LogOperation, LogCollectionType } from '../models/Log';

/**
 * Servicio para crear registros de logs
 */
export const logService = {
  /**
   * Crea un nuevo registro de log
   * @param operation Tipo de operación (create, update, delete)
   * @param collectionType Tipo de colección (product, consumable, client)
   * @param documentId ID del documento afectado
   * @param userId ID del usuario que realizó la operación
   * @param details Detalles adicionales (opcional)
   * @returns Promise con el log creado
   */
  createLog: async (
    operation: LogOperation,
    collectionType: LogCollectionType,
    documentId: mongoose.Types.ObjectId | string,
    userId: mongoose.Types.ObjectId | string,
    details?: any
  ) => {
    try {
      // Convertir IDs a ObjectId si son strings
      const docId = typeof documentId === 'string'
        ? new mongoose.Types.ObjectId(documentId)
        : documentId;

      const uId = typeof userId === 'string'
        ? new mongoose.Types.ObjectId(userId)
        : userId;

      const log = await Log.create({
        operation,
        collectionType,
        documentId: docId,
        userId: uId,
        details
      });

      console.log(`🔍 Log creado: ${operation} en ${collectionType} (ID: ${documentId})`);
      return log;
    } catch (error: any) {
      console.error('Error al crear log:', error.message);
      // No lanzamos el error para evitar interrumpir la operación principal
      return null;
    }
  },

  /**
   * Obtener logs por tipo de colección
   * @param collectionType Tipo de colección
   * @param limit Número máximo de logs a retornar
   * @returns Promise con los logs encontrados
   */
  getLogsByCollection: async (collectionType: LogCollectionType, limit = 100) => {
    return await Log.find({ collectionType })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('userId', 'name email');
  },

  /**
   * Obtener logs de un documento específico
   * @param documentId ID del documento
   * @returns Promise con los logs del documento
   */
  getLogsByDocument: async (documentId: string) => {
    return await Log.find({ documentId: new mongoose.Types.ObjectId(documentId) })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email');
  },

  /**
   * Obtener logs de un usuario específico
   * @param userId ID del usuario
   * @param limit Número máximo de logs a retornar
   * @returns Promise con los logs del usuario
   */
  getLogsByUser: async (userId: string, limit = 100) => {
    return await Log.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit);
  },

  /**
   * Obtener log por su ID
   * @param logId ID del log a obtener
   * @returns Promise con el log encontrado o null si no existe
   */
  getLogById: async (logId: string) => {
    return await Log.findById(logId).populate('userId', 'name email');
  },

  /**
   * Obtener logs paginados con filtros
   * @param page Número de página
   * @param limit Número de logs por página
   * @param filters Filtros a aplicar
   * @returns Promise con los logs y metadata de paginación
   */
  getLogsPaginated: async (
    page = 1,
    limit = 10,
    filters: {
      operation?: LogOperation;
      collectionType?: LogCollectionType;
      startDate?: Date;
      endDate?: Date;
      userId?: string;
      documentId?: string;
    } = {}
  ) => {
    const query: any = {};

    // Aplicar filtros si existen
    if (filters.operation) {
      query.operation = filters.operation;
    }

    if (filters.collectionType) {
      query.collectionType = filters.collectionType;
    }

    if (filters.userId) {
      query.userId = new mongoose.Types.ObjectId(filters.userId);
    }

    if (filters.documentId) {
      query.documentId = new mongoose.Types.ObjectId(filters.documentId);
    }

    // Filtro por rango de fechas
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};

      if (filters.startDate) {
        query.createdAt.$gte = filters.startDate;
      }

      if (filters.endDate) {
        query.createdAt.$lte = filters.endDate;
      }
    }

    // Calcular el skip para la paginación
    const skip = (page - 1) * limit;

    // Obtener el total de documentos para la paginación
    const total = await Log.countDocuments(query);

    // Obtener los logs paginados
    const logs = await Log.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email');

    // Calcular número total de páginas
    const totalPages = Math.ceil(total / limit);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  },

  /**
   * Eliminar logs por ID
   * @param logId ID del log a eliminar
   * @returns Promise con resultado de la operación
   */
  deleteLog: async (logId: string) => {
    return await Log.findByIdAndDelete(logId);
  },

  /**
   * Eliminar logs antiguos basados en una fecha límite
   * @param olderThan Fecha límite para eliminar logs (por defecto 90 días)
   * @returns Número de logs eliminados
   */
  deleteOldLogs: async (olderThan: Date = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) => {
    const result = await Log.deleteMany({ createdAt: { $lt: olderThan } });
    return result.deletedCount;
  }
};

export default logService; 