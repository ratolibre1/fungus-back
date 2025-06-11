import { Request, Response } from 'express';
import purchaseService from '../services/purchaseService';

/**
 * @desc    Crear una nueva compra
 * @route   POST /api/purchases
 * @access  Private
 */
export const createPurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verificar que el usuario está autenticado (middleware protect ya lo garantiza)
    if (!req.user?._id) {
      res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
      return;
    }

    // Crear la compra
    const purchase = await purchaseService.createPurchase(req.body, req.user._id.toString());

    res.status(201).json({
      success: true,
      data: purchase
    });
  } catch (error: any) {
    console.error('Error al crear compra:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al crear compra'
    });
  }
};

/**
 * @desc    Obtener todas las compras con paginación y filtros
 * @route   GET /api/purchases
 * @access  Private
 */
export const getPurchases = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extraer parámetros de consulta
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    // Construir objeto de filtros
    const filters: any = {};

    // Filtro por estado
    if (req.query.status) {
      filters.status = req.query.status;
    }

    // Filtro por proveedor/contraparte
    if (req.query.counterparty) {
      filters.counterparty = req.query.counterparty;
    }

    // Filtro por usuario
    if (req.query.user) {
      filters.user = req.query.user;
    }

    // Filtro por rango de fechas
    if (req.query.startDate) {
      console.log('📅 startDate recibido:', req.query.startDate);
      filters.startDate = req.query.startDate;
    }

    if (req.query.endDate) {
      console.log('📅 endDate recibido:', req.query.endDate);
      filters.endDate = req.query.endDate;
    }

    // Filtro por monto
    if (req.query.minAmount) {
      filters.minAmount = req.query.minAmount;
    }

    if (req.query.maxAmount) {
      filters.maxAmount = req.query.maxAmount;
    }

    // Parámetros de ordenamiento
    if (req.query.sort) {
      filters.sort = req.query.sort;
      console.log('📊 Campo de ordenamiento:', req.query.sort);
    }

    if (req.query.order) {
      filters.order = req.query.order;
      console.log('📊 Orden:', req.query.order);
    }

    // Incluir eliminados (solo para admins)
    if (req.query.includeDeleted === 'true' && req.user?.role === 'admin') {
      filters.includeDeleted = true;
    }

    // Obtener compras paginadas con filtros
    const result = await purchaseService.getPurchases(page, limit, filters);

    res.status(200).json({
      success: true,
      count: result.purchases.length,
      pagination: result.pagination,
      data: result.purchases
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
    const purchase = await purchaseService.getPurchaseById(req.params.id);

    if (!purchase) {
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
 * @desc    Actualizar una compra
 * @route   PUT /api/purchases/:id
 * @access  Private
 */
export const updatePurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verificar que el usuario está autenticado
    if (!req.user?._id) {
      res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
      return;
    }

    const purchase = await purchaseService.updatePurchase(
      req.params.id,
      req.body,
      req.user._id.toString()
    );

    if (!purchase) {
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
    console.error('Error al actualizar compra:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar compra'
    });
  }
};

/**
 * @desc    Eliminar una compra (borrado lógico)
 * @route   DELETE /api/purchases/:id
 * @access  Private
 */
export const deletePurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verificar que el usuario está autenticado
    if (!req.user?._id) {
      res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
      return;
    }

    const purchase = await purchaseService.deletePurchase(
      req.params.id,
      req.user._id.toString()
    );

    if (!purchase) {
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
    console.error('Error al eliminar compra:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al eliminar compra'
    });
  }
};

/**
 * @desc    Cambiar el estado de una compra
 * @route   PATCH /api/purchases/:id/status
 * @access  Private
 */
export const changePurchaseStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verificar que el usuario está autenticado
    if (!req.user?._id) {
      res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
      return;
    }

    const { status } = req.body;

    if (!status) {
      res.status(400).json({
        success: false,
        message: 'El estado es requerido'
      });
      return;
    }

    const purchase = await purchaseService.changePurchaseStatus(
      req.params.id,
      status,
      req.user._id.toString()
    );

    if (!purchase) {
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
    console.error('Error al cambiar estado de compra:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al cambiar estado de compra'
    });
  }
};

/**
 * @desc    Preview de cálculo de compra
 * @route   POST /api/purchases/preview
 * @access  Private
 */
export const previewPurchaseCalculation = async (req: Request, res: Response): Promise<void> => {
  try {
    const preview = await purchaseService.previewPurchaseCalculation(req.body);

    res.status(200).json({
      success: true,
      data: preview
    });
  } catch (error: any) {
    console.error('Error en preview de compra:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al generar preview de compra'
    });
  }
}; 