import { Request, Response } from 'express';
import { Product } from '../models/Item';
import logService from '../services/logService';
import { LogOperation, LogCollectionType } from '../models/Log';
import mongoose from 'mongoose';
import '../types/custom'; // Importamos los tipos personalizados

/**
 * @desc    Obtener todos los productos
 * @route   GET /api/products
 * @access  Public
 */
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    // Filtrar para mostrar solo productos activos (no eliminados)
    const products = await Product.find({ isDeleted: false });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error: any) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener productos'
    });
  }
};

/**
 * @desc    Obtener un producto por ID
 * @route   GET /api/products/:id
 * @access  Public
 */
export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error: any) {
    console.error(`Error al obtener producto ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener producto'
    });
  }
};

/**
 * @desc    Crear un nuevo producto
 * @route   POST /api/products
 * @access  Private
 */
export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.create(req.body);

    // Crear log de la operación
    if (req.user && req.user._id) {
      const productId = product._id.toString();
      const userId = req.user._id.toString();

      await logService.createLog(
        LogOperation.CREATE,
        LogCollectionType.PRODUCT,
        productId,
        userId,
        {
          productName: product.get('name'),
          productData: req.body
        }
      );
    }

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error: any) {
    console.error('Error al crear producto:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al crear producto'
    });
  }
};

/**
 * @desc    Actualizar un producto
 * @route   PUT /api/products/:id
 * @access  Private
 */
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
      return;
    }

    // Crear log de la operación
    if (req.user && req.user._id) {
      const productId = product._id.toString();
      const userId = req.user._id.toString();

      await logService.createLog(
        LogOperation.UPDATE,
        LogCollectionType.PRODUCT,
        productId,
        userId,
        {
          productName: product.get('name'),
          changes: req.body
        }
      );
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error: any) {
    console.error(`Error al actualizar producto ${req.params.id}:`, error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar producto'
    });
  }
};

/**
 * @desc    Eliminar un producto (borrado lógico)
 * @route   DELETE /api/products/:id
 * @access  Private
 */
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
      return;
    }

    // Guardamos la información del producto antes de marcarlo como eliminado
    const productId = product._id.toString();
    const productName = product.get('name');

    // Borrado lógico: actualizar flag en vez de eliminar físicamente
    await Product.findByIdAndUpdate(req.params.id, { isDeleted: true });

    // Crear log de la operación
    if (req.user && req.user._id) {
      const userId = req.user._id.toString();

      await logService.createLog(
        LogOperation.DELETE,
        LogCollectionType.PRODUCT,
        productId,
        userId,
        { productName }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Producto eliminado correctamente'
    });
  } catch (error: any) {
    console.error(`Error al eliminar producto ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al eliminar producto'
    });
  }
}; 