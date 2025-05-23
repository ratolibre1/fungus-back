import { Request, Response } from 'express';
import Contact, { IContact } from '../models/Client';
import logService from '../services/logService';
import { LogOperation, LogCollectionType } from '../models/Log';
import '../types/custom'; // Importamos los tipos personalizados
import Purchase from '../models/Purchase';

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

      await logService.createLog(
        LogOperation.CREATE,
        LogCollectionType.CONTACT,
        supplierId,
        userId,
        {
          contactName: supplier.name,
          contactRut: supplier.rut,
          isCustomer: supplier.isCustomer,
          isSupplier: supplier.isSupplier,
          contactData: req.body
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

      await logService.createLog(
        LogOperation.UPDATE,
        LogCollectionType.CONTACT,
        supplierId,
        userId,
        {
          contactName: supplier.name,
          contactRut: supplier.rut,
          isCustomer: supplier.isCustomer,
          isSupplier: supplier.isSupplier,
          wasReviewed: oldSupplier.needsReview && !supplier.needsReview,
          oldData: {
            name: oldSupplier.name,
            rut: oldSupplier.rut,
            email: oldSupplier.email,
            phone: oldSupplier.phone,
            address: oldSupplier.address
          },
          updatedFields: Object.keys(req.body)
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

      await logService.createLog(
        LogOperation.DELETE,
        LogCollectionType.CONTACT,
        supplierId,
        userId,
        {
          contactName: supplier.name,
          contactRut: supplier.rut,
          isCustomer: supplier.isCustomer,
          isSupplier: supplier.isSupplier
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

      await logService.createLog(
        LogOperation.UPDATE,
        LogCollectionType.CONTACT,
        supplierId,
        userId,
        {
          contactName: supplier.name,
          contactRut: supplier.rut,
          action: 'mark-as-reviewed'
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
 * @desc    Obtener historial de compras de un proveedor
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
    }).select('_id name rut isSupplier isCustomer');

    if (!supplier) {
      res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
      return;
    }

    // Obtener todas las compras para este proveedor
    const purchases = await Purchase.find({
      supplier: req.params.id,
      isDeleted: false
    })
      .sort({ date: -1 })
      .select('number documentType documentNumber date description items netAmount taxAmount totalAmount');

    // Calcular estadísticas
    let totalPaid = 0;
    let firstPurchaseDate = null;
    let lastPurchaseDate = null;

    if (purchases.length > 0) {
      // Sumar todos los montos totales
      totalPaid = purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);

      // Ordenar por fecha para obtener primera y última compra
      const sortedPurchases = [...purchases].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      firstPurchaseDate = sortedPurchases[0].date;
      lastPurchaseDate = sortedPurchases[sortedPurchases.length - 1].date;
    }

    // Calcular promedio
    const averagePurchase = purchases.length > 0 ? totalPaid / purchases.length : 0;

    // Responder con los datos
    res.status(200).json({
      success: true,
      data: {
        supplier,
        purchases,
        statistics: {
          totalPurchases: purchases.length,
          totalPaid,
          averagePurchase,
          firstPurchaseDate,
          lastPurchaseDate
        }
      }
    });
  } catch (error: any) {
    console.error(`Error al obtener historial de compras para proveedor ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener historial de compras'
    });
  }
}; 