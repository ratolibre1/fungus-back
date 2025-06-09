import { Request, Response } from 'express';
import Contact, { IContact } from '../models/Client';
import logService from '../services/logService';
import { LogOperation, LogCollectionType } from '../models/Log';
import '../types/custom'; // Importamos los tipos personalizados
import mongoose from 'mongoose';

/**
 * @desc    Obtener todos los proveedores
 * @route   GET /api/suppliers
 * @access  Private
 */
export const getSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    // Filtrar para mostrar solo proveedores activos (no eliminados)
    const suppliers = await Contact.find({
      isDeleted: false,
      isSupplier: true
    }).sort('name');

    res.status(200).json({
      success: true,
      count: suppliers.length,
      data: suppliers
    });
  } catch (error: any) {
    console.error('Error al obtener proveedores:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener proveedores'
    });
  }
};

/**
 * @desc    Buscar proveedores por término
 * @route   GET /api/suppliers/search?term=TÉRMINO
 * @access  Private
 */
export const searchSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { term } = req.query;

    if (!term) {
      res.status(400).json({
        success: false,
        message: 'Por favor proporcione un término de búsqueda'
      });
      return;
    }

    // Busca por nombre (texto), RUT o email, sólo proveedores activos
    const suppliers = await Contact.find({
      $and: [
        { isDeleted: false },
        { isSupplier: true },
        {
          $or: [
            { name: { $regex: term, $options: 'i' } },
            { rut: { $regex: term, $options: 'i' } },
            { email: { $regex: term, $options: 'i' } }
          ]
        }
      ]
    }).sort('name');

    res.status(200).json({
      success: true,
      count: suppliers.length,
      data: suppliers
    });
  } catch (error: any) {
    console.error(`Error al buscar proveedores con término "${req.query.term}":`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al buscar proveedores'
    });
  }
};

/**
 * @desc    Obtener un proveedor por ID
 * @route   GET /api/suppliers/:id
 * @access  Private
 */
export const getSupplierById = async (req: Request, res: Response): Promise<void> => {
  try {
    const supplier = await Contact.findOne({
      _id: req.params.id,
      isDeleted: false,
      isSupplier: true
    });

    if (!supplier) {
      res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: supplier
    });
  } catch (error: any) {
    console.error(`Error al obtener proveedor ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener proveedor'
    });
  }
};

/**
 * @desc    Crear un nuevo proveedor
 * @route   POST /api/suppliers
 * @access  Private
 */
export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verificar si ya existe un contacto con el mismo RUT
    const existingContact = await Contact.findOne({ rut: req.body.rut });

    if (existingContact) {
      res.status(400).json({
        success: false,
        message: 'Ya existe un contacto con este RUT'
      });
      return;
    }

    // Asegurar que se guarda como proveedor y no requiere revisión
    const supplierData = {
      ...req.body,
      isSupplier: true,
      needsReview: false // Contactos creados por API no requieren revisión
    };

    const supplier = await Contact.create(supplierData) as IContact;

    // Crear log de la operación
    if (req.user && req.user._id) {
      const supplierId = (supplier as unknown as { _id: { toString(): string } })._id.toString();
      const userId = req.user._id.toString();

      await logService.createContactLog(
        LogOperation.CREATE,
        supplierId,
        userId,
        {
          name: supplier.name,
          rut: supplier.rut,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          isCustomer: supplier.isCustomer,
          isSupplier: supplier.isSupplier,
          needsReview: supplier.needsReview,
          operationType: 'SUPPLIER_CREATION',
          additionalData: {
            createdViaAPI: true,
            sourceController: 'supplierController',
            requestData: req.body
          }
        }
      );
    }

    res.status(201).json({
      success: true,
      data: supplier
    });
  } catch (error: any) {
    console.error('Error al crear proveedor:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al crear proveedor'
    });
  }
};

/**
 * @desc    Actualizar un proveedor
 * @route   PUT /api/suppliers/:id
 * @access  Private
 */
export const updateSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    // Si está actualizando el RUT, verificar que no exista otro contacto con ese RUT
    if (req.body.rut) {
      const existingContact = await Contact.findOne({
        rut: req.body.rut,
        _id: { $ne: req.params.id } // Excluir el contacto actual
      });

      if (existingContact) {
        res.status(400).json({
          success: false,
          message: 'Ya existe otro contacto con este RUT'
        });
        return;
      }
    }

    // Preparar datos para actualización (mantener isSupplier en true)
    const updateData = { ...req.body };
    updateData.isSupplier = true;

    // Obtener proveedor antes de la actualización para el log
    const oldSupplier = await Contact.findOne({
      _id: req.params.id,
      isSupplier: true,
      isDeleted: false
    }) as IContact | null;

    if (!oldSupplier) {
      res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
      return;
    }

    // Si el contacto fue marcado para revisión y está siendo actualizado por un usuario,
    // lo marcamos como revisado
    if (oldSupplier.needsReview) {
      updateData.needsReview = false;
    }

    // Actualizar proveedor
    const supplier = await Contact.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ) as IContact | null;

    if (!supplier) {
      res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado durante la actualización'
      });
      return;
    }

    // Crear log de la operación
    if (req.user && req.user._id) {
      const supplierId = (supplier as unknown as { _id: { toString(): string } })._id.toString();
      const userId = req.user._id.toString();

      await logService.createContactChangeLog(
        supplierId,
        userId,
        updateData,
        {
          name: oldSupplier.name,
          rut: oldSupplier.rut,
          email: oldSupplier.email,
          phone: oldSupplier.phone,
          address: oldSupplier.address,
          isCustomer: oldSupplier.isCustomer,
          isSupplier: oldSupplier.isSupplier,
          needsReview: oldSupplier.needsReview
        },
        {
          name: supplier.name,
          rut: supplier.rut,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          isCustomer: supplier.isCustomer,
          isSupplier: supplier.isSupplier,
          needsReview: supplier.needsReview
        }
      );
    }

    res.status(200).json({
      success: true,
      data: supplier
    });
  } catch (error: any) {
    console.error(`Error al actualizar proveedor ${req.params.id}:`, error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar proveedor'
    });
  }
};

/**
 * @desc    Eliminar un proveedor (soft delete)
 * @route   DELETE /api/suppliers/:id
 * @access  Private
 */
export const deleteSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const supplier = await Contact.findOne({
      _id: req.params.id,
      isSupplier: true,
      isDeleted: false
    });

    if (!supplier) {
      res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
      return;
    }

    // Soft delete
    supplier.isDeleted = true;
    await supplier.save();

    // Crear log de la operación
    if (req.user && req.user._id) {
      const supplierId = (supplier as unknown as { _id: { toString(): string } })._id.toString();
      const userId = req.user._id.toString();

      await logService.createContactDeletionLog(
        supplierId,
        userId,
        {
          name: supplier.name,
          rut: supplier.rut,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          isCustomer: supplier.isCustomer,
          isSupplier: supplier.isSupplier,
          needsReview: supplier.needsReview,
          createdAt: supplier.createdAt
        },
        'full_deletion',
        {
          sourceController: 'supplierController',
          deletionReason: 'User request via DELETE endpoint'
        }
      );
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error: any) {
    console.error(`Error al eliminar proveedor ${req.params.id}:`, error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al eliminar proveedor'
    });
  }
};

/**
 * @desc    Obtener proveedores pendientes de revisión
 * @route   GET /api/suppliers/pending-review
 * @access  Private
 */
export const getPendingReviewSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    const suppliers = await Contact.find({
      isDeleted: false,
      isSupplier: true,
      needsReview: true
    }).sort('name');

    res.status(200).json({
      success: true,
      count: suppliers.length,
      data: suppliers
    });
  } catch (error: any) {
    console.error('Error al obtener proveedores pendientes de revisión:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener proveedores pendientes de revisión'
    });
  }
};

/**
 * @desc    Marcar un proveedor como revisado
 * @route   PATCH /api/suppliers/:id/mark-as-reviewed
 * @access  Private
 */
export const markSupplierAsReviewed = async (req: Request, res: Response): Promise<void> => {
  try {
    const supplier = await Contact.findOne({
      _id: req.params.id,
      isSupplier: true,
      isDeleted: false
    });

    if (!supplier) {
      res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
      return;
    }

    // Cambiar flag de revisión
    supplier.needsReview = false;
    await supplier.save();

    // Crear log de la operación
    if (req.user && req.user._id) {
      const supplierId = (supplier as unknown as { _id: { toString(): string } })._id.toString();
      const userId = req.user._id.toString();

      await logService.createContactLog(
        LogOperation.UPDATE,
        supplierId,
        userId,
        {
          name: supplier.name,
          rut: supplier.rut,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          isCustomer: supplier.isCustomer,
          isSupplier: supplier.isSupplier,
          needsReview: supplier.needsReview,
          operationType: 'MARK_AS_REVIEWED',
          additionalData: {
            previousReviewStatus: true,
            reviewedBy: userId,
            reviewDate: new Date().toISOString(),
            sourceController: 'supplierController'
          }
        }
      );
    }

    res.status(200).json({
      success: true,
      data: supplier
    });
  } catch (error: any) {
    console.error(`Error al marcar proveedor ${req.params.id} como revisado:`, error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al marcar proveedor como revisado'
    });
  }
};

/**
 * @desc    Obtener detalles básicos de un proveedor
 * @route   GET /api/suppliers/:id/details
 * @access  Private
 */
export const getSupplierDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verificar si el proveedor existe
    const supplier = await Contact.findOne({
      _id: req.params.id,
      isDeleted: false,
      isSupplier: true
    }).select('_id name rut isSupplier isCustomer email phone address observations');

    if (!supplier) {
      res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
      return;
    }

    // Responder con los datos básicos del proveedor
    res.status(200).json({
      success: true,
      data: {
        supplier
      }
    });
  } catch (error: any) {
    console.error(`Error al obtener detalles del proveedor ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener detalles del proveedor'
    });
  }
};

/**
 * @desc    Obtener métricas y estadísticas detalladas de un proveedor
 * @route   GET /api/suppliers/:id/metrics
 * @access  Private
 */
export const getSupplierMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Verificar que el proveedor existe
    const supplier = await Contact.findOne({
      _id: id,
      isDeleted: false,
      isSupplier: true
    }).select('_id name rut email phone address isCustomer isSupplier');

    if (!supplier) {
      res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
      return;
    }

    // Obtener métricas de compras usando agregación
    const Transaction = (await import('../models/Transaction')).default;
    const { TransactionType } = await import('../models/Transaction');

    const metricsResult = await Transaction.aggregate([
      {
        $match: {
          counterparty: new mongoose.Types.ObjectId(id),
          type: TransactionType.PURCHASE,
          isDeleted: false
        }
      },
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
          averageTicket: { $avg: '$totalAmount' },
          minAmount: { $min: '$totalAmount' },
          maxAmount: { $max: '$totalAmount' },
          firstPurchase: { $min: '$date' },
          lastPurchase: { $max: '$date' }
        }
      }
    ]);

    const metrics = metricsResult[0] || {
      totalPurchases: 0,
      totalSpent: 0,
      averageTicket: 0,
      minAmount: 0,
      maxAmount: 0,
      firstPurchase: null,
      lastPurchase: null
    };

    // También obtener métricas de ventas si el contacto también es cliente
    let salesMetrics = null;
    if (supplier.isCustomer) {
      const salesResult = await Transaction.aggregate([
        {
          $match: {
            counterparty: new mongoose.Types.ObjectId(id),
            type: TransactionType.SALE,
            isDeleted: false
          }
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            averageTicket: { $avg: '$totalAmount' },
            minAmount: { $min: '$totalAmount' },
            maxAmount: { $max: '$totalAmount' },
            firstSale: { $min: '$date' },
            lastSale: { $max: '$date' }
          }
        }
      ]);

      salesMetrics = salesResult[0] || {
        totalSales: 0,
        totalRevenue: 0,
        averageTicket: 0,
        minAmount: 0,
        maxAmount: 0,
        firstSale: null,
        lastSale: null
      };
    }

    res.status(200).json({
      success: true,
      data: {
        supplier,
        purchaseMetrics: {
          totalPurchases: metrics.totalPurchases,
          totalSpent: metrics.totalSpent,
          averageTicket: Math.round(metrics.averageTicket || 0),
          minAmount: metrics.minAmount,
          maxAmount: metrics.maxAmount,
          firstPurchase: metrics.firstPurchase,
          lastPurchase: metrics.lastPurchase
        },
        ...(salesMetrics && {
          salesMetrics: {
            totalSales: salesMetrics.totalSales,
            totalRevenue: salesMetrics.totalRevenue,
            averageTicket: Math.round(salesMetrics.averageTicket || 0),
            minAmount: salesMetrics.minAmount,
            maxAmount: salesMetrics.maxAmount,
            firstSale: salesMetrics.firstSale,
            lastSale: salesMetrics.lastSale
          }
        })
      }
    });
  } catch (error: any) {
    console.error(`Error al obtener métricas del proveedor ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener métricas del proveedor'
    });
  }
};

/**
 * @desc    Obtener historial de transacciones de un proveedor (compras y ventas)
 * @route   GET /api/suppliers/:id/transactions
 * @access  Private
 */
export const getSupplierTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const type = (req.query.type as string).toLowerCase(); // 'purchase', 'sale', or undefined (all)

    // Verificar que el proveedor existe
    const supplier = await Contact.findOne({
      _id: id,
      isDeleted: false,
      isSupplier: true
    });

    if (!supplier) {
      res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
      return;
    }

    const Transaction = (await import('../models/Transaction')).default;
    const { TransactionType } = await import('../models/Transaction');

    // Construir filtro de tipo de transacción
    let typeFilter: any = {};
    if (type === 'purchase') {
      typeFilter = { type: TransactionType.PURCHASE };
    } else if (type === 'sale') {
      typeFilter = { type: TransactionType.SALE };
    } else {
      // Ambos tipos si el contacto es dual o sin filtro específico
      typeFilter = { type: { $in: [TransactionType.PURCHASE, TransactionType.SALE] } };
    }

    const offset = (page - 1) * limit;

    // Obtener total de transacciones para paginación
    const total = await Transaction.countDocuments({
      counterparty: new mongoose.Types.ObjectId(id),
      isDeleted: false,
      ...typeFilter
    });

    // Obtener transacciones paginadas
    const transactions = await Transaction.aggregate([
      {
        $match: {
          counterparty: new mongoose.Types.ObjectId(id),
          isDeleted: false,
          ...typeFilter
        }
      },
      { $sort: { date: -1, createdAt: -1 } },
      { $skip: offset },
      { $limit: limit },
      // Lookup para usuario
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          pipeline: [
            { $project: { name: 1, email: 1 } }
          ],
          as: 'userData'
        }
      },
      // Lookup para cotización relacionada (solo para ventas)
      {
        $lookup: {
          from: 'transactions',
          localField: 'relatedQuotation',
          foreignField: '_id',
          pipeline: [
            { $project: { documentNumber: 1, status: 1 } }
          ],
          as: 'relatedQuotationData'
        }
      },
      // Lookup para items
      {
        $lookup: {
          from: 'items',
          let: { itemIds: '$items._id' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$_id', '$$itemIds'] }
              }
            },
            {
              $project: {
                name: 1,
                description: 1,
                netPrice: 1,
                dimensions: 1
              }
            }
          ],
          as: 'itemsData'
        }
      },
      // Enriquecer items con detalles
      {
        $addFields: {
          itemDetails: {
            $map: {
              input: '$items',
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$itemsData',
                          cond: { $eq: ['$$this._id', '$$item._id'] }
                        }
                      },
                      0
                    ]
                  }
                ]
              }
            }
          },
          userDetails: { $arrayElemAt: ['$userData', 0] },
          relatedQuotationDetails: { $arrayElemAt: ['$relatedQuotationData', 0] }
        }
      },
      // Limpieza final
      {
        $project: {
          userData: 0,
          relatedQuotationData: 0,
          itemsData: 0
        }
      }
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: {
        supplier: {
          _id: supplier._id,
          name: supplier.name,
          rut: supplier.rut,
          isCustomer: supplier.isCustomer,
          isSupplier: supplier.isSupplier
        },
        transactions,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error: any) {
    console.error(`Error al obtener transacciones del proveedor ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener transacciones del proveedor'
    });
  }
}; 