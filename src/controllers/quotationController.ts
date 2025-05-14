import { Request, Response } from 'express';
import Quotation, { QuotationStatus, IQuotation } from '../models/Quotation';
import Contact from '../models/Client';
import Item from '../models/Item';
import logService from '../services/logService';
import { LogOperation, LogCollectionType } from '../models/Log';
import mongoose from 'mongoose';
import '../types/custom';
import Sale from '../models/Sale';
import stockService from '../services/stockService';
import { DocumentType } from '../models/Sale';
import { IContact } from '../models/Client';

/**
 * @desc    Obtener todas las cotizaciones
 * @route   GET /api/quotations
 * @access  Private
 */
export const getQuotations = async (req: Request, res: Response): Promise<void> => {
  try {
    // Filtrar para mostrar solo cotizaciones activas (no eliminadas)
    const quotations = await Quotation.find({ isDeleted: false })
      .populate('client', 'name rut')
      .populate('seller', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: quotations.length,
      data: quotations
    });
  } catch (error: any) {
    console.error('Error al obtener cotizaciones:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener cotizaciones'
    });
  }
};

/**
 * @desc    Obtener una cotización por ID
 * @route   GET /api/quotations/:id
 * @access  Private
 */
export const getQuotationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('client', 'name rut email phone address')
      .populate('seller', 'name email')
      .populate('items.product', 'name description netPrice');

    if (!quotation || quotation.isDeleted) {
      res.status(404).json({
        success: false,
        message: 'Cotización no encontrada'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: quotation
    });
  } catch (error: any) {
    console.error('Error al obtener cotización:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener cotización'
    });
  }
};

/**
 * @desc    Crear nueva cotización
 * @route   POST /api/quotations
 * @access  Private
 */
export const createQuotation = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validar que el cliente exista y sea cliente
    const client = await Contact.findById(req.body.client);
    if (!client || !client.isCustomer) {
      res.status(400).json({
        success: false,
        message: 'Cliente no válido'
      });
      return;
    }

    // Validar que todos los productos existan
    for (const item of req.body.items) {
      const product = await Item.findById(item.product);
      if (!product || product.isDeleted) {
        res.status(400).json({
          success: false,
          message: `Producto inválido: ${item.product}`
        });
        return;
      }
    }

    // Obtener el último correlativo
    const lastQuotation = await Quotation.findOne({}).sort({ correlative: -1 });
    const correlative = lastQuotation ? lastQuotation.correlative + 1 : 1;

    // Crear la cotización
    const quotation = await Quotation.create({
      ...req.body,
      correlative,
      seller: req.user?._id, // Asignar al usuario actual
      status: QuotationStatus.PENDING
    });

    // Registrar en el log
    if (req.user && req.user._id) {
      await logService.createLog(
        LogOperation.CREATE,
        LogCollectionType.QUOTATION,
        (quotation._id as mongoose.Types.ObjectId).toString(),
        req.user._id.toString(),
        {
          clientName: client.name,
          correlative,
          totalAmount: quotation.totalAmount
        }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: quotation
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error al crear cotización:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al crear cotización'
    });
  }
};

/**
 * @desc    Actualizar cotización
 * @route   PUT /api/quotations/:id
 * @access  Private
 */
export const updateQuotation = async (req: Request, res: Response): Promise<void> => {
  try {
    // Encontrar la cotización a actualizar
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation || quotation.isDeleted) {
      res.status(404).json({
        success: false,
        message: 'Cotización no encontrada'
      });
      return;
    }

    // Si la cotización ya fue convertida o rechazada, no se puede actualizar
    if (quotation.status === QuotationStatus.CONVERTED || quotation.status === QuotationStatus.REJECTED) {
      res.status(400).json({
        success: false,
        message: `No se puede actualizar una cotización en estado ${quotation.status}`
      });
      return;
    }

    // Validar que no se cambie el correlativo
    if (req.body.correlative && req.body.correlative !== quotation.correlative) {
      res.status(400).json({
        success: false,
        message: 'No se puede modificar el correlativo'
      });
      return;
    }

    // Actualizar la cotización
    const updatedQuotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );

    // Registrar en el log
    if (req.user && req.user._id) {
      await logService.createLog(
        LogOperation.UPDATE,
        LogCollectionType.QUOTATION,
        (quotation._id as mongoose.Types.ObjectId).toString(),
        req.user._id.toString(),
        {
          correlative: quotation.correlative,
          updatedFields: Object.keys(req.body)
        }
      );
    }

    res.status(200).json({
      success: true,
      data: updatedQuotation
    });
  } catch (error: any) {
    console.error('Error al actualizar cotización:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar cotización'
    });
  }
};

/**
 * @desc    Eliminar cotización (soft delete)
 * @route   DELETE /api/quotations/:id
 * @access  Private
 */
export const deleteQuotation = async (req: Request, res: Response): Promise<void> => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation || quotation.isDeleted) {
      res.status(404).json({
        success: false,
        message: 'Cotización no encontrada'
      });
      return;
    }

    // Si la cotización ya fue convertida, no se puede eliminar
    if (quotation.status === QuotationStatus.CONVERTED) {
      res.status(400).json({
        success: false,
        message: 'No se puede eliminar una cotización convertida a venta'
      });
      return;
    }

    // Soft delete
    quotation.isDeleted = true;
    await quotation.save();

    // Registrar en el log
    if (req.user && req.user._id) {
      await logService.createLog(
        LogOperation.DELETE,
        LogCollectionType.QUOTATION,
        (quotation._id as mongoose.Types.ObjectId).toString(),
        req.user._id.toString(),
        {
          correlative: quotation.correlative,
          status: quotation.status
        }
      );
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error: any) {
    console.error('Error al eliminar cotización:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al eliminar cotización'
    });
  }
};

/**
 * @desc    Convertir cotización a venta
 * @route   POST /api/quotations/:id/convert
 * @access  Private
 */
export const convertToSale = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Encontrar la cotización
    const quotation = await Quotation.findById(req.params.id)
      .populate('client')
      .populate('items.product');

    if (!quotation || quotation.isDeleted) {
      res.status(404).json({
        success: false,
        message: 'Cotización no encontrada'
      });
      return;
    }

    // Verificar que la cotización esté en estado pendiente o aprobada
    if (quotation.status !== QuotationStatus.PENDING && quotation.status !== QuotationStatus.APPROVED) {
      res.status(400).json({
        success: false,
        message: `No se puede convertir una cotización en estado ${quotation.status}`
      });
      return;
    }

    // Validar que todos los productos existan y tengan stock suficiente si están inventariados
    for (const item of quotation.items) {
      // Obtenemos el producto directamente para validar stock
      const productId = item.product._id ? item.product._id.toString() : item.product.toString();
      const product = await Item.findById(productId);

      if (!product || product.isDeleted) {
        res.status(400).json({
          success: false,
          message: `Producto inválido o ya no disponible: ${productId}`
        });
        return;
      }

      // Verificar stock solo si el producto está inventariado
      if (product.isInventoried) {
        const currentStock = product.stock === null ? 0 : product.stock;
        if (currentStock < item.quantity) {
          res.status(400).json({
            success: false,
            message: `Stock insuficiente para el producto: ${product.name}. Disponible: ${currentStock}, Solicitado: ${item.quantity}`
          });
          return;
        }
      }
    }

    // Obtener el último correlativo de ventas
    const lastSale = await Sale.findOne({}).sort({ correlative: -1 });
    const correlative = lastSale ? lastSale.correlative + 1 : 1;

    // Obtener el tipo de documento y su número según los parámetros recibidos
    const documentType = req.body.documentType || DocumentType.INVOICE; // Usar factura por defecto
    const lastDocNumber = await Sale.findOne({ documentType }).sort({ documentNumber: -1 });
    const documentNumber = lastDocNumber ? lastDocNumber.documentNumber + 1 : 1;

    // Preparar datos para la nueva venta
    const saleData = {
      correlative,
      documentType,
      documentNumber,
      date: new Date(), // Fecha actual
      client: quotation.client._id,
      items: quotation.items.map(item => ({
        product: item.product._id ? item.product._id : item.product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        subtotal: item.subtotal
      })),
      netAmount: quotation.netAmount,
      taxAmount: quotation.taxAmount,
      totalAmount: quotation.totalAmount,
      quotationRef: quotation._id, // Referencia a la cotización original
      seller: req.user?._id || quotation.seller, // Usar el usuario actual o el de la cotización
      observations: req.body.observations || quotation.observations
    };

    // Crear la venta
    const sale = await Sale.create(saleData);

    // Actualizar stock de productos
    for (const item of quotation.items) {
      const productId = item.product._id ? item.product._id.toString() : item.product.toString();
      // Usamos el servicio de stock para actualizar
      await stockService.updateStock(productId, -item.quantity);
    }

    // Actualizar estado de la cotización
    quotation.status = QuotationStatus.CONVERTED;
    await quotation.save();

    // Registrar en el log
    if (req.user && req.user._id) {
      await logService.createLog(
        LogOperation.UPDATE,
        LogCollectionType.QUOTATION,
        (quotation._id as any).toString(),
        req.user._id.toString(),
        {
          action: 'convert_to_sale',
          correlative: quotation.correlative,
          saleCorrelative: correlative,
          documentType,
          documentNumber
        }
      );

      await logService.createLog(
        LogOperation.CREATE,
        LogCollectionType.SALE,
        (sale._id as any).toString(),
        req.user._id.toString(),
        {
          clientName: (quotation.client as IContact).name,
          correlative,
          documentType,
          documentNumber,
          totalAmount: sale.totalAmount,
          fromQuotation: quotation.correlative
        }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Cotización convertida a venta exitosamente',
      data: sale
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error al convertir cotización a venta:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al convertir cotización a venta'
    });
  }
};

/**
 * @desc    Filtrar cotizaciones
 * @route   POST /api/quotations/filter
 * @access  Private
 */
export const filterQuotations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { client, startDate, endDate, status } = req.body;
    const filterObject: any = { isDeleted: false };

    // Aplicar filtros
    if (client) filterObject.client = client;
    if (status) filterObject.status = status;
    if (startDate || endDate) {
      filterObject.date = {};
      if (startDate) filterObject.date.$gte = new Date(startDate);
      if (endDate) filterObject.date.$lte = new Date(endDate);
    }

    // Buscar cotizaciones
    const quotations = await Quotation.find(filterObject)
      .populate('client', 'name rut')
      .populate('seller', 'name email')
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: quotations.length,
      data: quotations
    });
  } catch (error: any) {
    console.error('Error al filtrar cotizaciones:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al filtrar cotizaciones'
    });
  }
};

/**
 * @desc    Obtener cotizaciones pendientes
 * @route   GET /api/quotations/pending
 * @access  Private
 */
export const getPendingQuotations = async (req: Request, res: Response): Promise<void> => {
  try {
    const quotations = await Quotation.find({
      status: QuotationStatus.PENDING,
      isDeleted: false
    })
      .populate('client', 'name rut')
      .populate('seller', 'name email')
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: quotations.length,
      data: quotations
    });
  } catch (error: any) {
    console.error('Error al obtener cotizaciones pendientes:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al obtener cotizaciones pendientes'
    });
  }
}; 