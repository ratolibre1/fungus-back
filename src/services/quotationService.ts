import mongoose, { Document } from 'mongoose';
import Quotation, { IQuotation } from '../models/Quotation';
import Transaction, { TransactionType, TransactionStatus } from '../models/Transaction';
import { LogOperation, LogCollectionType } from '../models/Log';
import logService from './logService';

/**
 * Función centralizada para calcular los montos de una transacción
 * considerando el tipo de documento (boleta vs factura)
 */
const calculateTransactionAmounts = (items: any[], documentType: string, taxRate: number = 0.19) => {
  if (!items || items.length === 0) {
    return {
      processedItems: [],
      netAmount: 0,
      taxAmount: 0,
      totalAmount: 0
    };
  }

  let processedItems;
  let netAmount = 0;
  let taxAmount = 0;
  let totalAmount = 0;

  if (documentType === 'boleta') {
    // BOLETA: Los precios incluyen IVA, trabajamos hacia atrás
    processedItems = items.map((item: any) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPriceWithIVA = parseFloat(item.unitPrice) || 0; // Precio con IVA incluido
      const discount = parseFloat(item.discount) || 0;

      // Calcular subtotal con IVA incluido
      const subtotalWithIVA = (quantity * unitPriceWithIVA) - discount;

      // Calcular precio unitario neto (sin IVA)
      const unitPriceNet = unitPriceWithIVA / (1 + taxRate);

      // Calcular subtotal neto
      const subtotalNet = (quantity * unitPriceNet) - (discount / (1 + taxRate));

      return {
        _id: new mongoose.Types.ObjectId(item.item),
        quantity,
        unitPrice: Math.round(unitPriceNet), // Guardamos el precio neto
        discount: Math.round(discount / (1 + taxRate)), // Descuento neto
        subtotal: Math.max(0, Math.round(subtotalNet))
      };
    });

    // Para boleta: netAmount es la suma de subtotales netos
    netAmount = processedItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);
    taxAmount = Math.round(netAmount * taxRate);
    totalAmount = netAmount + taxAmount;

  } else {
    // FACTURA: Los precios son netos, agregamos IVA
    processedItems = items.map((item: any) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0; // Precio neto
      const discount = parseFloat(item.discount) || 0; // Descuento neto
      const subtotal = (quantity * unitPrice) - discount;

      return {
        _id: new mongoose.Types.ObjectId(item.item),
        quantity,
        unitPrice,
        discount,
        subtotal: Math.max(0, subtotal)
      };
    });

    // Para factura: netAmount es la suma directa de subtotales
    netAmount = processedItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);
    taxAmount = Math.round(netAmount * taxRate);
    totalAmount = netAmount + taxAmount;
  }

  return {
    processedItems,
    netAmount: Math.round(netAmount),
    taxAmount,
    totalAmount
  };
};

/**
 * Preview de cálculo de cotización (sin guardar en BD)
 */
const previewQuotationCalculation = async (quotationData: any): Promise<any> => {
  try {
    // Validar que se proporcione documentType
    if (!quotationData.documentType) {
      throw new Error('El tipo de documento es requerido para el preview');
    }

    if (!['factura', 'boleta'].includes(quotationData.documentType)) {
      throw new Error('El tipo de documento debe ser "factura" o "boleta"');
    }

    // Validar que haya items
    if (!quotationData.items || quotationData.items.length === 0) {
      throw new Error('Se requieren items para el preview');
    }

    // Calcular los montos usando la función centralizada
    const taxRate = quotationData.taxRate || 0.19;
    const calculations = calculateTransactionAmounts(
      quotationData.items,
      quotationData.documentType,
      taxRate
    );

    return {
      items: calculations.processedItems,
      netAmount: calculations.netAmount,
      taxAmount: calculations.taxAmount,
      totalAmount: calculations.totalAmount,
      taxRate,
      documentType: quotationData.documentType
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Genera el siguiente número de documento para cotizaciones
 */
const generateNextDocumentNumber = async (): Promise<string> => {
  const lastTransaction = await Transaction.findOne({})
    .sort({ correlative: -1 })
    .limit(1);

  const nextCorrelative = lastTransaction ? lastTransaction.correlative + 1 : 1;
  // Formato: COT-0001, COT-0002, etc.
  return `COT-${nextCorrelative.toString().padStart(4, '0')}`;
};

/**
 * Crea una nueva cotización
 */
const createQuotation = async (quotationData: any, userId: string): Promise<IQuotation> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validar que se proporcione documentType
    if (!quotationData.documentType) {
      throw new Error('El tipo de documento es requerido');
    }

    if (!['factura', 'boleta'].includes(quotationData.documentType)) {
      throw new Error('El tipo de documento debe ser "factura" o "boleta"');
    }

    // CORREGIDO: Generar correlativo buscando en TODAS las transacciones
    const lastTransaction = await Transaction.findOne({})
      .sort({ correlative: -1 })
      .limit(1)
      .session(session);

    const correlative = lastTransaction ? lastTransaction.correlative + 1 : 1;
    const documentNumber = `COT-${correlative.toString().padStart(4, '0')}`;

    // Calcular automáticamente los montos usando la función centralizada
    const taxRate = quotationData.taxRate || 0.19;
    const calculations = calculateTransactionAmounts(
      quotationData.items,
      quotationData.documentType,
      taxRate
    );

    // Crear la cotización con montos calculados
    const newQuotationData = {
      ...quotationData,
      // Normalizar fecha si viene en los datos de entrada
      ...(quotationData.date && { date: createNoonDate(quotationData.date) }),
      type: TransactionType.QUOTATION,
      correlative,
      documentNumber,
      user: userId,
      items: calculations.processedItems,
      netAmount: calculations.netAmount,
      taxAmount: calculations.taxAmount,
      totalAmount: calculations.totalAmount,
      taxRate,
      status: quotationData.status || TransactionStatus.PENDING // Por defecto las cotizaciones están pendientes
    };

    const newQuotation = (await Quotation.create([newQuotationData], { session }))[0];
    const quotationId = (newQuotation as unknown as Document & { _id: mongoose.Types.ObjectId })._id;

    // Registrar en el log con información detallada
    await logService.createLog(
      LogOperation.CREATE,
      LogCollectionType.QUOTATION,
      quotationId.toString(),
      userId,
      {
        documentNumber,
        documentType: newQuotationData.documentType,
        counterparty: {
          id: newQuotationData.counterparty,
          name: quotationData.counterpartyName || 'N/A' // Si está disponible en los datos
        },
        totalAmount: calculations.totalAmount,
        netAmount: calculations.netAmount,
        taxAmount: calculations.taxAmount,
        itemsCount: calculations.processedItems.length,
        status: newQuotationData.status,
        validUntil: newQuotationData.validUntil
      }
    );

    await session.commitTransaction();
    return newQuotation;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Obtiene todas las cotizaciones con paginación y filtros
 */
const getQuotations = async (page = 1, limit = 10, filters: any = {}): Promise<{
  quotations: IQuotation[];
  pagination: {
    total: number;
    pages: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}> => {
  // Construir query con filtros
  const matchStage: any = {
    type: TransactionType.QUOTATION,
    isDeleted: filters.includeDeleted ? { $in: [true, false] } : false
  };

  // Filtrar por estado
  if (filters.status) {
    matchStage.status = filters.status;
  }

  // Filtrar por contraparte (cliente)
  if (filters.counterparty) {
    matchStage.counterparty = new mongoose.Types.ObjectId(filters.counterparty);
  }

  // Filtrar por usuario
  if (filters.user) {
    matchStage.user = new mongoose.Types.ObjectId(filters.user);
  }

  // Filtrar por rango de fechas
  if (filters.startDate || filters.endDate) {
    matchStage.date = {};
    if (filters.startDate) {
      // Forzar interpretación en UTC para evitar problemas de zona horaria
      const startDate = new Date(filters.startDate + 'T00:00:00.000Z');
      console.log('🗓️ Fecha inicio filtro:', startDate);
      matchStage.date.$gte = startDate;
    }
    if (filters.endDate) {
      // Forzar interpretación en UTC para evitar problemas de zona horaria
      const endDate = new Date(filters.endDate + 'T23:59:59.999Z');
      console.log('🗓️ Fecha fin filtro:', endDate);
      matchStage.date.$lte = endDate;
    }
    console.log('🔍 Filtro de fecha completo:', matchStage.date);
  }

  // Filtrar por monto total
  if (filters.minAmount || filters.maxAmount) {
    matchStage.totalAmount = {};
    if (filters.minAmount) {
      matchStage.totalAmount.$gte = parseFloat(filters.minAmount);
    }
    if (filters.maxAmount) {
      matchStage.totalAmount.$lte = parseFloat(filters.maxAmount);
    }
  }

  // Configurar ordenamiento
  let sortStage: any = { createdAt: -1 }; // Ordenamiento por defecto
  if (filters.sort) {
    const sortField = filters.sort;
    const sortOrder = filters.order === 'desc' ? -1 : 1;

    // Mapear campos especiales para ordenamiento
    const sortMapping: { [key: string]: string } = {
      'counterparty': 'counterpartyData.name',
      'user': 'userData.name',
      'date': 'date',
      'status': 'status',
      'totalAmount': 'totalAmount',
      'documentNumber': 'documentNumber'
    };

    const actualSortField = sortMapping[sortField] || sortField;
    sortStage = { [actualSortField]: sortOrder };
    console.log('📊 Ordenamiento aplicado:', sortStage);
  }

  // Calcular paginación
  const total = await Quotation.countDocuments(matchStage);
  const pages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  // Obtener cotizaciones paginadas con aggregate y $lookup
  const quotations = await Quotation.aggregate([
    { $match: matchStage },
    // Lookup para contraparte (cliente/proveedor)
    {
      $lookup: {
        from: 'contacts',
        localField: 'counterparty',
        foreignField: '_id',
        pipeline: [
          { $project: { name: 1, email: 1, rut: 1, phone: 1, address: 1 } }
        ],
        as: 'counterpartyData'
      }
    },
    // Lookup para usuario
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        pipeline: [
          { $project: { name: 1, email: 1 } }
        ],
        as: 'userData'
      }
    },
    // Aplicar ordenamiento después de los lookups
    { $sort: sortStage },
    { $skip: offset },
    { $limit: limit },
    // Lookup para items
    {
      $lookup: {
        from: 'items',
        let: { itemIds: '$items._id' },
        pipeline: [
          {
            $match: {
              $expr: { $in: ['$_id', '$$itemIds'] }
            }
          },
          {
            $project: {
              name: 1,
              description: 1,
              netPrice: 1,
              dimensions: 1
            }
          }
        ],
        as: 'itemsData'
      }
    },
    // Transformar arrays en objetos para mantener la estructura esperada
    {
      $addFields: {
        counterparty: { $arrayElemAt: ['$counterpartyData', 0] },
        user: { $arrayElemAt: ['$userData', 0] },
        items: {
          $map: {
            input: '$items',
            as: 'item',
            in: {
              $mergeObjects: [
                '$$item',
                {
                  itemDetail: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$itemsData',
                          as: 'itemData',
                          cond: { $eq: ['$$itemData._id', '$$item._id'] }
                        }
                      },
                      0
                    ]
                  }
                }
              ]
            }
          }
        }
      }
    },
    // Eliminar campos temporales
    {
      $project: {
        counterpartyData: 0,
        userData: 0,
        itemsData: 0
      }
    }
  ]);

  return {
    quotations,
    pagination: {
      total,
      pages,
      page,
      limit,
      hasNext: page < pages,
      hasPrev: page > 1
    }
  };
};

/**
 * Obtiene una cotización por ID
 */
const getQuotationById = async (id: string): Promise<IQuotation | null> => {
  const result = await Quotation.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(id),
        type: TransactionType.QUOTATION,
        isDeleted: false
      }
    },
    // Lookup para contraparte (cliente/proveedor)
    {
      $lookup: {
        from: 'contacts',
        localField: 'counterparty',
        foreignField: '_id',
        pipeline: [
          { $project: { name: 1, email: 1, rut: 1, phone: 1, address: 1 } }
        ],
        as: 'counterpartyData'
      }
    },
    // Lookup para usuario
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        pipeline: [
          { $project: { name: 1, email: 1 } }
        ],
        as: 'userData'
      }
    },
    // Lookup para items
    {
      $lookup: {
        from: 'items',
        let: { itemIds: '$items._id' },
        pipeline: [
          {
            $match: {
              $expr: { $in: ['$_id', '$$itemIds'] }
            }
          },
          {
            $project: {
              name: 1,
              description: 1,
              netPrice: 1,
              dimensions: 1
            }
          }
        ],
        as: 'itemsData'
      }
    },
    // Transformar arrays en objetos para mantener la estructura esperada
    {
      $addFields: {
        counterparty: { $arrayElemAt: ['$counterpartyData', 0] },
        user: { $arrayElemAt: ['$userData', 0] },
        items: {
          $map: {
            input: '$items',
            as: 'item',
            in: {
              $mergeObjects: [
                '$$item',
                {
                  itemDetail: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$itemsData',
                          as: 'itemData',
                          cond: { $eq: ['$$itemData._id', '$$item._id'] }
                        }
                      },
                      0
                    ]
                  }
                }
              ]
            }
          }
        }
      }
    },
    // Eliminar campos temporales
    {
      $project: {
        counterpartyData: 0,
        userData: 0,
        itemsData: 0
      }
    }
  ]);

  return result.length > 0 ? result[0] : null;
};

/**
 * Actualiza una cotización existente
 */
const updateQuotation = async (id: string, quotationData: any, userId: string): Promise<IQuotation | null> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const quotation = await Quotation.findOne({
      _id: id,
      type: TransactionType.QUOTATION,
      isDeleted: false
    }).session(session);

    if (!quotation) {
      throw new Error('Cotización no encontrada');
    }

    // Verificar si se puede editar (solo se pueden editar cotizaciones pendientes)
    if (quotation.status !== 'pending') {
      throw new Error('Solo se pueden editar cotizaciones en estado pendiente');
    }

    // Validar documentType si se proporciona
    if (quotationData.documentType && !['factura', 'boleta'].includes(quotationData.documentType)) {
      throw new Error('El tipo de documento debe ser "factura" o "boleta"');
    }

    // Calcular automáticamente los montos si se envían items
    let processedData = { ...quotationData };

    if (quotationData.items && quotationData.items.length > 0) {
      // Determinar el documentType a usar (nuevo o existente)
      const documentType = quotationData.documentType || quotation.documentType;

      if (!documentType) {
        throw new Error('Se requiere un tipo de documento para calcular los montos');
      }

      // Calcular automáticamente los montos usando la función centralizada
      const taxRate = quotationData.taxRate || quotation.taxRate || 0.19;
      const calculations = calculateTransactionAmounts(
        quotationData.items,
        documentType,
        taxRate
      );

      processedData = {
        ...quotationData,
        // Normalizar fecha si viene en los datos de entrada
        ...(quotationData.date && { date: createNoonDate(quotationData.date) }),
        items: calculations.processedItems,
        netAmount: calculations.netAmount,
        taxAmount: calculations.taxAmount,
        totalAmount: calculations.totalAmount,
        taxRate
      };
    }

    // Actualizar la cotización
    const updatedQuotation = await Quotation.findByIdAndUpdate(
      id,
      {
        ...processedData,
        type: TransactionType.QUOTATION, // Asegurar que no se cambie el tipo
      },
      { new: true, runValidators: true, session }
    );

    // Registrar en el log con información de cambios
    await logService.createLog(
      LogOperation.UPDATE,
      LogCollectionType.QUOTATION,
      id,
      userId,
      {
        documentNumber: quotation.documentNumber,
        changes: {
          ...(quotationData.counterparty && { counterparty: { from: quotation.counterparty, to: quotationData.counterparty } }),
          ...(quotationData.documentType && { documentType: { from: quotation.documentType, to: quotationData.documentType } }),
          ...(quotationData.items && {
            itemsCount: { from: quotation.items.length, to: quotationData.items.length },
            totalAmount: { from: quotation.totalAmount, to: processedData.totalAmount }
          }),
          ...(quotationData.validUntil && { validUntil: { from: quotation.validUntil, to: quotationData.validUntil } }),
          ...(quotationData.observations && { observations: { from: quotation.observations, to: quotationData.observations } })
        },
        previousValues: {
          totalAmount: quotation.totalAmount,
          netAmount: quotation.netAmount,
          status: quotation.status
        }
      }
    );

    await session.commitTransaction();
    return updatedQuotation;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Elimina una cotización (borrado lógico)
 */
const deleteQuotation = async (id: string, userId: string): Promise<IQuotation | null> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const quotation = await Quotation.findOne({
      _id: id,
      type: TransactionType.QUOTATION,
      isDeleted: false
    }).session(session);

    if (!quotation) {
      throw new Error('Cotización no encontrada');
    }

    // Verificar si se puede eliminar (solo se pueden eliminar cotizaciones pendientes)
    if (quotation.status !== 'pending') {
      throw new Error('Solo se pueden eliminar cotizaciones en estado pendiente');
    }

    // Borrado lógico
    const deletedQuotation = await Quotation.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true, session }
    );

    // Registrar en el log con información completa
    await logService.createLog(
      LogOperation.DELETE,
      LogCollectionType.QUOTATION,
      id,
      userId,
      {
        documentNumber: quotation.documentNumber,
        deletedData: {
          counterparty: quotation.counterparty,
          totalAmount: quotation.totalAmount,
          status: quotation.status,
          itemsCount: quotation.items.length,
          createdAt: quotation.createdAt
        }
      }
    );

    await session.commitTransaction();
    return deletedQuotation;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Cambia el estado de una cotización
 */
const changeQuotationStatus = async (id: string, status: string, userId: string): Promise<IQuotation | null> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const quotation = await Quotation.findOne({
      _id: id,
      type: TransactionType.QUOTATION,
      isDeleted: false
    }).session(session);

    if (!quotation) {
      throw new Error('Cotización no encontrada');
    }

    // Validar transiciones de estado permitidas
    const validTransitions: { [key: string]: string[] } = {
      'pending': ['approved', 'rejected'],
      'approved': ['converted', 'rejected'],
      'rejected': ['pending'],
      'converted': []
    };

    if (!validTransitions[quotation.status]?.includes(status)) {
      throw new Error(`No se puede cambiar el estado de ${quotation.status} a ${status}`);
    }

    // Actualizar estado
    const updatedQuotation = await Quotation.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true, session }
    );

    // Registrar en el log con información detallada del cambio de estado
    await logService.createLog(
      LogOperation.UPDATE,
      LogCollectionType.QUOTATION,
      id,
      userId,
      {
        documentNumber: quotation.documentNumber,
        operationType: 'STATUS_CHANGE',
        statusTransition: {
          from: quotation.status,
          to: status
        },
        transactionInfo: {
          totalAmount: quotation.totalAmount,
          counterparty: quotation.counterparty,
          itemsCount: quotation.items.length
        },
        timestamp: new Date().toISOString()
      }
    );

    await session.commitTransaction();
    return updatedQuotation;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Función helper para crear fechas a las 12:00 del día (evita problemas de zona horaria)
const createNoonDate = (inputDate?: Date | string): Date => {
  const date = inputDate ? new Date(inputDate) : new Date();
  date.setHours(12, 0, 0, 0); // 12:00:00.000
  return date;
};

export default {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotation,
  deleteQuotation,
  changeQuotationStatus,
  generateNextDocumentNumber,
  previewQuotationCalculation
}; 