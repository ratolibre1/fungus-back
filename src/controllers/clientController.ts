import { Request, Response } from 'express';
import Contact, { IContact } from '../models/Client';
import Sale from '../models/Sale';
import logService from '../services/logService';
import { LogOperation, LogCollectionType } from '../models/Log';
import '../types/custom'; // Importamos los tipos personalizados

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

      await logService.createLog(
        LogOperation.CREATE,
        LogCollectionType.CONTACT,
        clientId,
        userId,
        {
          contactName: client.name,
          contactRut: client.rut,
          isCustomer: client.isCustomer,
          isSupplier: client.isSupplier,
          contactData: req.body
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

      await logService.createLog(
        LogOperation.UPDATE,
        LogCollectionType.CONTACT,
        clientId,
        userId,
        {
          contactName: client.name,
          contactRut: client.rut,
          isCustomer: client.isCustomer,
          isSupplier: client.isSupplier,
          oldData: {
            name: oldClient.name,
            rut: oldClient.rut
          },
          changes: updateData
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

      await logService.createLog(
        LogOperation.DELETE,
        LogCollectionType.CONTACT,
        clientId,
        userId,
        {
          contactName: clientName,
          contactRut: clientRut,
          wasCustomer: true,
          wasSupplier: wasAlsoSupplier,
          action: wasAlsoSupplier ? 'role_removed' : 'deleted'
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
 * @desc    Obtener historial de compras de un cliente
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
    }).select('_id name rut isSupplier isCustomer');

    if (!client) {
      res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
      return;
    }

    // Obtener todas las ventas para este cliente
    const purchases = await Sale.find({
      client: req.params.id,
      isDeleted: false
    })
      .sort({ date: -1 })
      .populate('items.product', 'name')
      .select('correlative documentType documentNumber date items netAmount taxAmount totalAmount observations');

    // Calcular estadísticas
    let totalSpent = 0;
    let firstPurchaseDate = null;
    let lastPurchaseDate = null;

    if (purchases.length > 0) {
      // Sumar todos los montos totales
      totalSpent = purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);

      // Ordenar por fecha para obtener primera y última compra
      const sortedPurchases = [...purchases].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      firstPurchaseDate = sortedPurchases[0].date;
      lastPurchaseDate = sortedPurchases[sortedPurchases.length - 1].date;
    }

    // Calcular promedio
    const averagePurchase = purchases.length > 0 ? totalSpent / purchases.length : 0;

    // Responder con los datos
    res.status(200).json({
      success: true,
      data: {
        client,
        purchases,
        statistics: {
          totalPurchases: purchases.length,
          totalSpent,
          averagePurchase,
          firstPurchaseDate,
          lastPurchaseDate
        }
      }
    });
  } catch (error: any) {
    console.error(`Error al obtener historial de compras para cliente ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener historial de compras'
    });
  }
}; 