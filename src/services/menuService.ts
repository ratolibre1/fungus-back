import Menu, { IMenuItem } from '../models/Menu';

/**
 * Servicio para gestionar el menú del sistema
 */
const menuService = {
  /**
   * Obtener todos los elementos del menú
   * @returns Promise con todos los elementos del menú
   */
  getAllMenuItems: async () => {
    return await Menu.find().sort({ order: 1 });
  },

  /**
   * Obtener un elemento de menú por su nombre
   * @param name Nombre del elemento
   * @returns Promise con el elemento encontrado
   */
  getMenuItemByName: async (name: string) => {
    return await Menu.findOne({ name });
  },

  /**
   * Obtener elementos del menú filtrados por rol
   * @param role Rol del usuario (admin, user, boss, etc)
   * @returns Promise con los elementos del menú disponibles para el rol
   */
  getMenuItemsByRole: async (role: string) => {
    // Función recursiva para obtener elementos y sus hijos por rol
    const getItemsWithChildrenByRole = async (roles: string[]) => {
      // Obtener elementos de primer nivel para el rol
      const items = await Menu.find({ roles: { $in: roles }, isActive: true }).sort({ order: 1 });

      // Para cada elemento de tipo grupo, buscar sus hijos recursivamente
      const itemsWithChildren = await Promise.all(
        items.map(async (item) => {
          if (item.type === 'group' && !item.children) {
            // Buscamos hijos explícitamente
            const children = await Menu.find({
              'roles': { $in: roles },
              'isActive': true
            }).sort({ order: 1 });

            if (children && children.length > 0) {
              item.children = children;
            }
          }
          return item;
        })
      );

      return itemsWithChildren;
    };

    // Obtenemos los elementos disponibles para ese rol
    return await getItemsWithChildrenByRole([role]);
  },

  /**
   * Crear un nuevo elemento de menú
   * @param menuItemData Datos del elemento a crear
   * @returns Promise con el elemento creado
   */
  createMenuItem: async (menuItemData: Partial<IMenuItem>) => {
    return await Menu.create(menuItemData);
  },

  /**
   * Actualizar un elemento de menú existente
   * @param name Nombre del elemento a actualizar
   * @param menuItemData Datos del elemento a actualizar
   * @returns Promise con el elemento actualizado
   */
  updateMenuItem: async (name: string, menuItemData: Partial<IMenuItem>) => {
    return await Menu.findOneAndUpdate(
      { name },
      menuItemData,
      { new: true, runValidators: true }
    );
  },

  /**
   * Activar o desactivar un elemento del menú
   * @param name Nombre del elemento
   * @param isActive Estado de activación
   * @returns Promise con el elemento actualizado
   */
  toggleItemActive: async (name: string, isActive: boolean) => {
    return await menuService.updateMenuItem(name, { isActive } as Partial<IMenuItem>);
  },

  /**
   * Eliminar un elemento de menú
   * @param name Nombre del elemento a eliminar
   * @returns Promise con el resultado de la eliminación
   */
  deleteMenuItem: async (name: string) => {
    return await Menu.findOneAndDelete({ name });
  },

  /**
   * Inicializar el menú del sistema con una estructura predeterminada
   * @returns Promise con los elementos de menú inicializados
   */
  initializeMenu: async () => {
    // Definir los elementos del menú predeterminados
    const defaultMenuItems = [
      {
        name: 'dashboard',
        type: 'link',
        label: 'Panel de control',
        path: '/panel',
        icon: 'bi-speedometer2',
        roles: ['admin', 'boss', 'user'],
        isActive: true,
        order: 10
      },
      {
        name: 'products',
        type: 'link',
        label: 'Productos',
        path: '/productos',
        icon: 'bi-box-seam',
        roles: ['admin', 'boss', 'user'],
        isActive: true,
        order: 20
      },
      {
        name: 'consumables',
        type: 'link',
        label: 'Insumos',
        path: '/insumos',
        icon: 'bi-tools',
        roles: ['admin', 'boss', 'user'],
        isActive: true,
        order: 30
      },
      {
        name: 'clients',
        type: 'link',
        label: 'Compradores',
        path: '/compradores',
        icon: 'bi-people',
        roles: ['admin', 'boss', 'user'],
        isActive: true,
        order: 40
      },
      {
        name: 'suppliers',
        type: 'link',
        label: 'Proveedores',
        path: '/proveedores',
        icon: 'bi-truck',
        roles: ['admin', 'boss', 'user'],
        isActive: true,
        order: 50
      },
      {
        name: 'quotations',
        type: 'link',
        label: 'Cotizaciones',
        path: '/cotizaciones',
        icon: 'bi-file-earmark-text',
        roles: ['admin', 'boss', 'user'],
        isActive: true,
        order: 60
      },
      {
        name: 'sales',
        type: 'link',
        label: 'Ventas',
        path: '/ventas',
        icon: 'bi-cash-coin',
        roles: ['admin', 'boss', 'user'],
        isActive: true,
        order: 70
      },
      {
        name: 'purchases',
        type: 'link',
        label: 'Compras',
        path: '/compras',
        icon: 'bi-bag',
        roles: ['admin', 'boss', 'user'],
        isActive: true,
        order: 80
      },
      {
        name: 'logs',
        type: 'link',
        label: 'Registros',
        path: '/registros',
        icon: 'bi-journal-text',
        roles: ['admin'],
        isActive: true,
        order: 90
      },
      {
        name: 'finance',
        type: 'group',
        label: 'Finanzas',
        icon: 'bi-graph-up',
        roles: ['admin'],
        isActive: false,
        order: 100,
        children: [
          {
            name: 'reports',
            type: 'link',
            label: 'Reportes',
            path: '/reportes',
            icon: 'bi-file-earmark-bar-graph',
            roles: ['admin'],
            isActive: false,
            order: 10
          },
          {
            name: 'budget',
            type: 'link',
            label: 'Presupuesto',
            path: '/presupuesto',
            icon: 'bi-calculator',
            roles: ['admin'],
            isActive: false,
            order: 20
          }
        ]
      },
      {
        name: 'help',
        type: 'link',
        label: 'Ayuda',
        path: '/ayuda',
        icon: 'bi-question-circle',
        roles: ['admin', 'boss', 'user'],
        isActive: true,
        order: 120
      },
      {
        name: 'settings',
        type: 'link',
        label: 'Configuración',
        path: '/configuracion',
        icon: 'bi-gear',
        roles: ['admin'],
        isActive: false,
        order: 130
      }
    ];

    // Eliminar todos los elementos existentes
    await Menu.deleteMany({});

    // Crear cada elemento del menú
    const menuItems = [];
    for (const item of defaultMenuItems) {
      // Si el elemento es un grupo con hijos, primero creamos los hijos
      if (item.type === 'group' && item.children && item.children.length > 0) {
        const children = item.children;

        // Crear una copia del objeto sin los hijos
        const groupItem = { ...item } as any;
        delete groupItem.children;

        // Crear el grupo primero
        const createdGroup = await Menu.create(groupItem);
        menuItems.push(createdGroup);

        // Luego crear cada hijo
        for (const child of children) {
          const createdChild = await Menu.create(child);
          menuItems.push(createdChild);
        }
      } else {
        // Si no es un grupo o no tiene hijos, crear directamente
        const createdItem = await Menu.create(item);
        menuItems.push(createdItem);
      }
    }

    return menuItems;
  }
};

export default menuService; 