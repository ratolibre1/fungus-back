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
  }
};

export default logService; 