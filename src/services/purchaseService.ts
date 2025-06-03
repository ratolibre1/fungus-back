import mongoose, { Document } from 'mongoose';
import Purchase, { IPurchase } from '../models/Purchase';
import Transaction, { TransactionType, TransactionStatus } from '../models/Transaction';
import { LogOperation, LogCollectionType } from '../models/Log';
import logService from './logService';

// Función helper para crear fechas a las 12:00 del día (evita problemas de zona horaria)
const createNoonDate = (inputDate?: Date | string): Date => {
  const date = inputDate ? new Date(inputDate) : new Date();
  date.setHours(12, 0, 0, 0); // 12:00:00.000
  return date;
};

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
 * Preview de cálculo de compra (sin guardar en BD)
 */
const previewPurchaseCalculation = async (purchaseData: any): Promise<any> => {
  try {
    // Validar que se proporcione documentType
    if (!purchaseData.documentType) {
      throw new Error('El tipo de documento es requerido para el preview');
    }

    if (!['factura', 'boleta'].includes(purchaseData.documentType)) {
      throw new Error('El tipo de documento debe ser "factura" o "boleta"');
    }

    // Validar que haya items
    if (!purchaseData.items || purchaseData.items.length === 0) {
      throw new Error('Se requieren items para el preview');
    }

    // Calcular los montos usando la función centralizada
    const taxRate = purchaseData.taxRate || 0.19;
    const calculations = calculateTransactionAmounts(
      purchaseData.items,
      purchaseData.documentType,
      taxRate
    );

    return {
      items: calculations.processedItems,
      netAmount: calculations.netAmount,
      taxAmount: calculations.taxAmount,
      totalAmount: calculations.totalAmount,
      taxRate,
      documentType: purchaseData.documentType
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Genera el siguiente número de documento para compras
 */
const generateNextDocumentNumber = async (): Promise<string> => {
  const lastTransaction = await Transaction.findOne({})
    .sort({ correlative: -1 })
    .limit(1);

  const nextCorrelative = lastTransaction ? lastTransaction.correlative + 1 : 1;
  // Formato: COM-0001, COM-0002, etc.
  return `COM-${nextCorrelative.toString().padStart(4, '0')}`;
};

/**
 * Crea una nueva compra
 */
const createPurchase = async (purchaseData: any, userId: string): Promise<IPurchase> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validar que se proporcione documentType
    if (!purchaseData.documentType) {
      throw new Error('El tipo de documento es requerido');
    }

    if (!['factura', 'boleta'].includes(purchaseData.documentType)) {
      throw new Error('El tipo de documento debe ser "factura" o "boleta"');
    }

    // Generar correlativo buscando en TODAS las transacciones
    const lastTransaction = await Transaction.findOne({})
      .sort({ correlative: -1 })
      .limit(1)
      .session(session);

    const correlative = lastTransaction ? lastTransaction.correlative + 1 : 1;
    const documentNumber = `COM-${correlative.toString().padStart(4, '0')}`;

    // Calcular automáticamente los montos usando la función centralizada
    const taxRate = purchaseData.taxRate || 0.19;
    const calculations = calculateTransactionAmounts(
      purchaseData.items,
      purchaseData.documentType,
      taxRate
    );

    // Crear la compra con montos calculados
    const newPurchaseData = {
      ...purchaseData,
      // Normalizar fecha si viene en los datos de entrada
      ...(purchaseData.date && { date: createNoonDate(purchaseData.date) }),
      type: TransactionType.PURCHASE,
      correlative,
      documentNumber,
      user: userId,
      items: calculations.processedItems,
      netAmount: calculations.netAmount,
      taxAmount: calculations.taxAmount,
      totalAmount: calculations.totalAmount,
      taxRate,
      status: purchaseData.status || TransactionStatus.PENDING // Por defecto las compras están pendientes
    };

    const newPurchase = (await Purchase.create([newPurchaseData], { session }))[0];
    const purchaseId = (newPurchase as unknown as Document & { _id: mongoose.Types.ObjectId })._id;

    // Registrar en el log con información detallada
    await logService.createLog(
      LogOperation.CREATE,
      LogCollectionType.PURCHASE,
      purchaseId.toString(),
      userId,
      {
        documentNumber,
        documentType: newPurchaseData.documentType,
        counterparty: {
          id: newPurchaseData.counterparty,
          name: purchaseData.counterpartyName || 'N/A' // Si está disponible en los datos
        },
        totalAmount: calculations.totalAmount,
        netAmount: calculations.netAmount,
        taxAmount: calculations.taxAmount,
        itemsCount: calculations.processedItems.length,
        status: newPurchaseData.status,
        observations: newPurchaseData.observations
      }
    );

    await session.commitTransaction();
    return newPurchase;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Obtiene todas las compras con paginación y filtros
 */
const getPurchases = async (page = 1, limit = 10, filters: any = {}): Promise<{
  purchases: IPurchase[];
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
    type: TransactionType.PURCHASE,
    isDeleted: filters.includeDeleted ? { $in: [true, false] } : false
  };

  // Filtrar por estado
  if (filters.status) {
    matchStage.status = filters.status;
  }

  // Filtrar por contraparte (proveedor)
  if (filters.counterparty) {
    matchStage.counterparty = new mongoose.Types.ObjectId(filters.counterparty);
  }

  // Filtrar por usuario
  if (filters.user) {
    matchStage.user = new mongoose.Types.ObjectId(filters.user);
  }

  // Filtrar por rango de fechas (igual que en quotations y sales)
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
  const total = await Purchase.countDocuments(matchStage);
  const pages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  // Obtener compras paginadas con aggregate y $lookup (igual que quotations y sales)
  const purchases = await Purchase.aggregate([
    { $match: matchStage },
    // Lookup para contraparte (proveedor)
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
    // Lookup para items (incluir itemDetails)
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
    purchases,
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
 * Obtiene una compra por ID
 */
const getPurchaseById = async (id: string): Promise<IPurchase | null> => {
  const result = await Purchase.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(id),
        type: TransactionType.PURCHASE,
        isDeleted: false
      }
    },
    // Lookup para contraparte (proveedor)
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
    // Lookup para items (incluir itemDetails)
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
 * Actualiza una compra
 */
const updatePurchase = async (id: string, purchaseData: any, userId: string): Promise<IPurchase | null> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchase = await Purchase.findOne({
      _id: id,
      type: TransactionType.PURCHASE,
      isDeleted: false
    }).session(session);

    if (!purchase) {
      throw new Error('Compra no encontrada');
    }

    // Verificar si se puede editar (solo se pueden editar compras pendientes)
    if (purchase.status !== 'pending') {
      throw new Error('Solo se pueden editar compras en estado pendiente');
    }

    // Validar documentType si se proporciona
    if (purchaseData.documentType && !['factura', 'boleta'].includes(purchaseData.documentType)) {
      throw new Error('El tipo de documento debe ser "factura" o "boleta"');
    }

    // Calcular automáticamente los montos si se envían items
    let processedData = { ...purchaseData };

    if (purchaseData.items && purchaseData.items.length > 0) {
      // Determinar el documentType a usar (nuevo o existente)
      const documentType = purchaseData.documentType || purchase.documentType;

      if (!documentType) {
        throw new Error('Se requiere un tipo de documento para calcular los montos');
      }

      // Calcular automáticamente los montos usando la función centralizada
      const taxRate = purchaseData.taxRate || purchase.taxRate || 0.19;
      const calculations = calculateTransactionAmounts(
        purchaseData.items,
        documentType,
        taxRate
      );

      processedData = {
        ...purchaseData,
        // Normalizar fecha si viene en los datos de entrada
        ...(purchaseData.date && { date: createNoonDate(purchaseData.date) }),
        items: calculations.processedItems,
        netAmount: calculations.netAmount,
        taxAmount: calculations.taxAmount,
        totalAmount: calculations.totalAmount,
        taxRate
      };
    }

    // Actualizar la compra
    const updatedPurchase = await Purchase.findByIdAndUpdate(
      id,
      {
        ...processedData,
        type: TransactionType.PURCHASE, // Asegurar que no se cambie el tipo
      },
      { new: true, runValidators: true, session }
    );

    // Registrar en el log con información de cambios
    await logService.createLog(
      LogOperation.UPDATE,
      LogCollectionType.PURCHASE,
      id,
      userId,
      {
        documentNumber: purchase.documentNumber,
        changes: {
          ...(purchaseData.counterparty && { counterparty: { from: purchase.counterparty, to: purchaseData.counterparty } }),
          ...(purchaseData.documentType && { documentType: { from: purchase.documentType, to: purchaseData.documentType } }),
          ...(purchaseData.items && {
            itemsCount: { from: purchase.items.length, to: purchaseData.items.length },
            totalAmount: { from: purchase.totalAmount, to: processedData.totalAmount }
          }),
          ...(purchaseData.observations && { observations: { from: purchase.observations, to: purchaseData.observations } })
        },
        previousValues: {
          totalAmount: purchase.totalAmount,
          netAmount: purchase.netAmount,
          status: purchase.status
        }
      }
    );

    await session.commitTransaction();
    return updatedPurchase;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Elimina una compra (borrado lógico)
 */
const deletePurchase = async (id: string, userId: string): Promise<IPurchase | null> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchase = await Purchase.findOne({
      _id: id,
      type: TransactionType.PURCHASE,
      isDeleted: false
    }).session(session);

    if (!purchase) {
      throw new Error('Compra no encontrada');
    }

    // Verificar si se puede eliminar (solo se pueden eliminar compras pendientes)
    if (purchase.status !== 'pending') {
      throw new Error('Solo se pueden eliminar compras en estado pendiente');
    }

    // Borrado lógico
    const deletedPurchase = await Purchase.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true, session }
    );

    // Registrar en el log con información completa
    await logService.createLog(
      LogOperation.DELETE,
      LogCollectionType.PURCHASE,
      id,
      userId,
      {
        documentNumber: purchase.documentNumber,
        deletedData: {
          counterparty: purchase.counterparty,
          totalAmount: purchase.totalAmount,
          status: purchase.status,
          itemsCount: purchase.items.length,
          observations: purchase.observations,
          createdAt: purchase.createdAt
        }
      }
    );

    await session.commitTransaction();
    return deletedPurchase;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Cambia el estado de una compra
 */
const changePurchaseStatus = async (id: string, status: string, userId: string): Promise<IPurchase | null> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchase = await Purchase.findOne({
      _id: id,
      type: TransactionType.PURCHASE,
      isDeleted: false
    }).session(session);

    if (!purchase) {
      throw new Error('Compra no encontrada');
    }

    // Validar transiciones de estado permitidas para compras
    const validTransitions: { [key: string]: string[] } = {
      'pending': ['received', 'rejected'],
      'received': [],
      'rejected': []
    };

    if (!validTransitions[purchase.status]?.includes(status)) {
      throw new Error(`No se puede cambiar el estado de ${purchase.status} a ${status}`);
    }

    // Actualizar estado
    const updatedPurchase = await Purchase.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true, session }
    );

    // Registrar en el log con información detallada del cambio de estado
    await logService.createLog(
      LogOperation.UPDATE,
      LogCollectionType.PURCHASE,
      id,
      userId,
      {
        documentNumber: purchase.documentNumber,
        operationType: 'STATUS_CHANGE',
        statusTransition: {
          from: purchase.status,
          to: status
        },
        transactionInfo: {
          totalAmount: purchase.totalAmount,
          counterparty: purchase.counterparty,
          itemsCount: purchase.items.length,
          observations: purchase.observations
        },
        timestamp: new Date().toISOString()
      }
    );

    await session.commitTransaction();
    return updatedPurchase;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export default {
  createPurchase,
  getPurchases,
  getPurchaseById,
  updatePurchase,
  deletePurchase,
  changePurchaseStatus,
  generateNextDocumentNumber,
  previewPurchaseCalculation
}; 