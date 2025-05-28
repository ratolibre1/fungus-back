import { Request, Response } from 'express';
import quotationService from '../services/quotationService';
import { TransactionStatus } from '../models/Transaction';

/**
 * @desc    Crear una nueva cotización
 * @route   POST /api/quotations
 * @access  Private
 */
export const createQuotation = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verificar que el usuario está autenticado (middleware protect ya lo garantiza)
    if (!req.user?._id) {
      res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
      return;
    }

    // Crear la cotización
    const quotation = await quotationService.createQuotation(req.body, req.user._id.toString());

    res.status(201).json({
      success: true,
      data: quotation
    });
  } catch (error: any) {
    console.error('Error al crear cotización:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al crear cotización'
    });
  }
};

/**
 * @desc    Obtener todas las cotizaciones con paginación y filtros
 * @route   GET /api/quotations
 * @access  Private
 */
export const getQuotations = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extraer parámetros de consulta
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

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

    // Obtener cotizaciones paginadas con filtros
    const result = await quotationService.getQuotations(page, limit, filters);

    res.status(200).json({
      success: true,
      count: result.quotations.length,
      pagination: result.pagination,
      data: result.quotations
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
    const quotation = await quotationService.getQuotationById(req.params.id);

    if (!quotation) {
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
 * @desc    Actualizar una cotización
 * @route   PUT /api/quotations/:id
 * @access  Private
 */
export const updateQuotation = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verificar que el usuario está autenticado
    if (!req.user?._id) {
      res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
      return;
    }

    const quotation = await quotationService.updateQuotation(
      req.params.id,
      req.body,
      req.user._id.toString()
    );

    if (!quotation) {
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
    console.error('Error al actualizar cotización:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar cotización'
    });
  }
};

/**
 * @desc    Eliminar una cotización (borrado lógico)
 * @route   DELETE /api/quotations/:id
 * @access  Private
 */
export const deleteQuotation = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verificar que el usuario está autenticado
    if (!req.user?._id) {
      res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
      return;
    }

    const quotation = await quotationService.deleteQuotation(
      req.params.id,
      req.user._id.toString()
    );

    if (!quotation) {
      res.status(404).json({
        success: false,
        message: 'Cotización no encontrada'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Cotización eliminada correctamente'
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
 * @desc    Cambiar el estado de una cotización
 * @route   PATCH /api/quotations/:id/status
 * @access  Private
 */
export const changeQuotationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verificar que el usuario está autenticado
    if (!req.user?._id) {
      res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
      return;
    }

    // Verificar que se proporciona un estado válido
    const { status } = req.body;

    if (!status || !Object.values(TransactionStatus).includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Estado inválido'
      });
      return;
    }

    const quotation = await quotationService.changeQuotationStatus(
      req.params.id,
      status,
      req.user._id.toString()
    );

    if (!quotation) {
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
    console.error('Error al cambiar estado de cotización:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al cambiar estado de cotización'
    });
  }
};

/**
 * @desc    Preview de cálculo de cotización (sin guardar)
 * @route   POST /api/quotations/preview
 * @access  Private
 */
export const previewQuotationCalculation = async (req: Request, res: Response): Promise<void> => {
  try {
    // Obtener el preview de cálculo
    const preview = await quotationService.previewQuotationCalculation(req.body);

    res.status(200).json({
      success: true,
      data: preview
    });
  } catch (error: any) {
    console.error('Error al calcular preview de cotización:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al calcular preview de cotización'
    });
  }
};

export default {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotation,
  deleteQuotation,
  changeQuotationStatus,
  previewQuotationCalculation
}; 