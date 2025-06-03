import mongoose from 'mongoose';
import Log, { LogOperation, LogCollectionType } from '../models/Log';
import Contact from '../models/Client';

/**
 * Helper function para obtener información básica de una contraparte
 */
const getCounterpartyInfo = async (counterpartyId: string | mongoose.Types.ObjectId) => {
  try {
    const contact = await Contact.findById(counterpartyId).select('name rut email isCustomer isSupplier');
    if (contact) {
      return {
        id: contact._id,
        name: contact.name,
        rut: contact.rut,
        email: contact.email,
        isCustomer: contact.isCustomer,
        isSupplier: contact.isSupplier
      };
    }
    return { id: counterpartyId, name: 'N/A' };
  } catch (error) {
    console.error('Error obteniendo info de contraparte:', error);
    return { id: counterpartyId, name: 'Error al obtener' };
  }
};

/**
 * Helper function para crear logs enriquecidos de transacciones
 */
const createTransactionLog = async (
  operation: LogOperation,
  collectionType: LogCollectionType,
  documentId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string,
  transactionData: {
    documentNumber: string;
    documentType?: string;
    counterpartyId?: string | mongoose.Types.ObjectId;
    totalAmount?: number;
    netAmount?: number;
    taxAmount?: number;
    itemsCount?: number;
    status?: string;
    operationType?: string;
    additionalData?: any;
  }
) => {
  try {
    // Obtener información de la contraparte si está disponible
    let counterpartyInfo = null;
    if (transactionData.counterpartyId) {
      counterpartyInfo = await getCounterpartyInfo(transactionData.counterpartyId);
    }

    const enrichedDetails = {
      documentNumber: transactionData.documentNumber,
      operationType: transactionData.operationType || operation.toUpperCase(),
      transactionInfo: {
        ...(transactionData.documentType && { documentType: transactionData.documentType }),
        ...(counterpartyInfo && { counterparty: counterpartyInfo }),
        ...(transactionData.totalAmount !== undefined && { totalAmount: transactionData.totalAmount }),
        ...(transactionData.netAmount !== undefined && { netAmount: transactionData.netAmount }),
        ...(transactionData.taxAmount !== undefined && { taxAmount: transactionData.taxAmount }),
        ...(transactionData.itemsCount !== undefined && { itemsCount: transactionData.itemsCount }),
        ...(transactionData.status && { status: transactionData.status })
      },
      timestamp: new Date().toISOString(),
      ...transactionData.additionalData
    };

    return await logService.createLog(
      operation,
      collectionType,
      documentId,
      userId,
      enrichedDetails
    );
  } catch (error) {
    console.error('Error creando log enriquecido:', error);
    // Fallback a log básico
    return await logService.createLog(
      operation,
      collectionType,
      documentId,
      userId,
      { documentNumber: transactionData.documentNumber }
    );
  }
};

/**
 * Helper function para crear logs enriquecidos específicos para contactos
 */
const createContactLog = async (
  operation: LogOperation,
  contactId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string,
  contactData: {
    name: string;
    rut: string;
    email?: string;
    phone?: string;
    address?: string;
    isCustomer?: boolean;
    isSupplier?: boolean;
    needsReview?: boolean;
    operationType?: string;
    additionalData?: any;
  }
) => {
  try {
    const enrichedDetails = {
      contactName: contactData.name,
      contactRut: contactData.rut,
      operationType: contactData.operationType || operation.toUpperCase(),
      contactInfo: {
        name: contactData.name,
        rut: contactData.rut,
        ...(contactData.email && { email: contactData.email }),
        ...(contactData.phone && { phone: contactData.phone }),
        ...(contactData.address && { address: contactData.address }),
        roles: {
          isCustomer: !!contactData.isCustomer,
          isSupplier: !!contactData.isSupplier
        },
        ...(contactData.needsReview !== undefined && { needsReview: contactData.needsReview })
      },
      timestamp: new Date().toISOString(),
      ...contactData.additionalData
    };

    return await logService.createLog(
      operation,
      LogCollectionType.CONTACT,
      contactId,
      userId,
      enrichedDetails
    );
  } catch (error) {
    console.error('Error creando log enriquecido de contacto:', error);
    // Fallback a log básico
    return await logService.createLog(
      operation,
      LogCollectionType.CONTACT,
      contactId,
      userId,
      { contactName: contactData.name, contactRut: contactData.rut }
    );
  }
};

/**
 * Helper function para logs de cambios en contactos con detalles de qué cambió
 */
const createContactChangeLog = async (
  contactId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string,
  changes: any,
  previousContact: {
    name: string;
    rut: string;
    email?: string;
    phone?: string;
    address?: string;
    isCustomer: boolean;
    isSupplier: boolean;
    needsReview?: boolean;
  },
  currentContact: {
    name: string;
    rut: string;
    email?: string;
    phone?: string;
    address?: string;
    isCustomer: boolean;
    isSupplier: boolean;
    needsReview?: boolean;
  }
) => {
  try {
    // Detectar qué campos cambiaron específicamente
    const fieldChanges: any = {};

    if (changes.name && changes.name !== previousContact.name) {
      fieldChanges.name = { from: previousContact.name, to: changes.name };
    }
    if (changes.rut && changes.rut !== previousContact.rut) {
      fieldChanges.rut = { from: previousContact.rut, to: changes.rut };
    }
    if (changes.email !== undefined && changes.email !== previousContact.email) {
      fieldChanges.email = { from: previousContact.email || null, to: changes.email || null };
    }
    if (changes.phone !== undefined && changes.phone !== previousContact.phone) {
      fieldChanges.phone = { from: previousContact.phone || null, to: changes.phone || null };
    }
    if (changes.address !== undefined && changes.address !== previousContact.address) {
      fieldChanges.address = { from: previousContact.address || null, to: changes.address || null };
    }

    // Cambios en roles
    if (changes.isCustomer !== undefined && changes.isCustomer !== previousContact.isCustomer) {
      fieldChanges.isCustomer = { from: previousContact.isCustomer, to: changes.isCustomer };
    }
    if (changes.isSupplier !== undefined && changes.isSupplier !== previousContact.isSupplier) {
      fieldChanges.isSupplier = { from: previousContact.isSupplier, to: changes.isSupplier };
    }

    // Cambio en estado de revisión
    if (changes.needsReview !== undefined && changes.needsReview !== previousContact.needsReview) {
      fieldChanges.needsReview = { from: previousContact.needsReview, to: changes.needsReview };
    }

    const enrichedDetails = {
      contactName: currentContact.name,
      contactRut: currentContact.rut,
      operationType: 'UPDATE',
      changes: fieldChanges,
      previousValues: {
        name: previousContact.name,
        rut: previousContact.rut,
        email: previousContact.email,
        phone: previousContact.phone,
        address: previousContact.address,
        roles: {
          isCustomer: previousContact.isCustomer,
          isSupplier: previousContact.isSupplier
        },
        needsReview: previousContact.needsReview
      },
      currentValues: {
        name: currentContact.name,
        rut: currentContact.rut,
        email: currentContact.email,
        phone: currentContact.phone,
        address: currentContact.address,
        roles: {
          isCustomer: currentContact.isCustomer,
          isSupplier: currentContact.isSupplier
        },
        needsReview: currentContact.needsReview
      },
      timestamp: new Date().toISOString()
    };

    return await logService.createLog(
      LogOperation.UPDATE,
      LogCollectionType.CONTACT,
      contactId,
      userId,
      enrichedDetails
    );
  } catch (error) {
    console.error('Error creando log de cambios de contacto:', error);
    // Fallback a log básico
    return await logService.createLog(
      LogOperation.UPDATE,
      LogCollectionType.CONTACT,
      contactId,
      userId,
      { contactName: currentContact.name, contactRut: currentContact.rut, changes }
    );
  }
};

/**
 * Helper function para logs de eliminación con snapshot completo
 */
const createContactDeletionLog = async (
  contactId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string,
  deletedContact: {
    name: string;
    rut: string;
    email?: string;
    phone?: string;
    address?: string;
    isCustomer: boolean;
    isSupplier: boolean;
    needsReview?: boolean;
    createdAt?: Date;
  },
  deletionType: 'full_deletion' | 'role_removal' | 'reactivation',
  additionalInfo?: any
) => {
  try {
    const enrichedDetails = {
      contactName: deletedContact.name,
      contactRut: deletedContact.rut,
      operationType: 'DELETE',
      deletionType,
      deletedData: {
        name: deletedContact.name,
        rut: deletedContact.rut,
        email: deletedContact.email,
        phone: deletedContact.phone,
        address: deletedContact.address,
        roles: {
          isCustomer: deletedContact.isCustomer,
          isSupplier: deletedContact.isSupplier
        },
        needsReview: deletedContact.needsReview,
        originalCreationDate: deletedContact.createdAt
      },
      timestamp: new Date().toISOString(),
      ...additionalInfo
    };

    return await logService.createLog(
      LogOperation.DELETE,
      LogCollectionType.CONTACT,
      contactId,
      userId,
      enrichedDetails
    );
  } catch (error) {
    console.error('Error creando log de eliminación de contacto:', error);
    // Fallback a log básico
    return await logService.createLog(
      LogOperation.DELETE,
      LogCollectionType.CONTACT,
      contactId,
      userId,
      { contactName: deletedContact.name, contactRut: deletedContact.rut, deletionType }
    );
  }
};

/**
 * Helper function para crear logs enriquecidos específicos para items (productos/consumibles)
 */
const createItemLog = async (
  operation: LogOperation,
  itemId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string,
  itemData: {
    name: string;
    description?: string;
    netPrice: number;
    dimensions?: string;
    stock: number | null;
    isInventoried: boolean;
    itemType: 'Product' | 'Consumable';
    operationType?: string;
    additionalData?: any;
  }
) => {
  try {
    const enrichedDetails = {
      itemName: itemData.name,
      itemType: itemData.itemType,
      operationType: itemData.operationType || operation.toUpperCase(),
      itemInfo: {
        name: itemData.name,
        ...(itemData.description && { description: itemData.description }),
        netPrice: itemData.netPrice,
        ...(itemData.dimensions && { dimensions: itemData.dimensions }),
        stock: itemData.stock,
        isInventoried: itemData.isInventoried,
        itemType: itemData.itemType
      },
      pricing: {
        netPrice: itemData.netPrice,
        currency: 'CLP' // Asumiendo pesos chilenos
      },
      inventory: {
        stock: itemData.stock,
        isInventoried: itemData.isInventoried,
        hasStock: itemData.stock !== null && itemData.stock > 0
      },
      timestamp: new Date().toISOString(),
      ...itemData.additionalData
    };

    const collectionType = itemData.itemType === 'Product'
      ? LogCollectionType.PRODUCT
      : LogCollectionType.CONSUMABLE;

    return await logService.createLog(
      operation,
      collectionType,
      itemId,
      userId,
      enrichedDetails
    );
  } catch (error) {
    console.error('Error creando log enriquecido de item:', error);
    // Fallback a log básico
    const collectionType = itemData.itemType === 'Product'
      ? LogCollectionType.PRODUCT
      : LogCollectionType.CONSUMABLE;

    return await logService.createLog(
      operation,
      collectionType,
      itemId,
      userId,
      { itemName: itemData.name, itemType: itemData.itemType }
    );
  }
};

/**
 * Helper function para logs de cambios en items con detalles de qué cambió
 */
const createItemChangeLog = async (
  itemId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string,
  changes: any,
  previousItem: {
    name: string;
    description?: string;
    netPrice: number;
    dimensions?: string;
    stock: number | null;
    isInventoried: boolean;
    itemType: 'Product' | 'Consumable';
  },
  currentItem: {
    name: string;
    description?: string;
    netPrice: number;
    dimensions?: string;
    stock: number | null;
    isInventoried: boolean;
    itemType: 'Product' | 'Consumable';
  }
) => {
  try {
    // Detectar qué campos cambiaron específicamente
    const fieldChanges: any = {};

    if (changes.name && changes.name !== previousItem.name) {
      fieldChanges.name = { from: previousItem.name, to: changes.name };
    }
    if (changes.description !== undefined && changes.description !== previousItem.description) {
      fieldChanges.description = { from: previousItem.description || null, to: changes.description || null };
    }
    if (changes.netPrice !== undefined && changes.netPrice !== previousItem.netPrice) {
      fieldChanges.netPrice = {
        from: previousItem.netPrice,
        to: changes.netPrice,
        percentageChange: ((changes.netPrice - previousItem.netPrice) / previousItem.netPrice * 100).toFixed(2) + '%'
      };
    }
    if (changes.dimensions !== undefined && changes.dimensions !== previousItem.dimensions) {
      fieldChanges.dimensions = { from: previousItem.dimensions || null, to: changes.dimensions || null };
    }
    if (changes.stock !== undefined && changes.stock !== previousItem.stock) {
      fieldChanges.stock = {
        from: previousItem.stock,
        to: changes.stock,
        stockDifference: changes.stock !== null && previousItem.stock !== null
          ? changes.stock - previousItem.stock
          : null
      };
    }
    if (changes.isInventoried !== undefined && changes.isInventoried !== previousItem.isInventoried) {
      fieldChanges.isInventoried = { from: previousItem.isInventoried, to: changes.isInventoried };
    }

    const enrichedDetails = {
      itemName: currentItem.name,
      itemType: currentItem.itemType,
      operationType: 'UPDATE',
      changes: fieldChanges,
      previousValues: {
        name: previousItem.name,
        description: previousItem.description,
        netPrice: previousItem.netPrice,
        dimensions: previousItem.dimensions,
        stock: previousItem.stock,
        isInventoried: previousItem.isInventoried
      },
      currentValues: {
        name: currentItem.name,
        description: currentItem.description,
        netPrice: currentItem.netPrice,
        dimensions: currentItem.dimensions,
        stock: currentItem.stock,
        isInventoried: currentItem.isInventoried
      },
      priceImpact: changes.netPrice !== undefined ? {
        oldPrice: previousItem.netPrice,
        newPrice: changes.netPrice,
        difference: changes.netPrice - previousItem.netPrice,
        percentageChange: ((changes.netPrice - previousItem.netPrice) / previousItem.netPrice * 100).toFixed(2) + '%'
      } : null,
      stockImpact: changes.stock !== undefined ? {
        oldStock: previousItem.stock,
        newStock: changes.stock,
        difference: changes.stock !== null && previousItem.stock !== null
          ? changes.stock - previousItem.stock
          : null,
        becameInventoried: !previousItem.isInventoried && changes.isInventoried,
        becameNonInventoried: previousItem.isInventoried && !changes.isInventoried
      } : null,
      timestamp: new Date().toISOString()
    };

    const collectionType = currentItem.itemType === 'Product'
      ? LogCollectionType.PRODUCT
      : LogCollectionType.CONSUMABLE;

    return await logService.createLog(
      LogOperation.UPDATE,
      collectionType,
      itemId,
      userId,
      enrichedDetails
    );
  } catch (error) {
    console.error('Error creando log de cambios de item:', error);
    // Fallback a log básico
    const collectionType = currentItem.itemType === 'Product'
      ? LogCollectionType.PRODUCT
      : LogCollectionType.CONSUMABLE;

    return await logService.createLog(
      LogOperation.UPDATE,
      collectionType,
      itemId,
      userId,
      { itemName: currentItem.name, itemType: currentItem.itemType, changes }
    );
  }
};

/**
 * Helper function para logs de eliminación de items con snapshot completo
 */
const createItemDeletionLog = async (
  itemId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string,
  deletedItem: {
    name: string;
    description?: string;
    netPrice: number;
    dimensions?: string;
    stock: number | null;
    isInventoried: boolean;
    itemType: 'Product' | 'Consumable';
    createdAt?: Date;
  },
  additionalInfo?: any
) => {
  try {
    const enrichedDetails = {
      itemName: deletedItem.name,
      itemType: deletedItem.itemType,
      operationType: 'DELETE',
      deletedData: {
        name: deletedItem.name,
        description: deletedItem.description,
        netPrice: deletedItem.netPrice,
        dimensions: deletedItem.dimensions,
        stock: deletedItem.stock,
        isInventoried: deletedItem.isInventoried,
        itemType: deletedItem.itemType,
        originalCreationDate: deletedItem.createdAt
      },
      financialImpact: {
        itemValue: deletedItem.netPrice,
        stockValue: deletedItem.stock !== null && deletedItem.stock > 0
          ? deletedItem.netPrice * deletedItem.stock
          : 0,
        hadStock: deletedItem.stock !== null && deletedItem.stock > 0,
        wasInventoried: deletedItem.isInventoried
      },
      timestamp: new Date().toISOString(),
      ...additionalInfo
    };

    const collectionType = deletedItem.itemType === 'Product'
      ? LogCollectionType.PRODUCT
      : LogCollectionType.CONSUMABLE;

    return await logService.createLog(
      LogOperation.DELETE,
      collectionType,
      itemId,
      userId,
      enrichedDetails
    );
  } catch (error) {
    console.error('Error creando log de eliminación de item:', error);
    // Fallback a log básico
    const collectionType = deletedItem.itemType === 'Product'
      ? LogCollectionType.PRODUCT
      : LogCollectionType.CONSUMABLE;

    return await logService.createLog(
      LogOperation.DELETE,
      collectionType,
      itemId,
      userId,
      { itemName: deletedItem.name, itemType: deletedItem.itemType }
    );
  }
};

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

  // Función helper para logs de transacciones enriquecidos
  createTransactionLog,

  // Funciones helper para logs de contactos enriquecidos
  createContactLog,
  createContactChangeLog,
  createContactDeletionLog,

  // Funciones helper para logs de items (productos/consumibles) enriquecidos
  createItemLog,
  createItemChangeLog,
  createItemDeletionLog,

  // Función helper para obtener info de contrapartes
  getCounterpartyInfo,

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