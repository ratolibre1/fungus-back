import mongoose, { Document } from 'mongoose';
import Sale, { ISale } from '../models/Sale';
import Quotation from '../models/Quotation';
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
 * Preview de cálculo de venta (sin guardar en BD)
 */
const previewSaleCalculation = async (saleData: any): Promise<any> => {
  try {
    // Validar que se proporcione documentType
    if (!saleData.documentType) {
      throw new Error('El tipo de documento es requerido para el preview');
    }

    if (!['factura', 'boleta'].includes(saleData.documentType)) {
      throw new Error('El tipo de documento debe ser "factura" o "boleta"');
    }

    // Validar que haya items
    if (!saleData.items || saleData.items.length === 0) {
      throw new Error('Se requieren items para el preview');
    }

    // Calcular los montos usando la función centralizada
    const taxRate = saleData.taxRate || 0.19;
    const calculations = calculateTransactionAmounts(
      saleData.items,
      saleData.documentType,
      taxRate
    );

    return {
      items: calculations.processedItems,
      netAmount: calculations.netAmount,
      taxAmount: calculations.taxAmount,
      totalAmount: calculations.totalAmount,
      taxRate,
      documentType: saleData.documentType
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Genera el siguiente número de documento para ventas
 */
const generateNextDocumentNumber = async (): Promise<string> => {
  const lastTransaction = await Transaction.findOne({})
    .sort({ correlative: -1 })
    .limit(1);

  const nextCorrelative = lastTransaction ? lastTransaction.correlative + 1 : 1;
  // Formato: VEN-0001, VEN-0002, etc.
  return `VEN-${nextCorrelative.toString().padStart(4, '0')}`;
};

// Función helper para crear fechas a las 12:00 del día (evita problemas de zona horaria)
const createNoonDate = (inputDate?: Date | string): Date => {
  const date = inputDate ? new Date(inputDate) : new Date();
  date.setHours(12, 0, 0, 0); // 12:00:00.000
  return date;
};

/**
 * Crea una nueva venta
 */
const createSale = async (saleData: any, userId: string): Promise<ISale> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validar que se proporcione documentType
    if (!saleData.documentType) {
      throw new Error('El tipo de documento es requerido');
    }

    if (!['factura', 'boleta'].includes(saleData.documentType)) {
      throw new Error('El tipo de documento debe ser "factura" o "boleta"');
    }

    // CORREGIDO: Generar correlativo buscando en TODAS las transacciones
    const lastTransaction = await Transaction.findOne({})
      .sort({ correlative: -1 })
      .limit(1)
      .session(session);

    const correlative = lastTransaction ? lastTransaction.correlative + 1 : 1;
    const documentNumber = `VEN-${correlative.toString().padStart(4, '0')}`;

    // Calcular automáticamente los montos usando la función centralizada
    const taxRate = saleData.taxRate || 0.19;
    const calculations = calculateTransactionAmounts(
      saleData.items,
      saleData.documentType,
      taxRate
    );

    // Crear la venta con montos calculados
    const newSaleData = {
      ...saleData,
      // Normalizar fecha si viene en los datos de entrada
      ...(saleData.date && { date: createNoonDate(saleData.date) }),
      type: TransactionType.SALE,
      correlative,
      documentNumber,
      user: userId,
      items: calculations.processedItems,
      netAmount: calculations.netAmount,
      taxAmount: calculations.taxAmount,
      totalAmount: calculations.totalAmount,
      taxRate,
      status: saleData.status || TransactionStatus.INVOICED // Por defecto las ventas están facturadas
    };

    const newSale = (await Sale.create([newSaleData], { session }))[0];
    const saleId = (newSale as unknown as Document & { _id: mongoose.Types.ObjectId })._id;

    // Si la venta está relacionada con una cotización, actualizar su estado
    if (saleData.relatedQuotation) {
      await Quotation.findByIdAndUpdate(
        saleData.relatedQuotation,
        { status: TransactionStatus.CONVERTED },
        { session }
      );
    }

    // Registrar en el log con información detallada
    await logService.createLog(
      LogOperation.CREATE,
      LogCollectionType.SALE,
      saleId.toString(),
      userId,
      {
        documentNumber,
        documentType: saleData.documentType,
        counterparty: {
          id: saleData.counterparty,
          name: saleData.counterpartyName || 'N/A' // Si está disponible en los datos
        },
        totalAmount: calculations.totalAmount,
        netAmount: calculations.netAmount,
        taxAmount: calculations.taxAmount,
        itemsCount: calculations.processedItems.length,
        status: saleData.status || TransactionStatus.PENDING,
        relatedQuotation: saleData.relatedQuotation || null,
        isFromQuotation: !!saleData.relatedQuotation
      }
    );

    await session.commitTransaction();
    return newSale;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Obtiene todas las ventas con paginación y filtros
 */
const getSales = async (page = 1, limit = 10, filters: any = {}): Promise<{
  sales: ISale[];
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
    type: TransactionType.SALE,
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

  // Filtrar por cotización relacionada
  if (filters.relatedQuotation) {
    matchStage.relatedQuotation = new mongoose.Types.ObjectId(filters.relatedQuotation);
  }

  // Filtrar por rango de fechas (igual que en quotations)
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
  const total = await Sale.countDocuments(matchStage);
  const pages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  // Obtener ventas paginadas con aggregate y $lookup (igual que quotations)
  const sales = await Sale.aggregate([
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
    // Lookup para cotización relacionada
    {
      $lookup: {
        from: 'transactions',
        localField: 'relatedQuotation',
        foreignField: '_id',
        pipeline: [
          { $project: { documentNumber: 1, status: 1 } }
        ],
        as: 'relatedQuotationData'
      }
    },
    // Aplicar ordenamiento después de los lookups
    { $sort: sortStage },
    { $skip: offset },
    { $limit: limit },
    // Lookup para items (NUEVO - igual que quotations)
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
        relatedQuotation: { $arrayElemAt: ['$relatedQuotationData', 0] },
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
        relatedQuotationData: 0,
        itemsData: 0
      }
    }
  ]);

  return {
    sales,
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
 * Obtiene una venta por ID
 */
const getSaleById = async (id: string): Promise<ISale | null> => {
  const result = await Sale.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(id),
        type: TransactionType.SALE,
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
    // Lookup para cotización relacionada
    {
      $lookup: {
        from: 'transactions',
        localField: 'relatedQuotation',
        foreignField: '_id',
        pipeline: [
          { $project: { documentNumber: 1, status: 1 } }
        ],
        as: 'relatedQuotationData'
      }
    },
    // Lookup para items (NUEVO - igual que quotations)
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
        relatedQuotation: { $arrayElemAt: ['$relatedQuotationData', 0] },
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
        relatedQuotationData: 0,
        itemsData: 0
      }
    }
  ]);

  return result.length > 0 ? result[0] : null;
};

/**
 * Actualiza una venta
 */
const updateSale = async (id: string, saleData: any, userId: string): Promise<ISale | null> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sale = await Sale.findOne({
      _id: id,
      type: TransactionType.SALE,
      isDeleted: false
    }).session(session);

    if (!sale) {
      throw new Error('Venta no encontrada');
    }

    // Verificar si se puede editar (solo se pueden editar ventas pendientes o facturadas)
    if (!['pending', 'invoiced'].includes(sale.status)) {
      throw new Error('Solo se pueden editar ventas en estado pendiente o facturadas');
    }

    // Validar documentType si se proporciona
    if (saleData.documentType && !['factura', 'boleta'].includes(saleData.documentType)) {
      throw new Error('El tipo de documento debe ser "factura" o "boleta"');
    }

    // Calcular automáticamente los montos si se envían items
    let processedData = { ...saleData };

    if (saleData.items && saleData.items.length > 0) {
      // Determinar el documentType a usar (nuevo o existente)
      const documentType = saleData.documentType || sale.documentType;

      if (!documentType) {
        throw new Error('Se requiere un tipo de documento para calcular los montos');
      }

      // Calcular automáticamente los montos usando la función centralizada
      const taxRate = saleData.taxRate || sale.taxRate || 0.19;
      const calculations = calculateTransactionAmounts(
        saleData.items,
        documentType,
        taxRate
      );

      processedData = {
        ...saleData,
        // Normalizar fecha si viene en los datos de entrada
        ...(saleData.date && { date: createNoonDate(saleData.date) }),
        items: calculations.processedItems,
        netAmount: calculations.netAmount,
        taxAmount: calculations.taxAmount,
        totalAmount: calculations.totalAmount,
        taxRate
      };
    }

    // Actualizar la venta
    const updatedSale = await Sale.findByIdAndUpdate(
      id,
      {
        ...processedData,
        type: TransactionType.SALE, // Asegurar que no se cambie el tipo
      },
      { new: true, runValidators: true, session }
    );

    // Registrar en el log con información de cambios
    await logService.createLog(
      LogOperation.UPDATE,
      LogCollectionType.SALE,
      id,
      userId,
      {
        documentNumber: sale.documentNumber,
        changes: {
          ...(saleData.counterparty && { counterparty: { from: sale.counterparty, to: saleData.counterparty } }),
          ...(saleData.documentType && { documentType: { from: sale.documentType, to: saleData.documentType } }),
          ...(saleData.items && {
            itemsCount: { from: sale.items.length, to: saleData.items.length },
            totalAmount: { from: sale.totalAmount, to: processedData.totalAmount }
          }),
          ...(saleData.observations && { observations: { from: sale.observations, to: saleData.observations } })
        },
        previousValues: {
          totalAmount: sale.totalAmount,
          netAmount: sale.netAmount,
          status: sale.status
        }
      }
    );

    await session.commitTransaction();
    return updatedSale;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Elimina una venta (borrado lógico)
 */
const deleteSale = async (id: string, userId: string): Promise<ISale | null> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sale = await Sale.findOne({
      _id: id,
      type: TransactionType.SALE,
      isDeleted: false
    }).session(session);

    if (!sale) {
      throw new Error('Venta no encontrada');
    }

    // Verificar si se puede eliminar (solo se pueden eliminar ventas pendientes)
    if (sale.status !== 'pending') {
      throw new Error('Solo se pueden eliminar ventas en estado pendiente');
    }

    // Borrado lógico
    const deletedSale = await Sale.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true, session }
    );

    // Registrar en el log con información completa
    await logService.createLog(
      LogOperation.DELETE,
      LogCollectionType.SALE,
      id,
      userId,
      {
        documentNumber: sale.documentNumber,
        deletedData: {
          counterparty: sale.counterparty,
          totalAmount: sale.totalAmount,
          status: sale.status,
          itemsCount: sale.items.length,
          relatedQuotation: sale.relatedQuotation,
          createdAt: sale.createdAt
        }
      }
    );

    await session.commitTransaction();
    return deletedSale;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Cambia el estado de una venta
 */
const changeSaleStatus = async (id: string, status: string, userId: string): Promise<ISale | null> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sale = await Sale.findOne({
      _id: id,
      type: TransactionType.SALE,
      isDeleted: false
    }).session(session);

    if (!sale) {
      throw new Error('Venta no encontrada');
    }

    // Validar transiciones de estado permitidas para ventas
    const validTransitions: { [key: string]: string[] } = {
      'pending': ['invoiced'],
      'invoiced': ['paid'],
      'paid': []
    };

    if (!validTransitions[sale.status]?.includes(status)) {
      throw new Error(`No se puede cambiar el estado de ${sale.status} a ${status}`);
    }

    // Actualizar estado
    const updatedSale = await Sale.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true, session }
    );

    // Registrar en el log con información detallada del cambio de estado
    await logService.createLog(
      LogOperation.UPDATE,
      LogCollectionType.SALE,
      id,
      userId,
      {
        documentNumber: sale.documentNumber,
        operationType: 'STATUS_CHANGE',
        statusTransition: {
          from: sale.status,
          to: status
        },
        transactionInfo: {
          totalAmount: sale.totalAmount,
          counterparty: sale.counterparty,
          itemsCount: sale.items.length,
          relatedQuotation: sale.relatedQuotation
        },
        timestamp: new Date().toISOString()
      }
    );

    await session.commitTransaction();
    return updatedSale;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Convierte una cotización en venta
 */
const convertQuotationToSale = async (quotationId: string, userId: string): Promise<ISale> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Buscar la cotización
    const quotation = await Quotation.findOne({
      _id: quotationId,
      type: TransactionType.QUOTATION,
      isDeleted: false
    }).session(session);

    if (!quotation) {
      throw new Error('Cotización no encontrada');
    }

    // Verificar que la cotización esté aprobada
    if (quotation.status !== TransactionStatus.APPROVED) {
      throw new Error('Solo se pueden convertir cotizaciones aprobadas');
    }

    // CORREGIDO: Generar correlativo buscando en TODAS las transacciones
    const lastTransaction = await Transaction.findOne({})
      .sort({ correlative: -1 })
      .limit(1)
      .session(session);

    const correlative = lastTransaction ? lastTransaction.correlative + 1 : 1;
    const documentNumber = `VEN-${correlative.toString().padStart(4, '0')}`;

    // Crear la venta basada en la cotización
    const saleData = {
      type: TransactionType.SALE,
      correlative,
      documentNumber,
      documentType: quotation.documentType,
      date: createNoonDate(quotation.date), // CORREGIDO: Normalizar fecha a las 12:00
      counterparty: quotation.counterparty,
      items: quotation.items,
      taxRate: quotation.taxRate,
      netAmount: quotation.netAmount,
      taxAmount: quotation.taxAmount,
      totalAmount: quotation.totalAmount,
      status: TransactionStatus.INVOICED,
      user: userId,
      relatedQuotation: quotationId,
      observations: quotation.observations
    };

    const newSale = (await Sale.create([saleData], { session }))[0];
    const saleId = (newSale as unknown as Document & { _id: mongoose.Types.ObjectId })._id;

    // Actualizar el estado de la cotización a convertida
    await Quotation.findByIdAndUpdate(
      quotationId,
      { status: TransactionStatus.CONVERTED },
      { session }
    );

    // Registrar en el log con información detallada de la conversión
    await logService.createLog(
      LogOperation.CREATE,
      LogCollectionType.SALE,
      saleId.toString(),
      userId,
      {
        documentNumber,
        operationType: 'QUOTATION_CONVERSION',
        convertedFrom: {
          documentNumber: quotation.documentNumber,
          quotationId: quotationId,
          originalStatus: quotation.status
        },
        conversionData: {
          totalAmount: quotation.totalAmount,
          itemsCount: quotation.items.length,
          documentType: quotation.documentType
        },
        timestamp: new Date().toISOString()
      }
    );

    await session.commitTransaction();
    return newSale;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export default {
  createSale,
  getSales,
  getSaleById,
  updateSale,
  deleteSale,
  changeSaleStatus,
  generateNextDocumentNumber,
  previewSaleCalculation,
  convertQuotationToSale
}; 