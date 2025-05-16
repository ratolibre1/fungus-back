import { Request, Response } from 'express';
import menuService from '../services/menuService';

/**
 * @desc    Obtener todos los elementos de menú
 * @route   GET /api/menu
 * @access  Public
 */
export const getAllMenuItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItems = await menuService.getAllMenuItems();

    res.status(200).json({
      success: true,
      count: menuItems.length,
      data: menuItems
    });
  } catch (error: any) {
    console.error('Error al obtener elementos de menú:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener elementos de menú'
    });
  }
};

/**
 * @desc    Obtener el menú filtrado por el rol del usuario actual
 * @route   GET /api/menu/my-menu
 * @access  Private
 */
export const getMyMenu = async (req: Request, res: Response): Promise<void> => {
  try {
    // Obtenemos el rol del usuario desde el objeto de usuario en la solicitud
    // (añadido por el middleware 'protect')
    const role = req.user?.role || 'user';

    // Obtenemos los elementos del menú disponibles para ese rol
    const menuItems = await menuService.getMenuItemsByRole(role);

    res.status(200).json({
      success: true,
      count: menuItems.length,
      data: menuItems
    });
  } catch (error: any) {
    console.error('Error al obtener menú del usuario:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener menú del usuario'
    });
  }
};

/**
 * @desc    Obtener un elemento de menú por nombre
 * @route   GET /api/menu/:name
 * @access  Private (admin)
 */
export const getMenuItemByName = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItem = await menuService.getMenuItemByName(req.params.name);

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: `No se encontró un elemento de menú con el nombre ${req.params.name}`
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: menuItem
    });
  } catch (error: any) {
    console.error('Error al obtener elemento de menú:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener elemento de menú'
    });
  }
};

/**
 * @desc    Crear un nuevo elemento de menú
 * @route   POST /api/menu
 * @access  Private (admin)
 */
export const createMenuItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItem = await menuService.createMenuItem(req.body);

    res.status(201).json({
      success: true,
      data: menuItem
    });
  } catch (error: any) {
    console.error('Error al crear elemento de menú:', error);

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
      message: error.message || 'Error al crear elemento de menú'
    });
  }
};

/**
 * @desc    Actualizar un elemento de menú existente
 * @route   PATCH /api/menu/:name
 * @access  Private (admin)
 */
export const updateMenuItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;

    const menuItem = await menuService.updateMenuItem(name, req.body);

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: `No se encontró un elemento de menú con el nombre ${name}`
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: menuItem
    });
  } catch (error: any) {
    console.error('Error al actualizar elemento de menú:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al actualizar elemento de menú'
    });
  }
};

/**
 * @desc    Activar o desactivar un elemento del menú
 * @route   PATCH /api/menu/:name/toggle-active
 * @access  Private (admin)
 */
export const toggleItemActive = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    const { isActive } = req.body;

    if (isActive === undefined) {
      res.status(400).json({
        success: false,
        message: 'Se requiere el parámetro isActive'
      });
      return;
    }

    const menuItem = await menuService.toggleItemActive(name, isActive);

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: `No se encontró un elemento de menú con el nombre ${name}`
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: menuItem
    });
  } catch (error: any) {
    console.error('Error al cambiar estado del elemento:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al cambiar estado del elemento'
    });
  }
};

/**
 * @desc    Eliminar un elemento de menú
 * @route   DELETE /api/menu/:name
 * @access  Private (admin)
 */
export const deleteMenuItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItem = await menuService.deleteMenuItem(req.params.name);

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: `No se encontró un elemento de menú con el nombre ${req.params.name}`
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Elemento de menú eliminado correctamente',
      data: {}
    });
  } catch (error: any) {
    console.error('Error al eliminar elemento de menú:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al eliminar elemento de menú'
    });
  }
};

/**
 * @desc    Inicializar menú del sistema
 * @route   POST /api/menu/initialize
 * @access  Private (admin)
 */
export const initializeMenu = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItems = await menuService.initializeMenu();

    res.status(200).json({
      success: true,
      message: 'Menú inicializado correctamente',
      count: menuItems.length,
      data: menuItems
    });
  } catch (error: any) {
    console.error('Error al inicializar menú:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al inicializar menú'
    });
  }
}; 