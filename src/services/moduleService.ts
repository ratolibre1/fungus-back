import Module, { IModule } from '../models/Module';

/**
 * Servicio para gestionar los módulos del panel de control
 */
export const moduleService = {
  /**
   * Obtener todos los módulos
   * @returns Promise con todos los módulos
   */
  getAllModules: async () => {
    return await Module.find().sort({ order: 1 });
  },

  /**
   * Obtener módulos visibles
   * @returns Promise con los módulos visibles
   */
  getVisibleModules: async () => {
    return await Module.find({ isVisible: true }).sort({ order: 1 });
  },

  /**
   * Obtener módulos visibles y activos
   * @returns Promise con los módulos visibles y activos
   */
  getActiveModules: async () => {
    return await Module.find({ isVisible: true, isActive: true }).sort({ order: 1 });
  },

  /**
   * Obtener módulos disponibles para un rol específico
   * @param role Rol para filtrar los módulos
   * @returns Promise con los módulos disponibles para el rol
   */
  getModulesByRole: async (role: string) => {
    return await Module.find({
      isVisible: true,
      isActive: true,
      allowedRoles: { $in: [role] }
    }).sort({ order: 1 });
  },

  /**
   * Obtener un módulo por su ID
   * @param id ID del módulo
   * @returns Promise con el módulo encontrado
   */
  getModuleById: async (id: string) => {
    return await Module.findById(id);
  },

  /**
   * Obtener un módulo por su nombre
   * @param name Nombre del módulo
   * @returns Promise con el módulo encontrado
   */
  getModuleByName: async (name: string) => {
    return await Module.findOne({ name });
  },

  /**
   * Crear un nuevo módulo
   * @param moduleData Datos del módulo a crear
   * @returns Promise con el módulo creado
   */
  createModule: async (moduleData: Partial<IModule>) => {
    return await Module.create(moduleData);
  },

  /**
   * Actualizar un módulo existente
   * @param id ID del módulo a actualizar
   * @param moduleData Datos del módulo a actualizar
   * @returns Promise con el módulo actualizado
   */
  updateModule: async (id: string, moduleData: Partial<IModule>) => {
    return await Module.findByIdAndUpdate(
      id,
      moduleData,
      { new: true, runValidators: true }
    );
  },

  /**
   * Activar o desactivar un módulo
   * @param id ID del módulo
   * @param isActive Estado de activación
   * @returns Promise con el módulo actualizado
   */
  toggleActiveState: async (id: string, isActive: boolean) => {
    return await Module.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    );
  },

  /**
   * Mostrar u ocultar un módulo
   * @param id ID del módulo
   * @param isVisible Estado de visibilidad
   * @returns Promise con el módulo actualizado
   */
  toggleVisibility: async (id: string, isVisible: boolean) => {
    return await Module.findByIdAndUpdate(
      id,
      { isVisible },
      { new: true }
    );
  },

  /**
   * Eliminar un módulo
   * @param id ID del módulo a eliminar
   * @returns Promise con el resultado de la eliminación
   */
  deleteModule: async (id: string) => {
    return await Module.findByIdAndDelete(id);
  },

  /**
   * Inicializar los módulos del sistema
   * Crea los módulos predeterminados si no existen
   */
  initializeModules: async () => {
    const defaultModules = [
      {
        name: 'dashboard',
        displayName: 'Panel de control',
        description: 'Página principal del panel de administración',
        icon: 'dashboard',
        path: '/dashboard',
        isActive: true,
        isVisible: true,
        order: 1,
        allowedRoles: ['admin', 'user']
      },
      {
        name: 'products',
        displayName: 'Productos',
        description: 'Gestión de hongos medicinales y comestibles',
        icon: 'mushroom',
        path: '/products',
        isActive: true,
        isVisible: true,
        order: 2,
        allowedRoles: ['admin', 'user']
      },
      {
        name: 'consumables',
        displayName: 'Insumos',
        description: 'Control de insumos y materiales',
        icon: 'flask',
        path: '/consumables',
        isActive: true,
        isVisible: true,
        order: 3,
        allowedRoles: ['admin', 'user']
      },
      {
        name: 'buyers',
        displayName: 'Compradores',
        description: 'Base de datos de clientes',
        icon: 'users',
        path: '/buyers',
        isActive: true,
        isVisible: true,
        order: 4,
        allowedRoles: ['admin', 'user']
      },
      {
        name: 'suppliers',
        displayName: 'Proveedores',
        description: 'Gestión de proveedores',
        icon: 'truck',
        path: '/suppliers',
        isActive: true,
        isVisible: true,
        order: 5,
        allowedRoles: ['admin', 'user']
      },
      {
        name: 'quotations',
        displayName: 'Cotizaciones',
        description: 'Generación y seguimiento de cotizaciones',
        icon: 'file-text',
        path: '/quotations',
        isActive: true,
        isVisible: true,
        order: 6,
        allowedRoles: ['admin', 'user']
      },
      {
        name: 'sales',
        displayName: 'Ventas',
        description: 'Registro y análisis de ventas',
        icon: 'dollar-sign',
        path: '/sales',
        isActive: true,
        isVisible: true,
        order: 7,
        allowedRoles: ['admin', 'user']
      },
      {
        name: 'purchases',
        displayName: 'Compras',
        description: 'Registro de compras a proveedores',
        icon: 'shopping-cart',
        path: '/purchases',
        isActive: true,
        isVisible: true,
        order: 8,
        allowedRoles: ['admin', 'user']
      },
      {
        name: 'logs',
        displayName: 'Registros',
        description: 'Registro de actividades del sistema',
        icon: 'list',
        path: '/logs',
        isActive: true,
        isVisible: true,
        order: 9,
        allowedRoles: ['admin']
      }
    ];

    // Para cada módulo predeterminado, lo creamos si no existe
    for (const module of defaultModules) {
      const existingModule = await Module.findOne({ name: module.name });
      if (!existingModule) {
        await Module.create(module);
      }
    }

    return await Module.find().sort({ order: 1 });
  }
};

export default moduleService; 