import { Request, Response } from 'express';
import { Consumable } from '../models/Item';
import logService from '../services/logService';
import { LogOperation, LogCollectionType } from '../models/Log';
import '../types/custom'; // Importamos los tipos personalizados

/**
 * @desc    Obtener todos los consumibles
 * @route   GET /api/consumables
 * @access  Public
 */
export const getConsumables = async (req: Request, res: Response): Promise<void> => {
  try {
    // Filtrar para mostrar solo consumibles activos (no eliminados)
    const consumables = await Consumable.find({ isDeleted: false });

    res.status(200).json({
      success: true,
      count: consumables.length,
      data: consumables
    });
  } catch (error: any) {
    console.error('Error al obtener consumibles:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener consumibles'
    });
  }
};

/**
 * @desc    Obtener un consumible por ID
 * @route   GET /api/consumables/:id
 * @access  Public
 */
export const getConsumableById = async (req: Request, res: Response): Promise<void> => {
  try {
    const consumable = await Consumable.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!consumable) {
      res.status(404).json({
        success: false,
        message: 'Consumible no encontrado'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: consumable
    });
  } catch (error: any) {
    console.error(`Error al obtener consumible ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener consumible'
    });
  }
};

/**
 * @desc    Crear un nuevo consumible
 * @route   POST /api/consumables
 * @access  Private
 */
export const createConsumable = async (req: Request, res: Response): Promise<void> => {
  try {
    const consumable = await Consumable.create(req.body);

    // Crear log de la operación
    if (req.user && req.user._id) {
      const consumableId = consumable._id.toString();
      const userId = req.user._id.toString();

      await logService.createLog(
        LogOperation.CREATE,
        LogCollectionType.CONSUMABLE,
        consumableId,
        userId,
        {
          consumableName: consumable.get('name'),
          consumableData: req.body
        }
      );
    }

    res.status(201).json({
      success: true,
      data: consumable
    });
  } catch (error: any) {
    console.error('Error al crear consumible:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al crear consumible'
    });
  }
};

/**
 * @desc    Actualizar un consumible
 * @route   PUT /api/consumables/:id
 * @access  Private
 */
export const updateConsumable = async (req: Request, res: Response): Promise<void> => {
  try {
    const consumable = await Consumable.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!consumable) {
      res.status(404).json({
        success: false,
        message: 'Consumible no encontrado'
      });
      return;
    }

    // Crear log de la operación
    if (req.user && req.user._id) {
      const consumableId = consumable._id.toString();
      const userId = req.user._id.toString();

      await logService.createLog(
        LogOperation.UPDATE,
        LogCollectionType.CONSUMABLE,
        consumableId,
        userId,
        {
          consumableName: consumable.get('name'),
          changes: req.body
        }
      );
    }

    res.status(200).json({
      success: true,
      data: consumable
    });
  } catch (error: any) {
    console.error(`Error al actualizar consumible ${req.params.id}:`, error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar consumible'
    });
  }
};

/**
 * @desc    Eliminar un consumible (borrado lógico)
 * @route   DELETE /api/consumables/:id
 * @access  Private
 */
export const deleteConsumable = async (req: Request, res: Response): Promise<void> => {
  try {
    const consumable = await Consumable.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!consumable) {
      res.status(404).json({
        success: false,
        message: 'Consumible no encontrado'
      });
      return;
    }

    // Guardamos la información del consumible antes de marcarlo como eliminado
    const consumableId = consumable._id.toString();
    const consumableName = consumable.get('name');

    // Borrado lógico: actualizar flag en vez de eliminar físicamente
    await Consumable.findByIdAndUpdate(req.params.id, { isDeleted: true });

    // Crear log de la operación
    if (req.user && req.user._id) {
      const userId = req.user._id.toString();

      await logService.createLog(
        LogOperation.DELETE,
        LogCollectionType.CONSUMABLE,
        consumableId,
        userId,
        { consumableName }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Consumible eliminado correctamente'
    });
  } catch (error: any) {
    console.error(`Error al eliminar consumible ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al eliminar consumible'
    });
  }
}; 