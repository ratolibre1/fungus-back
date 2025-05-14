import { Request, Response } from 'express';
import Contact, { IContact } from '../models/Client';
import logService from '../services/logService';
import { LogOperation, LogCollectionType } from '../models/Log';
import '../types/custom'; // Importamos los tipos personalizados

/**
 * @desc    Obtener todos los contactos
 * @route   GET /api/contacts
 * @access  Private
 */
export const getContacts = async (req: Request, res: Response): Promise<void> => {
  try {
    // Filtrar para mostrar solo contactos activos (no eliminados)
    const contacts = await Contact.find({
      isDeleted: false
    }).sort('name');

    res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts
    });
  } catch (error: any) {
    console.error('Error al obtener contactos:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener contactos'
    });
  }
};

/**
 * @desc    Obtener contactos duales (cliente y proveedor)
 * @route   GET /api/contacts/dual
 * @access  Private
 */
export const getDualContacts = async (req: Request, res: Response): Promise<void> => {
  try {
    // Filtrar para mostrar solo contactos activos que son cliente y proveedor
    const contacts = await Contact.find({
      isDeleted: false,
      isCustomer: true,
      isSupplier: true
    }).sort('name');

    res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts
    });
  } catch (error: any) {
    console.error('Error al obtener contactos duales:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener contactos duales'
    });
  }
};

/**
 * @desc    Buscar contactos por término
 * @route   GET /api/contacts/search?term=TÉRMINO
 * @access  Private
 */
export const searchContacts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { term } = req.query;

    if (!term) {
      res.status(400).json({
        success: false,
        message: 'Por favor proporcione un término de búsqueda'
      });
      return;
    }

    // Busca por nombre (texto), RUT o email
    const contacts = await Contact.find({
      $and: [
        { isDeleted: false },
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
      count: contacts.length,
      data: contacts
    });
  } catch (error: any) {
    console.error(`Error al buscar contactos con término "${req.query.term}":`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al buscar contactos'
    });
  }
};

/**
 * @desc    Obtener un contacto por ID
 * @route   GET /api/contacts/:id
 * @access  Private
 */
export const getContactById = async (req: Request, res: Response): Promise<void> => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!contact) {
      res.status(404).json({
        success: false,
        message: 'Contacto no encontrado'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: contact
    });
  } catch (error: any) {
    console.error(`Error al obtener contacto ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener contacto'
    });
  }
};

/**
 * @desc    Crear un nuevo contacto con roles específicos
 * @route   POST /api/contacts
 * @access  Private
 */
export const createContact = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verificar si ya existe un contacto con el mismo RUT
    const existingContact = await Contact.findOne({ rut: req.body.rut });

    if (existingContact) {
      // Si existe pero está eliminado, lo reactivamos
      if (existingContact.isDeleted) {
        const updatedData = {
          ...req.body,
          isDeleted: false
        };

        // Definimos roles según lo que viene en el request
        updatedData.isCustomer = req.body.isCustomer || false;
        updatedData.isSupplier = req.body.isSupplier || false;

        const contact = await Contact.findByIdAndUpdate(
          existingContact._id,
          updatedData,
          { new: true }
        ) as IContact;

        // Crear log de reactivación
        if (req.user && req.user._id) {
          const contactId = (contact as unknown as { _id: { toString(): string } })._id.toString();
          const userId = req.user._id.toString();

          await logService.createLog(
            LogOperation.CREATE,
            LogCollectionType.CONTACT,
            contactId,
            userId,
            {
              contactName: contact.name,
              contactRut: contact.rut,
              isCustomer: contact.isCustomer,
              isSupplier: contact.isSupplier,
              wasReactivated: true,
              contactData: req.body
            }
          );
        }

        res.status(200).json({
          success: true,
          message: 'Contacto reactivado',
          data: contact
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: 'Ya existe un contacto con este RUT'
      });
      return;
    }

    // Asegurar que tenga al menos un rol
    if (!req.body.isCustomer && !req.body.isSupplier) {
      res.status(400).json({
        success: false,
        message: 'El contacto debe ser cliente o proveedor (o ambos)'
      });
      return;
    }

    const contact = await Contact.create(req.body) as IContact;

    // Crear log de la operación
    if (req.user && req.user._id) {
      const contactId = (contact as unknown as { _id: { toString(): string } })._id.toString();
      const userId = req.user._id.toString();

      await logService.createLog(
        LogOperation.CREATE,
        LogCollectionType.CONTACT,
        contactId,
        userId,
        {
          contactName: contact.name,
          contactRut: contact.rut,
          isCustomer: contact.isCustomer,
          isSupplier: contact.isSupplier,
          contactData: req.body
        }
      );
    }

    res.status(201).json({
      success: true,
      data: contact
    });
  } catch (error: any) {
    console.error('Error al crear contacto:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al crear contacto'
    });
  }
};

/**
 * @desc    Actualizar un contacto
 * @route   PUT /api/contacts/:id
 * @access  Private
 */
export const updateContact = async (req: Request, res: Response): Promise<void> => {
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

    // Asegurar que tenga al menos un rol
    if (req.body.isCustomer === false && req.body.isSupplier === false) {
      res.status(400).json({
        success: false,
        message: 'El contacto debe ser cliente o proveedor (o ambos)'
      });
      return;
    }

    // Obtener contacto antes de la actualización para el log
    const oldContact = await Contact.findOne({
      _id: req.params.id,
      isDeleted: false
    }) as IContact | null;

    if (!oldContact) {
      res.status(404).json({
        success: false,
        message: 'Contacto no encontrado'
      });
      return;
    }

    // Actualizar contacto
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    ) as IContact | null;

    if (!contact) {
      res.status(404).json({
        success: false,
        message: 'Contacto no encontrado durante la actualización'
      });
      return;
    }

    // Crear log de la operación
    if (req.user && req.user._id) {
      const contactId = (contact as unknown as { _id: { toString(): string } })._id.toString();
      const userId = req.user._id.toString();

      await logService.createLog(
        LogOperation.UPDATE,
        LogCollectionType.CONTACT,
        contactId,
        userId,
        {
          contactName: contact.name,
          contactRut: contact.rut,
          isCustomer: contact.isCustomer,
          isSupplier: contact.isSupplier,
          oldData: {
            name: oldContact.name,
            rut: oldContact.rut,
            isCustomer: oldContact.isCustomer,
            isSupplier: oldContact.isSupplier
          },
          changes: req.body
        }
      );
    }

    res.status(200).json({
      success: true,
      data: contact
    });
  } catch (error: any) {
    console.error(`Error al actualizar contacto ${req.params.id}:`, error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar contacto'
    });
  }
};

/**
 * @desc    Eliminar un contacto (borrado lógico)
 * @route   DELETE /api/contacts/:id
 * @access  Private
 */
export const deleteContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      isDeleted: false
    }) as IContact | null;

    if (!contact) {
      res.status(404).json({
        success: false,
        message: 'Contacto no encontrado'
      });
      return;
    }

    // Guardar información del contacto antes de marcarlo como eliminado
    const contactId = (contact as unknown as { _id: { toString(): string } })._id.toString();
    const contactName = contact.name;
    const contactRut = contact.rut;
    const wasCustomer = contact.isCustomer;
    const wasSupplier = contact.isSupplier;

    // Borrado lógico
    await Contact.findByIdAndUpdate(req.params.id, {
      isDeleted: true
    });

    // Crear log de la operación
    if (req.user && req.user._id) {
      const userId = req.user._id.toString();

      await logService.createLog(
        LogOperation.DELETE,
        LogCollectionType.CONTACT,
        contactId,
        userId,
        {
          contactName: contactName,
          contactRut: contactRut,
          wasCustomer: wasCustomer,
          wasSupplier: wasSupplier,
          action: 'deleted'
        }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Contacto eliminado correctamente'
    });
  } catch (error: any) {
    console.error(`Error al eliminar contacto ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al eliminar contacto'
    });
  }
}; 