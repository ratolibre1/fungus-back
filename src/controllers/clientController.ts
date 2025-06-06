import { Request, Response } from 'express';
import Contact, { IContact } from '../models/Client';
import logService from '../services/logService';
import { LogOperation, LogCollectionType } from '../models/Log';
import '../types/custom'; // Importamos los tipos personalizados
import mongoose from 'mongoose';

/**
 * @desc    Obtener todos los clientes
 * @route   GET /api/clients
 * @access  Private
 */
export const getClients = async (req: Request, res: Response): Promise<void> => {
  try {
    // Filtrar para mostrar solo clientes activos (no eliminados)
    const clients = await Contact.find({
      isDeleted: false,
      isCustomer: true
    }).sort('name');

    res.status(200).json({
      success: true,
      count: clients.length,
      data: clients
    });
  } catch (error: any) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener clientes'
    });
  }
};

/**
 * @desc    Buscar clientes por término
 * @route   GET /api/clients/search?term=TÉRMINO
 * @access  Private
 */
export const searchClients = async (req: Request, res: Response): Promise<void> => {
  try {
    const { term } = req.query;

    if (!term) {
      res.status(400).json({
        success: false,
        message: 'Por favor proporcione un término de búsqueda'
      });
      return;
    }

    // Busca por nombre (texto), RUT o email, sólo clientes activos
    const clients = await Contact.find({
      $and: [
        { isDeleted: false },
        { isCustomer: true },
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
      count: clients.length,
      data: clients
    });
  } catch (error: any) {
    console.error(`Error al buscar clientes con término "${req.query.term}":`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al buscar clientes'
    });
  }
};

/**
 * @desc    Obtener un cliente por ID
 * @route   GET /api/clients/:id
 * @access  Private
 */
export const getClientById = async (req: Request, res: Response): Promise<void> => {
  try {
    const client = await Contact.findOne({
      _id: req.params.id,
      isDeleted: false,
      isCustomer: true
    });

    if (!client) {
      res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: client
    });
  } catch (error: any) {
    console.error(`Error al obtener cliente ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener cliente'
    });
  }
};

/**
 * @desc    Crear un nuevo cliente
 * @route   POST /api/clients
 * @access  Private
 */
export const createClient = async (req: Request, res: Response): Promise<void> => {
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

    // Asegurar que se guarda como cliente y no requiere revisión
    const clientData = {
      ...req.body,
      isCustomer: true,
      needsReview: false // Contactos creados por API no requieren revisión
    };

    const client = await Contact.create(clientData) as IContact;

    // Crear log de la operación
    if (req.user && req.user._id) {
      const clientId = (client as unknown as { _id: { toString(): string } })._id.toString();
      const userId = req.user._id.toString();

      await logService.createContactLog(
        LogOperation.CREATE,
        clientId,
        userId,
        {
          name: client.name,
          rut: client.rut,
          email: client.email,
          phone: client.phone,
          address: client.address,
          isCustomer: client.isCustomer,
          isSupplier: client.isSupplier,
          needsReview: client.needsReview,
          operationType: 'CLIENT_CREATION',
          additionalData: {
            createdViaAPI: true,
            sourceController: 'clientController',
            requestData: req.body
          }
        }
      );
    }

    res.status(201).json({
      success: true,
      data: client
    });
  } catch (error: any) {
    console.error('Error al crear cliente:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al crear cliente'
    });
  }
};

/**
 * @desc    Actualizar un cliente
 * @route   PUT /api/clients/:id
 * @access  Private
 */
export const updateClient = async (req: Request, res: Response): Promise<void> => {
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

    // Obtener cliente antes de la actualización para el log
    const oldClient = await Contact.findOne({
      _id: req.params.id,
      isCustomer: true,
      isDeleted: false
    }) as IContact | null;

    if (!oldClient) {
      res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
      return;
    }

    // Preparar datos para actualización (mantener isCustomer en true)
    const updateData = { ...req.body };
    // Asegurar que se actualiza como cliente pero permitimos que también pueda ser proveedor
    updateData.isCustomer = true;

    // Si el contacto fue marcado para revisión y está siendo actualizado, lo marcamos como revisado
    if (oldClient.needsReview) {
      updateData.needsReview = false;
    }

    // Actualizar cliente
    const client = await Contact.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ) as IContact | null;

    if (!client) {
      res.status(404).json({
        success: false,
        message: 'Cliente no encontrado durante la actualización'
      });
      return;
    }

    // Crear log de la operación
    if (req.user && req.user._id) {
      const clientId = (client as unknown as { _id: { toString(): string } })._id.toString();
      const userId = req.user._id.toString();

      await logService.createContactChangeLog(
        clientId,
        userId,
        updateData,
        {
          name: oldClient.name,
          rut: oldClient.rut,
          email: oldClient.email,
          phone: oldClient.phone,
          address: oldClient.address,
          isCustomer: oldClient.isCustomer,
          isSupplier: oldClient.isSupplier,
          needsReview: oldClient.needsReview
        },
        {
          name: client.name,
          rut: client.rut,
          email: client.email,
          phone: client.phone,
          address: client.address,
          isCustomer: client.isCustomer,
          isSupplier: client.isSupplier,
          needsReview: client.needsReview
        }
      );
    }

    res.status(200).json({
      success: true,
      data: client
    });
  } catch (error: any) {
    console.error(`Error al actualizar cliente ${req.params.id}:`, error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar cliente'
    });
  }
};

/**
 * @desc    Eliminar un cliente (borrado lógico)
 * @route   DELETE /api/clients/:id
 * @access  Private
 */
export const deleteClient = async (req: Request, res: Response): Promise<void> => {
  try {
    const client = await Contact.findOne({
      _id: req.params.id,
      isDeleted: false,
      isCustomer: true
    }) as IContact | null;

    if (!client) {
      res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
      return;
    }

    // Guardar información del cliente antes de marcarlo como eliminado
    const clientId = (client as unknown as { _id: { toString(): string } })._id.toString();
    const clientName = client.name;
    const clientRut = client.rut;
    const wasAlsoSupplier = client.isSupplier;

    // Si era solo cliente, lo marcamos como eliminado
    // Si también era proveedor, solo le quitamos el rol de cliente
    if (wasAlsoSupplier) {
      await Contact.findByIdAndUpdate(req.params.id, {
        isCustomer: false
      });
    } else {
      await Contact.findByIdAndUpdate(req.params.id, {
        isDeleted: true
      });
    }

    // Crear log de la operación
    if (req.user && req.user._id) {
      const userId = req.user._id.toString();

      await logService.createContactDeletionLog(
        clientId,
        userId,
        {
          name: clientName,
          rut: clientRut,
          email: client.email,
          phone: client.phone,
          address: client.address,
          isCustomer: true,
          isSupplier: wasAlsoSupplier,
          needsReview: client.needsReview,
          createdAt: client.createdAt
        },
        wasAlsoSupplier ? 'role_removal' : 'full_deletion',
        {
          sourceController: 'clientController',
          preservedAsSupplier: wasAlsoSupplier,
          deletionReason: 'User request via DELETE endpoint'
        }
      );
    }

    res.status(200).json({
      success: true,
      message: wasAlsoSupplier
        ? 'Rol de cliente eliminado correctamente, se mantiene como proveedor'
        : 'Cliente eliminado correctamente'
    });
  } catch (error: any) {
    console.error(`Error al eliminar cliente ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al eliminar cliente'
    });
  }
};

/**
 * @desc    Obtener detalles de un cliente (sin historial de compras)
 * @route   GET /api/clients/:id/details
 * @access  Private
 */
export const getClientDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verificar si el cliente existe
    const client = await Contact.findOne({
      _id: req.params.id,
      isDeleted: false,
      isCustomer: true
    }).select('_id name rut isSupplier isCustomer email phone address observations');

    if (!client) {
      res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
      return;
    }

    // Responder con los datos básicos del cliente
    res.status(200).json({
      success: true,
      data: {
        client
      }
    });
  } catch (error: any) {
    console.error(`Error al obtener detalles del cliente ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener detalles del cliente'
    });
  }
};

/**
 * @desc    Obtener métricas y estadísticas detalladas de un cliente
 * @route   GET /api/clients/:id/metrics
 * @access  Private
 */
export const getClientMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Verificar que el cliente existe
    const client = await Contact.findOne({
      _id: id,
      isDeleted: false,
      isCustomer: true
    }).select('_id name rut email phone address isCustomer isSupplier');

    if (!client) {
      res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
      return;
    }

    // Obtener métricas de ventas usando agregación
    const Transaction = (await import('../models/Transaction')).default;
    const { TransactionType } = await import('../models/Transaction');

    const metricsResult = await Transaction.aggregate([
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

    const metrics = metricsResult[0] || {
      totalSales: 0,
      totalRevenue: 0,
      averageTicket: 0,
      minAmount: 0,
      maxAmount: 0,
      firstSale: null,
      lastSale: null
    };

    // También obtener métricas de compras si el contacto también es proveedor
    let purchaseMetrics = null;
    if (client.isSupplier) {
      const purchaseResult = await Transaction.aggregate([
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

      purchaseMetrics = purchaseResult[0] || {
        totalPurchases: 0,
        totalSpent: 0,
        averageTicket: 0,
        minAmount: 0,
        maxAmount: 0,
        firstPurchase: null,
        lastPurchase: null
      };
    }

    res.status(200).json({
      success: true,
      data: {
        client,
        salesMetrics: {
          totalSales: metrics.totalSales,
          totalRevenue: metrics.totalRevenue,
          averageTicket: Math.round(metrics.averageTicket || 0),
          minAmount: metrics.minAmount,
          maxAmount: metrics.maxAmount,
          firstSale: metrics.firstSale,
          lastSale: metrics.lastSale
        },
        ...(purchaseMetrics && {
          purchaseMetrics: {
            totalPurchases: purchaseMetrics.totalPurchases,
            totalSpent: purchaseMetrics.totalSpent,
            averageTicket: Math.round(purchaseMetrics.averageTicket || 0),
            minAmount: purchaseMetrics.minAmount,
            maxAmount: purchaseMetrics.maxAmount,
            firstPurchase: purchaseMetrics.firstPurchase,
            lastPurchase: purchaseMetrics.lastPurchase
          }
        })
      }
    });
  } catch (error: any) {
    console.error(`Error al obtener métricas del cliente ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener métricas del cliente'
    });
  }
};

/**
 * @desc    Obtener historial de transacciones de un cliente (ventas y compras)
 * @route   GET /api/clients/:id/transactions
 * @access  Private
 */
export const getClientTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const type = req.query.type as string; // 'sale', 'purchase', or undefined (all)

    // Verificar que el cliente existe
    const client = await Contact.findOne({
      _id: id,
      isDeleted: false,
      isCustomer: true
    });

    if (!client) {
      res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
      return;
    }

    const Transaction = (await import('../models/Transaction')).default;
    const { TransactionType } = await import('../models/Transaction');

    // Construir filtro de tipo de transacción
    let typeFilter: any = {};
    if (type === 'sale') {
      typeFilter = { type: TransactionType.SALE };
    } else if (type === 'purchase') {
      typeFilter = { type: TransactionType.PURCHASE };
    } else {
      // Ambos tipos si el contacto es dual o sin filtro específico
      typeFilter = { type: { $in: [TransactionType.SALE, TransactionType.PURCHASE] } };
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
        client: {
          _id: client._id,
          name: client.name,
          rut: client.rut,
          isCustomer: client.isCustomer,
          isSupplier: client.isSupplier
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
    console.error(`Error al obtener transacciones del cliente ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener transacciones del cliente'
    });
  }
}; 