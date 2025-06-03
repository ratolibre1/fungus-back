import { Request, Response } from 'express';
import Contact, { IContact } from '../models/Client';
import logService from '../services/logService';
import { LogOperation, LogCollectionType } from '../models/Log';
import '../types/custom'; // Importamos los tipos personalizados

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