import { Request, Response } from 'express';
import Sale, { DocumentType, ISale } from '../models/Sale';
import Quotation, { QuotationStatus } from '../models/Quotation';
import Contact from '../models/Client';
import Item from '../models/Item';
import logService from '../services/logService';
import stockService from '../services/stockService';
import { LogOperation, LogCollectionType } from '../models/Log';
import mongoose from 'mongoose';
import '../types/custom';

/**
 * @desc    Obtener todas las ventas
 * @route   GET /api/sales
 * @access  Private
 */
export const getSales = async (req: Request, res: Response): Promise<void> => {
  try {
    // Filtrar para mostrar solo ventas activas (no eliminadas)
    const sales = await Sale.find({ isDeleted: false })
      .populate('client', 'name rut')
      .populate('seller', 'name email')
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: sales.length,
      data: sales
    });
  } catch (error: any) {
    console.error('Error al obtener ventas:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener ventas'
    });
  }
};

/**
 * @desc    Obtener una venta por ID
 * @route   GET /api/sales/:id
 * @access  Private
 */
export const getSaleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('client', 'name rut email phone address')
      .populate('seller', 'name email')
      .populate('items.product', 'name description netPrice')
      .populate('quotationRef', 'correlative date');

    if (!sale || sale.isDeleted) {
      res.status(404).json({
        success: false,
        message: 'Venta no encontrada'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (error: any) {
    console.error('Error al obtener venta:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener venta'
    });
  }
};

/**
 * @desc    Crear nueva venta
 * @route   POST /api/sales
 * @access  Private
 */
export const createSale = async (req: Request, res: Response): Promise<void> => {
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

    // Validar que todos los productos existan y tengan stock suficiente si están inventariados
    for (const item of req.body.items) {
      const product = await Item.findById(item.product);
      if (!product || product.isDeleted) {
        res.status(400).json({
          success: false,
          message: `Producto inválido: ${item.product}`
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

    // Verificar si viene de una cotización
    if (req.body.quotationRef) {
      const quotation = await Quotation.findById(req.body.quotationRef);
      if (!quotation || quotation.isDeleted) {
        res.status(400).json({
          success: false,
          message: 'Cotización no encontrada'
        });
        return;
      }

      // Actualizar estado de la cotización
      quotation.status = QuotationStatus.CONVERTED;
      await quotation.save();
    }

    // Obtener el último correlativo
    const lastSale = await Sale.findOne({}).sort({ correlative: -1 });
    const correlative = lastSale ? lastSale.correlative + 1 : 1;

    // Obtener el último número de documento según tipo
    const lastDocNumber = await Sale.findOne({ documentType: req.body.documentType })
      .sort({ documentNumber: -1 });
    const documentNumber = lastDocNumber ? lastDocNumber.documentNumber + 1 : 1;

    // Crear la venta
    const sale = await Sale.create({
      ...req.body,
      correlative,
      documentNumber,
      seller: req.user?._id, // Asignar al usuario actual
    });

    // Actualizar stock de productos utilizando el servicio
    for (const item of req.body.items) {
      await stockService.updateStock(item.product, -item.quantity);
    }

    // Registrar en el log
    if (req.user && req.user._id) {
      await logService.createLog(
        LogOperation.CREATE,
        LogCollectionType.SALE,
        (sale._id as mongoose.Types.ObjectId).toString(),
        req.user._id.toString(),
        {
          clientName: client.name,
          correlative,
          documentType: sale.documentType,
          documentNumber: sale.documentNumber,
          totalAmount: sale.totalAmount
        }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: sale
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error al crear venta:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al crear venta'
    });
  }
};

/**
 * @desc    Actualizar venta
 * @route   PUT /api/sales/:id
 * @access  Private
 */
export const updateSale = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Encontrar la venta a actualizar
    const sale = await Sale.findById(req.params.id)
      .populate('items.product');

    if (!sale || sale.isDeleted) {
      res.status(404).json({
        success: false,
        message: 'Venta no encontrada'
      });
      return;
    }

    // Validar que no se cambien datos críticos
    if (req.body.correlative && req.body.correlative !== sale.correlative) {
      res.status(400).json({
        success: false,
        message: 'No se puede modificar el correlativo'
      });
      return;
    }

    if (req.body.documentNumber && req.body.documentNumber !== sale.documentNumber) {
      res.status(400).json({
        success: false,
        message: 'No se puede modificar el número de documento'
      });
      return;
    }

    // Si se modifican los items, restaurar el stock anterior y verificar el nuevo
    if (req.body.items) {
      // Restaurar stock de items anteriores usando el servicio
      for (const item of sale.items) {
        const product = item.product as any;
        await stockService.updateStock(product._id, item.quantity);
      }

      // Verificar stock para nuevos items
      for (const item of req.body.items) {
        const product = await Item.findById(item.product);
        if (!product || product.isDeleted) {
          await session.abortTransaction();
          session.endSession();

          res.status(400).json({
            success: false,
            message: `Producto inválido: ${item.product}`
          });
          return;
        }

        // Verificar stock solo si el producto está inventariado
        if (product.isInventoried) {
          const currentStock = product.stock === null ? 0 : product.stock;
          if (currentStock < item.quantity) {
            await session.abortTransaction();
            session.endSession();

            res.status(400).json({
              success: false,
              message: `Stock insuficiente para el producto: ${product.name}. Disponible: ${currentStock}, Solicitado: ${item.quantity}`
            });
            return;
          }
        }

        // Actualizar stock usando el servicio
        await stockService.updateStock(item.product, -item.quantity);
      }
    }

    // Actualizar la venta
    const updatedSale = await Sale.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );

    // Registrar en el log
    if (req.user && req.user._id) {
      await logService.createLog(
        LogOperation.UPDATE,
        LogCollectionType.SALE,
        (sale._id as mongoose.Types.ObjectId).toString(),
        req.user._id.toString(),
        {
          correlative: sale.correlative,
          documentType: sale.documentType,
          documentNumber: sale.documentNumber,
          updatedFields: Object.keys(req.body)
        }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      data: updatedSale
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error al actualizar venta:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar venta'
    });
  }
};

/**
 * @desc    Eliminar venta (soft delete)
 * @route   DELETE /api/sales/:id
 * @access  Private
 */
export const deleteSale = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sale = await Sale.findById(req.params.id)
      .populate('items.product');

    if (!sale || sale.isDeleted) {
      res.status(404).json({
        success: false,
        message: 'Venta no encontrada'
      });
      return;
    }

    // Restaurar stock de productos usando el servicio
    for (const item of sale.items) {
      const product = item.product as any;
      await stockService.updateStock(product._id, item.quantity);
    }

    // Si viene de una cotización, actualizar su estado
    if (sale.quotationRef) {
      await Quotation.findByIdAndUpdate(
        sale.quotationRef,
        { status: QuotationStatus.APPROVED }
      );
    }

    // Soft delete
    sale.isDeleted = true;
    await sale.save();

    // Registrar en el log
    if (req.user && req.user._id) {
      await logService.createLog(
        LogOperation.DELETE,
        LogCollectionType.SALE,
        (sale._id as mongoose.Types.ObjectId).toString(),
        req.user._id.toString(),
        {
          correlative: sale.correlative,
          documentType: sale.documentType,
          documentNumber: sale.documentNumber
        }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error al eliminar venta:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al eliminar venta'
    });
  }
};

/**
 * @desc    Obtener ventas por período
 * @route   POST /api/sales/period
 * @access  Private
 */
export const getSalesByPeriod = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'Se requieren fechas de inicio y fin'
      });
      return;
    }

    const sales = await Sale.find({
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      isDeleted: false
    })
      .populate('client', 'name rut')
      .populate('seller', 'name')
      .sort({ date: 1 });

    // Calcular totales
    const summary = {
      totalSales: sales.length,
      totalAmount: sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
      totalNetAmount: sales.reduce((sum, sale) => sum + sale.netAmount, 0),
      totalTaxAmount: sales.reduce((sum, sale) => sum + sale.taxAmount, 0),
      byDocumentType: {
        [DocumentType.INVOICE]: {
          count: 0,
          amount: 0
        },
        [DocumentType.RECEIPT]: {
          count: 0,
          amount: 0
        }
      }
    };

    // Agrupar por tipo de documento
    sales.forEach(sale => {
      summary.byDocumentType[sale.documentType].count++;
      summary.byDocumentType[sale.documentType].amount += sale.totalAmount;
    });

    res.status(200).json({
      success: true,
      data: {
        sales,
        summary
      }
    });
  } catch (error: any) {
    console.error('Error al obtener ventas por período:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al obtener ventas por período'
    });
  }
};

/**
 * @desc    Obtener ventas por cliente
 * @route   GET /api/sales/client/:clientId
 * @access  Private
 */
export const getSalesByClient = async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = req.params.clientId;

    // Verificar que el cliente exista
    const client = await Contact.findById(clientId);
    if (!client) {
      res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
      return;
    }

    const sales = await Sale.find({
      client: clientId,
      isDeleted: false
    })
      .populate('seller', 'name')
      .populate('items.product', 'name')
      .sort({ date: -1 });

    // Calcular estadísticas
    const statistics = {
      totalSales: sales.length,
      totalAmount: sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
      averageAmount: sales.length > 0 ? sales.reduce((sum, sale) => sum + sale.totalAmount, 0) / sales.length : 0,
      firstPurchase: sales.length > 0 ? sales[sales.length - 1].date : null,
      lastPurchase: sales.length > 0 ? sales[0].date : null
    };

    res.status(200).json({
      success: true,
      count: sales.length,
      data: {
        client,
        sales,
        statistics
      }
    });
  } catch (error: any) {
    console.error('Error al obtener ventas por cliente:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al obtener ventas por cliente'
    });
  }
};

/**
 * @desc    Generar documento PDF (boleta/factura)
 * @route   GET /api/sales/:id/pdf
 * @access  Private
 */
export const generateInvoicePDF = async (req: Request, res: Response): Promise<void> => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('client', 'name rut address phone email')
      .populate('seller', 'name')
      .populate('items.product', 'name description');

    if (!sale || sale.isDeleted) {
      res.status(404).json({
        success: false,
        message: 'Venta no encontrada'
      });
      return;
    }

    // Aquí iría la lógica para generar el PDF
    // Por ahora, solo devolvemos la información que incluiríamos en el PDF

    const documentData = {
      sale,
      companyInfo: {
        name: 'Fungus SpA',
        rut: '76.123.456-7',
        address: 'Santiago, Chile',
        phone: '+56 9 1234 5678',
        email: 'contacto@fungus.cl'
      },
      generatedAt: new Date()
    };

    res.status(200).json({
      success: true,
      message: 'En un sistema real, aquí generaríamos el PDF',
      data: documentData
    });
  } catch (error: any) {
    console.error('Error al generar PDF:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al generar PDF'
    });
  }
}; 