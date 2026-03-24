// Criticality levels: 'read' (immediate), 'moderate' (execute + notify), 'critical' (require confirmation)

export const actions = {
  // --- Products ---
  search_products: {
    criticality: 'read',
    permission: null,
    description: 'Buscar productos por nombre, categoría o filtros'
  },
  get_product_details: {
    criticality: 'read',
    permission: null,
    description: 'Ver detalles completos de un producto'
  },
  create_product: {
    criticality: 'moderate',
    permission: 'canManageProducts',
    description: 'Crear un nuevo producto'
  },
  update_product: {
    criticality: 'moderate',
    permission: 'canManageProducts',
    description: 'Actualizar nombre, descripción o imagen de un producto'
  },
  update_product_price: {
    criticality: 'moderate',
    permission: 'canManageProducts',
    description: 'Cambiar el precio de un producto'
  },
  update_product_availability: {
    criticality: 'moderate',
    permission: 'canManageProducts',
    description: 'Cambiar disponibilidad de un producto en una sucursal'
  },
  delete_product: {
    criticality: 'critical',
    permission: 'canManageProducts',
    description: 'Eliminar un producto del menú'
  },
  bulk_update_prices: {
    criticality: 'critical',
    permission: 'canManageProducts',
    description: 'Cambiar precios de múltiples productos'
  },

  // --- Categories ---
  list_categories: {
    criticality: 'read',
    permission: null,
    description: 'Listar todas las categorías'
  },
  create_category: {
    criticality: 'moderate',
    permission: 'canManageCategories',
    description: 'Crear una nueva categoría'
  },
  update_category: {
    criticality: 'moderate',
    permission: 'canManageCategories',
    description: 'Actualizar una categoría existente'
  },
  delete_category: {
    criticality: 'critical',
    permission: 'canManageCategories',
    description: 'Eliminar una categoría'
  },

  // --- Branches ---
  list_branches: {
    criticality: 'read',
    permission: null,
    description: 'Listar todas las sucursales'
  },
  create_branch: {
    criticality: 'moderate',
    permission: 'canManageBranches',
    description: 'Crear una nueva sucursal'
  },
  update_branch: {
    criticality: 'moderate',
    permission: 'canManageBranches',
    description: 'Actualizar datos de una sucursal'
  },
  update_branch_schedule: {
    criticality: 'moderate',
    permission: 'canManageBranches',
    description: 'Actualizar el horario de una sucursal'
  },
  toggle_branch_active: {
    criticality: 'critical',
    permission: 'canManageBranches',
    description: 'Activar o desactivar una sucursal'
  },
  delete_branch: {
    criticality: 'critical',
    permission: 'canManageBranches',
    description: 'Eliminar una sucursal'
  },

  // --- Orders ---
  search_orders: {
    criticality: 'read',
    permission: 'canManageOrders',
    description: 'Buscar pedidos por filtros'
  },
  get_order_details: {
    criticality: 'read',
    permission: 'canManageOrders',
    description: 'Ver detalles de un pedido'
  },
  update_order_status: {
    criticality: 'moderate',
    permission: 'canManageOrders',
    description: 'Cambiar el estado de un pedido'
  },
  cancel_order: {
    criticality: 'critical',
    permission: 'canManageOrders',
    description: 'Cancelar un pedido'
  },
  get_order_stats: {
    criticality: 'read',
    permission: 'canViewAnalytics',
    description: 'Ver estadísticas de pedidos'
  },

  // --- Settings ---
  get_settings: {
    criticality: 'read',
    permission: 'canManageSettings',
    description: 'Ver configuración del negocio'
  },
  update_general_settings: {
    criticality: 'moderate',
    permission: 'canManageSettings',
    description: 'Actualizar configuración general'
  },
  update_payment_settings: {
    criticality: 'critical',
    permission: 'canManageSettings',
    description: 'Cambiar configuración de pagos'
  },

  // --- ML Predictions ---
  predict_product_demand: {
    criticality: 'read',
    permission: 'canViewAnalytics',
    description: 'Predecir demanda de un producto'
  },
  predict_revenue: {
    criticality: 'read',
    permission: 'canViewAnalytics',
    description: 'Predecir ingresos de un período'
  },
  get_top_products: {
    criticality: 'read',
    permission: 'canViewAnalytics',
    description: 'Obtener productos más vendidos'
  },
};

export const geminiTools = [
  {
    functionDeclarations: [
      // --- Products ---
      {
        name: 'search_products',
        description: 'Buscar productos por nombre, categoría o filtros. Úsala para encontrar productos en el menú.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Texto de búsqueda por nombre de producto' },
            categoryId: { type: 'STRING', description: 'ID de categoría para filtrar' },
            branchId: { type: 'STRING', description: 'ID de sucursal para filtrar por disponibilidad' },
            isActive: { type: 'BOOLEAN', description: 'Filtrar por productos activos/inactivos' },
            limit: { type: 'NUMBER', description: 'Número máximo de resultados (default 20)' }
          }
        }
      },
      {
        name: 'get_product_details',
        description: 'Obtener todos los detalles de un producto específico por su nombre o ID.',
        parameters: {
          type: 'OBJECT',
          properties: {
            productId: { type: 'STRING', description: 'ID del producto' },
            productName: { type: 'STRING', description: 'Nombre del producto (búsqueda parcial)' }
          }
        }
      },
      {
        name: 'create_product',
        description: 'Crear un nuevo producto en el menú.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Nombre del producto' },
            description: { type: 'STRING', description: 'Descripción del producto' },
            price: { type: 'NUMBER', description: 'Precio del producto' },
            categoryId: { type: 'STRING', description: 'ID de la categoría' },
            categoryName: { type: 'STRING', description: 'Nombre de la categoría (si no se conoce el ID)' }
          },
          required: ['name', 'price']
        }
      },
      {
        name: 'update_product',
        description: 'Actualizar nombre, descripción u otros datos de un producto existente.',
        parameters: {
          type: 'OBJECT',
          properties: {
            productId: { type: 'STRING', description: 'ID del producto a actualizar' },
            productName: { type: 'STRING', description: 'Nombre actual del producto (para buscarlo)' },
            newName: { type: 'STRING', description: 'Nuevo nombre' },
            newDescription: { type: 'STRING', description: 'Nueva descripción' },
            newCategoryId: { type: 'STRING', description: 'Nueva categoría (ID)' }
          }
        }
      },
      {
        name: 'update_product_price',
        description: 'Cambiar el precio de un producto específico.',
        parameters: {
          type: 'OBJECT',
          properties: {
            productId: { type: 'STRING', description: 'ID del producto' },
            productName: { type: 'STRING', description: 'Nombre del producto (para buscarlo)' },
            newPrice: { type: 'NUMBER', description: 'Nuevo precio del producto' }
          },
          required: ['newPrice']
        }
      },
      {
        name: 'update_product_availability',
        description: 'Cambiar la disponibilidad de un producto en una sucursal específica.',
        parameters: {
          type: 'OBJECT',
          properties: {
            productId: { type: 'STRING', description: 'ID del producto' },
            productName: { type: 'STRING', description: 'Nombre del producto (para buscarlo)' },
            branchId: { type: 'STRING', description: 'ID de la sucursal' },
            branchName: { type: 'STRING', description: 'Nombre de la sucursal (para buscarla)' },
            isAvailable: { type: 'BOOLEAN', description: 'true para disponible, false para no disponible' }
          },
          required: ['isAvailable']
        }
      },
      {
        name: 'delete_product',
        description: 'Eliminar un producto del menú. Esta acción es irreversible.',
        parameters: {
          type: 'OBJECT',
          properties: {
            productId: { type: 'STRING', description: 'ID del producto' },
            productName: { type: 'STRING', description: 'Nombre del producto (para buscarlo)' }
          }
        }
      },
      {
        name: 'bulk_update_prices',
        description: 'Actualizar precios de múltiples productos a la vez. Puede aplicar un porcentaje de aumento/descuento o establecer precios fijos.',
        parameters: {
          type: 'OBJECT',
          properties: {
            categoryId: { type: 'STRING', description: 'ID de categoría para aplicar el cambio a todos sus productos' },
            categoryName: { type: 'STRING', description: 'Nombre de categoría (para buscarla)' },
            percentageChange: { type: 'NUMBER', description: 'Porcentaje de cambio (positivo para aumento, negativo para descuento). Ej: 10 para +10%' },
            productIds: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Lista de IDs de productos específicos' }
          },
          required: ['percentageChange']
        }
      },

      // --- Categories ---
      {
        name: 'list_categories',
        description: 'Listar todas las categorías del menú con su cantidad de productos.',
        parameters: {
          type: 'OBJECT',
          properties: {
            includeInactive: { type: 'BOOLEAN', description: 'Incluir categorías inactivas' }
          }
        }
      },
      {
        name: 'create_category',
        description: 'Crear una nueva categoría en el menú.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Nombre de la categoría' },
            description: { type: 'STRING', description: 'Descripción de la categoría' },
            color: { type: 'STRING', description: 'Color en formato hexadecimal (ej: #FF5733)' },
            icon: { type: 'STRING', description: 'Nombre del ícono' }
          },
          required: ['name']
        }
      },
      {
        name: 'update_category',
        description: 'Actualizar una categoría existente.',
        parameters: {
          type: 'OBJECT',
          properties: {
            categoryId: { type: 'STRING', description: 'ID de la categoría' },
            categoryName: { type: 'STRING', description: 'Nombre actual de la categoría (para buscarla)' },
            newName: { type: 'STRING', description: 'Nuevo nombre' },
            newDescription: { type: 'STRING', description: 'Nueva descripción' },
            newColor: { type: 'STRING', description: 'Nuevo color' },
            isActive: { type: 'BOOLEAN', description: 'Activar o desactivar' }
          }
        }
      },
      {
        name: 'delete_category',
        description: 'Eliminar una categoría. Los productos de esta categoría quedarán sin categoría.',
        parameters: {
          type: 'OBJECT',
          properties: {
            categoryId: { type: 'STRING', description: 'ID de la categoría' },
            categoryName: { type: 'STRING', description: 'Nombre de la categoría (para buscarla)' }
          }
        }
      },

      // --- Branches ---
      {
        name: 'list_branches',
        description: 'Listar todas las sucursales del negocio con su estado y horario.',
        parameters: {
          type: 'OBJECT',
          properties: {
            includeInactive: { type: 'BOOLEAN', description: 'Incluir sucursales inactivas' }
          }
        }
      },
      {
        name: 'create_branch',
        description: 'Crear una nueva sucursal.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Nombre de la sucursal' },
            address: { type: 'STRING', description: 'Dirección de la sucursal' }
          },
          required: ['name', 'address']
        }
      },
      {
        name: 'update_branch',
        description: 'Actualizar datos de una sucursal (nombre, dirección).',
        parameters: {
          type: 'OBJECT',
          properties: {
            branchId: { type: 'STRING', description: 'ID de la sucursal' },
            branchName: { type: 'STRING', description: 'Nombre actual de la sucursal (para buscarla)' },
            newName: { type: 'STRING', description: 'Nuevo nombre' },
            newAddress: { type: 'STRING', description: 'Nueva dirección' }
          }
        }
      },
      {
        name: 'update_branch_schedule',
        description: 'Actualizar el horario de una sucursal.',
        parameters: {
          type: 'OBJECT',
          properties: {
            branchId: { type: 'STRING', description: 'ID de la sucursal' },
            branchName: { type: 'STRING', description: 'Nombre de la sucursal (para buscarla)' },
            schedule: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  day: { type: 'STRING', description: 'Día de la semana (lunes, martes, etc.)' },
                  openTime: { type: 'STRING', description: 'Hora de apertura (HH:MM)' },
                  closeTime: { type: 'STRING', description: 'Hora de cierre (HH:MM)' },
                  isClosed: { type: 'BOOLEAN', description: 'Si está cerrado ese día' }
                }
              },
              description: 'Horario por día'
            }
          }
        }
      },
      {
        name: 'toggle_branch_active',
        description: 'Activar o desactivar una sucursal. Una sucursal desactivada no recibe pedidos.',
        parameters: {
          type: 'OBJECT',
          properties: {
            branchId: { type: 'STRING', description: 'ID de la sucursal' },
            branchName: { type: 'STRING', description: 'Nombre de la sucursal (para buscarla)' },
            isActive: { type: 'BOOLEAN', description: 'true para activar, false para desactivar' }
          },
          required: ['isActive']
        }
      },
      {
        name: 'delete_branch',
        description: 'Eliminar una sucursal permanentemente.',
        parameters: {
          type: 'OBJECT',
          properties: {
            branchId: { type: 'STRING', description: 'ID de la sucursal' },
            branchName: { type: 'STRING', description: 'Nombre de la sucursal (para buscarla)' }
          }
        }
      },

      // --- Orders ---
      {
        name: 'search_orders',
        description: 'Buscar pedidos por estado, fecha, sucursal u otros filtros.',
        parameters: {
          type: 'OBJECT',
          properties: {
            status: { type: 'STRING', description: 'Estado: pending, confirmed, preparing, ready, delivered, cancelled' },
            branchId: { type: 'STRING', description: 'ID de sucursal' },
            fromDate: { type: 'STRING', description: 'Fecha inicio (YYYY-MM-DD)' },
            toDate: { type: 'STRING', description: 'Fecha fin (YYYY-MM-DD)' },
            limit: { type: 'NUMBER', description: 'Máximo de resultados (default 20)' },
            paymentStatus: { type: 'STRING', description: 'Estado de pago: pending, paid' }
          }
        }
      },
      {
        name: 'get_order_details',
        description: 'Ver los detalles completos de un pedido por su número o ID.',
        parameters: {
          type: 'OBJECT',
          properties: {
            orderId: { type: 'STRING', description: 'ID del pedido' },
            orderNumber: { type: 'STRING', description: 'Número de pedido' }
          }
        }
      },
      {
        name: 'update_order_status',
        description: 'Cambiar el estado de un pedido (excepto cancelar, usar cancel_order para eso).',
        parameters: {
          type: 'OBJECT',
          properties: {
            orderId: { type: 'STRING', description: 'ID del pedido' },
            orderNumber: { type: 'STRING', description: 'Número de pedido' },
            newStatus: { type: 'STRING', description: 'Nuevo estado: confirmed, preparing, ready, delivered' }
          },
          required: ['newStatus']
        }
      },
      {
        name: 'cancel_order',
        description: 'Cancelar un pedido. Esta acción puede afectar al cliente y es irreversible.',
        parameters: {
          type: 'OBJECT',
          properties: {
            orderId: { type: 'STRING', description: 'ID del pedido' },
            orderNumber: { type: 'STRING', description: 'Número de pedido' },
            reason: { type: 'STRING', description: 'Motivo de la cancelación' }
          }
        }
      },
      {
        name: 'get_order_stats',
        description: 'Obtener estadísticas de pedidos: totales, por estado, ingresos, productos populares.',
        parameters: {
          type: 'OBJECT',
          properties: {
            period: { type: 'STRING', description: 'Período: today, week, month, year' },
            branchId: { type: 'STRING', description: 'Filtrar por sucursal' }
          }
        }
      },

      // --- Settings ---
      {
        name: 'get_settings',
        description: 'Ver la configuración actual del negocio (general, pagos, WhatsApp, etc.).',
        parameters: {
          type: 'OBJECT',
          properties: {
            section: { type: 'STRING', description: 'Sección: general, payment, whatsapp, appearance, notifications o all' }
          }
        }
      },
      {
        name: 'update_general_settings',
        description: 'Actualizar configuración general del negocio (nombre, teléfono, email, dirección, etc.).',
        parameters: {
          type: 'OBJECT',
          properties: {
            restaurantName: { type: 'STRING', description: 'Nombre del restaurante' },
            phone: { type: 'STRING', description: 'Teléfono' },
            email: { type: 'STRING', description: 'Email' },
            address: { type: 'STRING', description: 'Dirección' },
            currency: { type: 'STRING', description: 'Moneda (USD, VES, etc.)' }
          }
        }
      },
      {
        name: 'update_payment_settings',
        description: 'Cambiar configuración de pagos: métodos habilitados, tasas de cambio, pago móvil.',
        parameters: {
          type: 'OBJECT',
          properties: {
            paymentMethods: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Métodos de pago habilitados' },
            enableVenezuelanBs: { type: 'BOOLEAN', description: 'Habilitar pagos en bolívares' },
            customRate: { type: 'NUMBER', description: 'Tasa de cambio personalizada' },
            pagoMovil: { type: 'BOOLEAN', description: 'Habilitar pago móvil' },
            preferredRateSource: { type: 'STRING', description: 'Fuente de tasa: bcv, eur, custom' }
          }
        }
      },

      // --- ML Predictions ---
      {
        name: 'predict_product_demand',
        description: 'Predecir la demanda estimada de un producto para un período futuro usando el modelo de Machine Learning.',
        parameters: {
          type: 'OBJECT',
          properties: {
            productId: { type: 'STRING', description: 'ID del producto' },
            productName: { type: 'STRING', description: 'Nombre del producto' },
            date: { type: 'STRING', description: 'Fecha para la predicción (YYYY-MM-DD)' },
            daysAhead: { type: 'NUMBER', description: 'Número de días hacia adelante (default 7)' }
          }
        }
      },
      {
        name: 'predict_revenue',
        description: 'Predecir los ingresos estimados del negocio para un período futuro usando el modelo de Machine Learning.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date: { type: 'STRING', description: 'Fecha para la predicción (YYYY-MM-DD)' },
            daysAhead: { type: 'NUMBER', description: 'Número de días hacia adelante (default 7)' }
          }
        }
      },
      {
        name: 'get_top_products',
        description: 'Obtener los productos más vendidos basado en datos históricos.',
        parameters: {
          type: 'OBJECT',
          properties: {
            period: { type: 'STRING', description: 'Período: week, month, quarter, year' },
            limit: { type: 'NUMBER', description: 'Cantidad de productos a mostrar (default 10)' },
            branchId: { type: 'STRING', description: 'Filtrar por sucursal' }
          }
        }
      },
    ]
  }
];

function convertGeminiTypeToJsonSchema(type) {
  const map = { STRING: 'string', NUMBER: 'number', BOOLEAN: 'boolean', OBJECT: 'object', ARRAY: 'array' };
  return map[type] || type.toLowerCase();
}

function convertParameters(params) {
  if (!params) return { type: 'object', properties: {} };
  const converted = { type: convertGeminiTypeToJsonSchema(params.type), properties: {} };
  if (params.properties) {
    for (const [key, val] of Object.entries(params.properties)) {
      converted.properties[key] = { type: convertGeminiTypeToJsonSchema(val.type), description: val.description };
      if (val.items) {
        converted.properties[key].items = { type: convertGeminiTypeToJsonSchema(val.items.type) };
        if (val.items.properties) {
          converted.properties[key].items.properties = {};
          for (const [k, v] of Object.entries(val.items.properties)) {
            converted.properties[key].items.properties[k] = { type: convertGeminiTypeToJsonSchema(v.type), description: v.description };
          }
        }
      }
    }
  }
  if (params.required) converted.required = params.required;
  return converted;
}

export const ollamaToolsAll = geminiTools[0].functionDeclarations.map(fn => ({
  type: 'function',
  function: {
    name: fn.name,
    description: fn.description,
    parameters: convertParameters(fn.parameters),
  }
}));

const toolGroups = {
  products: ['search_products', 'get_product_details', 'update_product_price', 'create_product', 'update_product', 'update_product_availability', 'delete_product', 'bulk_update_prices'],
  categories: ['list_categories', 'create_category', 'update_category', 'delete_category'],
  branches: ['list_branches', 'create_branch', 'update_branch', 'update_branch_schedule', 'toggle_branch_active', 'delete_branch'],
  orders: ['search_orders', 'get_order_details', 'get_order_stats', 'update_order_status', 'cancel_order'],
  settings: ['get_settings', 'update_general_settings', 'update_payment_settings'],
  predictions: ['get_top_products', 'predict_product_demand', 'predict_revenue'],
};

const intentKeywords = {
  products: ['producto', 'productos', 'menú', 'menu', 'item', 'items', 'plato', 'comida', 'precio', 'precios', 'disponib', 'stock', 'product'],
  categories: ['categoría', 'categoria', 'categorias', 'categorías', 'category', 'categories'],
  branches: ['sucursal', 'sucursales', 'branch', 'sede', 'local', 'horario', 'zona', 'entrega', 'delivery'],
  orders: ['pedido', 'pedidos', 'orden', 'ordenes', 'órdenes', 'order', 'estado', 'cancelar', 'cancelación'],
  settings: ['configuración', 'configuracion', 'config', 'setting', 'pago', 'pagos', 'whatsapp', 'moneda', 'tasa'],
  predictions: ['predicción', 'prediccion', 'predecir', 'pronóstico', 'pronostico', 'demanda', 'ingreso', 'ingresos', 'vendido', 'vendidos', 'proyección', 'estimar', 'forecast', 'top', 'más vendido', 'populares'],
};

export function selectOllamaTools(message) {
  const msg = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const matched = new Set();

  for (const [group, keywords] of Object.entries(intentKeywords)) {
    for (const kw of keywords) {
      const normalizedKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (msg.includes(normalizedKw)) {
        matched.add(group);
        break;
      }
    }
  }

  if (matched.size === 0) {
    matched.add('products');
    matched.add('orders');
  }

  const sortedGroups = [...matched].sort(
    (a, b) => toolGroups[a].length - toolGroups[b].length
  );

  const selectedNames = [];
  for (const group of sortedGroups) {
    for (const name of toolGroups[group]) {
      if (!selectedNames.includes(name)) selectedNames.push(name);
    }
  }

  const MAX_TOOLS = 8;
  const limited = selectedNames.slice(0, MAX_TOOLS);
  return ollamaToolsAll.filter(t => limited.includes(t.function.name));
}

export function getActionConfig(actionName) {
  return actions[actionName] || null;
}

export function isCriticalAction(actionName) {
  const config = actions[actionName];
  return config?.criticality === 'critical';
}

export function getRequiredPermission(actionName) {
  const config = actions[actionName];
  return config?.permission || null;
}
