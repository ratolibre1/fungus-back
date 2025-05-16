import { Request, Response } from 'express';
import moduleService from '../services/moduleService';
import { IModule } from '../models/Module';

/**
 * @desc    Obtener todos los módulos
 * @route   GET /api/modules
 * @access  Private (admin)
 */
export const getAllModules = async (req: Request, res: Response): Promise<void> => {
  try {
    const modules = await moduleService.getAllModules();

    res.status(200).json({
      success: true,
      count: modules.length,
      data: modules
    });
  } catch (error: any) {
    console.error('Error al obtener módulos:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener módulos'
    });
  }
};

/**
 * @desc    Obtener los módulos accesibles para el usuario actual
 * @route   GET /api/modules/my-modules
 * @access  Private
 */
export const getMyModules = async (req: Request, res: Response): Promise<void> => {
  try {
    // Obtenemos el rol del usuario desde el objeto de usuario en la solicitud
    // (añadido por el middleware 'protect')
    const role = req.user?.role || 'user';

    // Obtenemos los módulos disponibles para ese rol
    const modules = await moduleService.getModulesByRole(role);

    res.status(200).json({
      success: true,
      count: modules.length,
      data: modules
    });
  } catch (error: any) {
    console.error('Error al obtener módulos del usuario:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener módulos del usuario'
    });
  }
};

/**
 * @desc    Obtener un módulo por ID
 * @route   GET /api/modules/:id
 * @access  Private (admin)
 */
export const getModuleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const module = await moduleService.getModuleById(req.params.id);

    if (!module) {
      res.status(404).json({
        success: false,
        message: 'Módulo no encontrado'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: module
    });
  } catch (error: any) {
    console.error('Error al obtener el módulo:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener el módulo'
    });
  }
};

/**
 * @desc    Crear un nuevo módulo
 * @route   POST /api/modules
 * @access  Private (admin)
 */
export const createModule = async (req: Request, res: Response): Promise<void> => {
  try {
    const module = await moduleService.createModule(req.body);

    res.status(201).json({
      success: true,
      data: module
    });
  } catch (error: any) {
    console.error('Error al crear el módulo:', error);

    // Si es un error de validación o duplicado
    if (error.name === 'ValidationError' || error.code === 11000) {
      res.status(400).json({
        success: false,
        message: error.message || 'Error de validación'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear el módulo'
    });
  }
};

/**
 * @desc    Actualizar un módulo existente
 * @route   PUT /api/modules/:id
 * @access  Private (admin)
 */
export const updateModule = async (req: Request, res: Response): Promise<void> => {
  try {
    const module = await moduleService.updateModule(req.params.id, req.body);

    if (!module) {
      res.status(404).json({
        success: false,
        message: 'Módulo no encontrado'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: module
    });
  } catch (error: any) {
    console.error('Error al actualizar el módulo:', error);

    // Si es un error de validación
    if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: error.message || 'Error de validación'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Error al actualizar el módulo'
    });
  }
};

/**
 * @desc    Cambiar estado de activación de un módulo
 * @route   PATCH /api/modules/:id/toggle-active
 * @access  Private (admin)
 */
export const toggleActiveState = async (req: Request, res: Response): Promise<void> => {
  try {
    const { isActive } = req.body;

    if (isActive === undefined) {
      res.status(400).json({
        success: false,
        message: 'Se requiere el parámetro isActive'
      });
      return;
    }

    const module = await moduleService.toggleActiveState(req.params.id, isActive);

    if (!module) {
      res.status(404).json({
        success: false,
        message: 'Módulo no encontrado'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: module
    });
  } catch (error: any) {
    console.error('Error al cambiar estado del módulo:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al cambiar estado del módulo'
    });
  }
};

/**
 * @desc    Cambiar visibilidad de un módulo
 * @route   PATCH /api/modules/:id/toggle-visibility
 * @access  Private (admin)
 */
export const toggleVisibility = async (req: Request, res: Response): Promise<void> => {
  try {
    const { isVisible } = req.body;

    if (isVisible === undefined) {
      res.status(400).json({
        success: false,
        message: 'Se requiere el parámetro isVisible'
      });
      return;
    }

    const module = await moduleService.toggleVisibility(req.params.id, isVisible);

    if (!module) {
      res.status(404).json({
        success: false,
        message: 'Módulo no encontrado'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: module
    });
  } catch (error: any) {
    console.error('Error al cambiar visibilidad del módulo:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al cambiar visibilidad del módulo'
    });
  }
};

/**
 * @desc    Eliminar un módulo
 * @route   DELETE /api/modules/:id
 * @access  Private (admin)
 */
export const deleteModule = async (req: Request, res: Response): Promise<void> => {
  try {
    const module = await moduleService.deleteModule(req.params.id);

    if (!module) {
      res.status(404).json({
        success: false,
        message: 'Módulo no encontrado'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Módulo eliminado correctamente',
      data: {}
    });
  } catch (error: any) {
    console.error('Error al eliminar el módulo:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al eliminar el módulo'
    });
  }
};

/**
 * @desc    Inicializar módulos del sistema
 * @route   POST /api/modules/initialize
 * @access  Private (admin)
 */
export const initializeModules = async (req: Request, res: Response): Promise<void> => {
  try {
    const modules = await moduleService.initializeModules();

    res.status(200).json({
      success: true,
      message: 'Módulos inicializados correctamente',
      count: modules.length,
      data: modules
    });
  } catch (error: any) {
    console.error('Error al inicializar módulos:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al inicializar módulos'
    });
  }
}; 