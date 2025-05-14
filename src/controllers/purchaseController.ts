import { Request, Response } from 'express';
import Purchase, { PurchaseDocumentType, IPurchase } from '../models/Purchase';
import Contact from '../models/Client';
import Item from '../models/Item';
import logService from '../services/logService';
import { LogOperation, LogCollectionType } from '../models/Log';
import mongoose from 'mongoose';
import '../types/custom';

/**
 * @desc    Obtener todas las compras
 * @route   GET /api/purchases
 * @access  Private
 */
export const getPurchases = async (req: Request, res: Response): Promise<void> => {
  try {
    // Filtrar para mostrar solo compras activas (no eliminadas)
    const purchases = await Purchase.find({ isDeleted: false })
      .populate('supplier', 'name rut')
      .populate('user', 'name email')
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: purchases.length,
      data: purchases
    });
  } catch (error: any) {
    console.error('Error al obtener compras:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener compras'
    });
  }
};

/**
 * @desc    Obtener una compra por ID
 * @route   GET /api/purchases/:id
 * @access  Private
 */
export const getPurchaseById = async (req: Request, res: Response): Promise<void> => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('supplier', 'name rut email phone address')
      .populate('user', 'name email');

    if (!purchase || purchase.isDeleted) {
      res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: purchase
    });
  } catch (error: any) {
    console.error('Error al obtener compra:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener compra'
    });
  }
};

/**
 * @desc    Crear nueva compra
 * @route   POST /api/purchases
 * @access  Private
 */
export const createPurchase = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validar que el proveedor exista y sea proveedor
    const supplier = await Contact.findById(req.body.supplier);
    if (!supplier || !supplier.isSupplier) {
      res.status(400).json({
        success: false,
        message: 'Proveedor no válido'
      });
      return;
    }

    // Obtener el último número correlativo
    const lastPurchase = await Purchase.findOne({}).sort({ number: -1 });
    const number = lastPurchase ? lastPurchase.number + 1 : 1;

    // Crear la compra
    const purchase = await Purchase.create({
      ...req.body,
      number,
      user: req.user?._id // Asignar al usuario actual
    });

    // Si hay productos relacionados con los items, actualizar stock
    for (const item of req.body.items) {
      if (item.productId) {
        await Item.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: item.quantity } }
        );
      }
    }

    // Registrar en el log
    if (req.user && req.user._id) {
      await logService.createLog(
        LogOperation.CREATE,
        LogCollectionType.PURCHASE,
        (purchase._id as mongoose.Types.ObjectId).toString(),
        req.user._id.toString(),
        {
          supplierName: supplier.name,
          number,
          documentType: purchase.documentType,
          documentNumber: purchase.documentNumber,
          totalAmount: purchase.totalAmount
        }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: purchase
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error al crear compra:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al crear compra'
    });
  }
};

/**
 * @desc    Actualizar compra
 * @route   PUT /api/purchases/:id
 * @access  Private
 */
export const updatePurchase = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Encontrar la compra a actualizar
    const purchase = await Purchase.findById(req.params.id);

    if (!purchase || purchase.isDeleted) {
      res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
      return;
    }

    // Validar que no se cambien datos críticos
    if (req.body.number && req.body.number !== purchase.number) {
      res.status(400).json({
        success: false,
        message: 'No se puede modificar el número de compra'
      });
      return;
    }

    // Si se modifican los items y hay productos relacionados, ajustar el stock
    if (req.body.items) {
      // Aquí iría lógica para ajustar stock si es necesario
      // Depende de cómo se maneje la relación entre items de compra y productos
    }

    // Actualizar la compra
    const updatedPurchase = await Purchase.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );

    // Registrar en el log
    if (req.user && req.user._id) {
      await logService.createLog(
        LogOperation.UPDATE,
        LogCollectionType.PURCHASE,
        (purchase._id as mongoose.Types.ObjectId).toString(),
        req.user._id.toString(),
        {
          number: purchase.number,
          documentType: purchase.documentType,
          documentNumber: purchase.documentNumber,
          updatedFields: Object.keys(req.body)
        }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      data: updatedPurchase
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error al actualizar compra:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar compra'
    });
  }
};

/**
 * @desc    Eliminar compra (soft delete)
 * @route   DELETE /api/purchases/:id
 * @access  Private
 */
export const deletePurchase = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchase = await Purchase.findById(req.params.id);

    if (!purchase || purchase.isDeleted) {
      res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
      return;
    }

    // Ajustar stock si es necesario
    // Aquí iría lógica para revertir cambios en stock, si aplica

    // Soft delete
    purchase.isDeleted = true;
    await purchase.save();

    // Registrar en el log
    if (req.user && req.user._id) {
      await logService.createLog(
        LogOperation.DELETE,
        LogCollectionType.PURCHASE,
        (purchase._id as mongoose.Types.ObjectId).toString(),
        req.user._id.toString(),
        {
          number: purchase.number,
          documentType: purchase.documentType,
          documentNumber: purchase.documentNumber
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

    console.error('Error al eliminar compra:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al eliminar compra'
    });
  }
};

/**
 * @desc    Obtener compras por proveedor
 * @route   GET /api/purchases/supplier/:supplierId
 * @access  Private
 */
export const getPurchasesBySupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const supplierId = req.params.supplierId;

    // Verificar que el proveedor exista
    const supplier = await Contact.findById(supplierId);
    if (!supplier || !supplier.isSupplier) {
      res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
      return;
    }

    const purchases = await Purchase.find({
      supplier: supplierId,
      isDeleted: false
    })
      .populate('user', 'name')
      .sort({ date: -1 });

    // Calcular estadísticas
    const statistics = {
      totalPurchases: purchases.length,
      totalAmount: purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0),
      averageAmount: purchases.length > 0 ? purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0) / purchases.length : 0,
      firstPurchase: purchases.length > 0 ? purchases[purchases.length - 1].date : null,
      lastPurchase: purchases.length > 0 ? purchases[0].date : null
    };

    res.status(200).json({
      success: true,
      count: purchases.length,
      data: {
        supplier,
        purchases,
        statistics
      }
    });
  } catch (error: any) {
    console.error('Error al obtener compras por proveedor:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al obtener compras por proveedor'
    });
  }
};

/**
 * @desc    Obtener gastos por categoría en un período
 * @route   POST /api/purchases/expenses
 * @access  Private
 */
export const getExpensesByCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, categories } = req.body;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'Se requieren fechas de inicio y fin'
      });
      return;
    }

    // Construir filtro
    const filter: any = {
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      isDeleted: false
    };

    // Filtrar por categorías si se especifican
    if (categories && categories.length > 0) {
      filter.description = { $in: categories };
    }

    const purchases = await Purchase.find(filter)
      .populate('supplier', 'name')
      .sort({ date: 1 });

    // Agrupar por descripción (categoría)
    const categorySummary: { [key: string]: { count: number, amount: number } } = {};

    purchases.forEach(purchase => {
      const category = purchase.description;

      if (!categorySummary[category]) {
        categorySummary[category] = {
          count: 0,
          amount: 0
        };
      }

      categorySummary[category].count++;
      categorySummary[category].amount += purchase.totalAmount;
    });

    // Calcular totales
    const summary = {
      totalExpenses: purchases.length,
      totalAmount: purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0),
      categories: categorySummary
    };

    res.status(200).json({
      success: true,
      data: {
        purchases,
        summary
      }
    });
  } catch (error: any) {
    console.error('Error al obtener gastos por categoría:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al obtener gastos por categoría'
    });
  }
}; 