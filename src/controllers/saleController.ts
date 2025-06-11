import { Request, Response } from 'express';
import saleService from '../services/saleService';
import { TransactionStatus } from '../models/Transaction';

/**
 * @desc    Crear una nueva venta
 * @route   POST /api/sales
 * @access  Private
 */
export const createSale = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verificar que el usuario está autenticado (middleware protect ya lo garantiza)
    if (!req.user?._id) {
      res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
      return;
    }

    // Crear la venta
    const sale = await saleService.createSale(req.body, req.user._id.toString());

    res.status(201).json({
      success: true,
      data: sale
    });
  } catch (error: any) {
    console.error('Error al crear venta:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al crear venta'
    });
  }
};

/**
 * @desc    Obtener todas las ventas con paginación y filtros
 * @route   GET /api/sales
 * @access  Private
 */
export const getSales = async (req: Request, res: Response): Promise<void> => {
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

    // Filtro por cliente/contraparte
    if (req.query.counterparty) {
      filters.counterparty = req.query.counterparty;
    }

    // Filtro por usuario
    if (req.query.user) {
      filters.user = req.query.user;
    }

    // Filtro por cotización relacionada
    if (req.query.relatedQuotation) {
      filters.relatedQuotation = req.query.relatedQuotation;
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

    // Obtener ventas paginadas con filtros
    const result = await saleService.getSales(page, limit, filters);

    res.status(200).json({
      success: true,
      count: result.sales.length,
      pagination: result.pagination,
      data: result.sales
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
    const sale = await saleService.getSaleById(req.params.id);

    if (!sale) {
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
 * @desc    Actualizar una venta
 * @route   PUT /api/sales/:id
 * @access  Private
 */
export const updateSale = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verificar que el usuario está autenticado
    if (!req.user?._id) {
      res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
      return;
    }

    const sale = await saleService.updateSale(
      req.params.id,
      req.body,
      req.user._id.toString()
    );

    if (!sale) {
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
    console.error('Error al actualizar venta:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar venta'
    });
  }
};

/**
 * @desc    Eliminar una venta (borrado lógico)
 * @route   DELETE /api/sales/:id
 * @access  Private
 */
export const deleteSale = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verificar que el usuario está autenticado
    if (!req.user?._id) {
      res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
      return;
    }

    const sale = await saleService.deleteSale(req.params.id, req.user._id.toString());

    if (!sale) {
      res.status(404).json({
        success: false,
        message: 'Venta no encontrada'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Venta eliminada correctamente',
      data: sale
    });
  } catch (error: any) {
    console.error('Error al eliminar venta:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al eliminar venta'
    });
  }
};

/**
 * @desc    Cambiar el estado de una venta
 * @route   PATCH /api/sales/:id/status
 * @access  Private
 */
export const changeSaleStatus = async (req: Request, res: Response): Promise<void> => {
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

    // Validar que el estado es válido
    const validStatuses = ['pending', 'invoiced', 'paid', 'rejected'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Estado no válido'
      });
      return;
    }

    const sale = await saleService.changeSaleStatus(
      req.params.id,
      status,
      req.user._id.toString()
    );

    if (!sale) {
      res.status(404).json({
        success: false,
        message: 'Venta no encontrada'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Estado de venta actualizado a ${status}`,
      data: sale
    });
  } catch (error: any) {
    console.error('Error al cambiar estado de venta:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al cambiar estado de venta'
    });
  }
};

/**
 * @desc    Preview de cálculo de venta (sin guardar en BD)
 * @route   POST /api/sales/preview
 * @access  Private
 */
export const previewSaleCalculation = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await saleService.previewSaleCalculation(req.body);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Error en preview de venta:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error en preview de venta'
    });
  }
};

/**
 * @desc    Convertir cotización a venta
 * @route   POST /api/sales/convert/:quotationId
 * @access  Private
 */
export const convertQuotationToSale = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verificar que el usuario está autenticado
    if (!req.user?._id) {
      res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
      return;
    }

    const sale = await saleService.convertQuotationToSale(
      req.params.quotationId,
      req.user._id.toString()
    );

    res.status(201).json({
      success: true,
      message: 'Cotización convertida a venta exitosamente',
      data: sale
    });
  } catch (error: any) {
    console.error('Error al convertir cotización a venta:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al convertir cotización a venta'
    });
  }
}; 