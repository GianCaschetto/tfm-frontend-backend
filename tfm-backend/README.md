# Faster Order Backend - MongoDB

🚀 Backend multi-negocio con MongoDB y WebSockets para updates en tiempo real.

## 🎯 Características

- ✅ **MongoDB** como base de datos principal
- 📡 **WebSockets** con Socket.IO para updates en tiempo real
- 🏢 **Multi-negocio** - Soporte para múltiples negocios
- 🛡️ **Validación** con Mongoose schemas
- 📊 **Índices optimizados** para mejor performance
- ⚙️ **Settings por tipo** - Configuraciones organizadas por categorías

## 🛠️ Tecnologías

- **Node.js** + **Express**
- **MongoDB** + **Mongoose**
- **Socket.IO** para WebSockets

## 📦 Instalación

### 1. Clonar el repositorio
```bash
git clone <repository-url>
cd faster-order-backend
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar MongoDB

#### Opción A: MongoDB Local
```bash
# Instalar MongoDB en tu VPS
sudo apt update
sudo apt install mongodb

# Iniciar MongoDB
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

#### Opción B: MongoDB Atlas (Cloud)
1. Crear cuenta en [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Crear cluster gratuito
3. Obtener connection string

### 4. Configurar variables de entorno
```bash
# Crear archivo .env
cp .env.example .env

# Editar .env con tus configuraciones
MONGODB_URI=mongodb://localhost:27017/faster-order
PORT=4000
```

### 5. Iniciar servidor
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 🔌 WebSockets - Uso del Cliente

### Conectar al servidor
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');

socket.on('connect', () => {
  console.log('Conectado al servidor');
});
```

### Unirse a un negocio (para recibir updates)
```javascript
// Unirse a un negocio específico
socket.emit('join-business', 'business-id');

// Recibir updates del negocio
socket.on('document-change', (data) => {
  console.log('Cambio en:', data.collection, data.operation, data.document);
});

// Eventos específicos
socket.on('order-added', (order) => {
  console.log('Nuevo pedido:', order);
});

socket.on('order-status-updated', (order) => {
  console.log('Estado actualizado:', order);
});

// Eventos de settings
socket.on('settings-updated', (data) => {
  console.log('Settings actualizados:', data.type, data.settings);
});
```

### Unirse a un pedido específico
```javascript
// Unirse a un pedido específico
socket.emit('join-order', 'order-id');

// Recibir updates del pedido
socket.on('order-update', (data) => {
  console.log('Update del pedido:', data.order);
});
```

## 📡 Eventos WebSocket Disponibles

### Eventos de Negocio
- `document-change` - Cualquier cambio en el negocio
- `order-added` - Nuevo pedido
- `order-updated` - Pedido actualizado
- `order-status-updated` - Estado del pedido actualizado
- `order-payment-updated` - Estado de pago actualizado
- `order-deleted` - Pedido eliminado
- `branch-added` - Nueva sucursal
- `branch-updated` - Sucursal actualizada
- `branch-deleted` - Sucursal eliminada
- `product-added` - Nuevo producto
- `product-updated` - Producto actualizado
- `product-deleted` - Producto eliminado
- `category-added` - Nueva categoría
- `category-updated` - Categoría actualizada
- `category-deleted` - Categoría eliminada
- `settings-updated` - Configuración actualizada
- `settings-deleted` - Configuración eliminada

### Eventos de Pedido
- `order-created` - Pedido creado
- `order-modified` - Pedido modificado
- `order-status-changed` - Estado cambiado
- `order-payment-changed` - Pago cambiado
- `order-removed` - Pedido removido

## 🗄️ Estructura de la Base de Datos

### Colecciones
- **orders** - Pedidos de clientes
- **branches** - Sucursales de cada negocio
- **products** - Productos del menú
- **categories** - Categorías de productos
- **extras** - Extras/aditivos para productos
- **settings** - Configuraciones del negocio (por tipo)
- **businesses** - Información de negocios

### Tipos de Settings
- **general** - Configuración general del negocio
- **appearance** - Configuración de apariencia/UI
- **payment** - Configuración de pagos
- **whatsapp** - Configuración de WhatsApp
- **notifications** - Configuración de notificaciones

### Índices Optimizados
- `businessId` en todas las colecciones
- `businessId + guestId` en orders
- `businessId + status` en orders
- `businessId + categoryId` en products
- `businessId + order` en categories
- `businessId + type` en settings (único)

## 🔧 API Endpoints

### Orders
- `GET /orders/get-orders?business=businessId`
- `GET /orders/get-order/:id?business=businessId`
- `POST /orders/save-order?business=businessId`
- `PUT /orders/update-order/:id?business=businessId`
- `PUT /orders/update-order-status/:id?business=businessId`
- `PUT /orders/update-order-payment-status/:id?business=businessId`
- `DELETE /orders/delete-order/:id?business=businessId`

### Branches
- `GET /branches/get-all-branches?business=businessId`
- `GET /branches/get-branch-by-id/:id?business=businessId`
- `POST /branches/add-branch?business=businessId`
- `PUT /branches/update-branch/:id?business=businessId`
- `DELETE /branches/delete-branch/:id?business=businessId`

### Products
- `GET /products/get-all-products?business=businessId`
- `GET /products/get-product/:id?business=businessId`
- `POST /products/add-product?business=businessId`
- `PUT /products/update-product/:id?business=businessId`
- `DELETE /products/delete-product/:id?business=businessId`

### Categories
- `GET /categories/get-all-categories?business=businessId`
- `GET /categories/get-category/:id?business=businessId`
- `POST /categories/add-category?business=businessId`
- `PUT /categories/update-category/:id?business=businessId`
- `DELETE /categories/delete-category/:id?business=businessId`

### Settings
- `GET /settings/get-settings/:type?business=businessId`
- `GET /settings/get-all-settings?business=businessId`
- `POST /settings/save-general-settings?business=businessId`
- `POST /settings/save-appearance-settings?business=businessId`
- `POST /settings/save-payment-settings?business=businessId`
- `POST /settings/save-whatsapp-settings?business=businessId`
- `POST /settings/save-notifications-settings?business=businessId`
- `DELETE /settings/delete-settings/:type?business=businessId`

## 🚀 Despliegue en VPS

### 1. Instalar MongoDB
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install mongodb

# CentOS/RHEL
sudo yum install mongodb-org
```

### 2. Configurar MongoDB
```bash
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 3. Configurar firewall
```bash
# Permitir puerto 4000
sudo ufw allow 4000
```

### 4. Usar PM2 para producción
```bash
npm install -g pm2
pm2 start index.js --name "faster-order-backend"
pm2 startup
pm2 save
```

## 📊 Monitoreo

### Health Check
```bash
curl http://localhost:4000/health
```

### Logs
```bash
# Ver logs del servidor
pm2 logs faster-order-backend

# Ver logs de MongoDB
sudo journalctl -u mongod
```

## 🔒 Seguridad

- ✅ Validación de datos con Mongoose
- ✅ Sanitización de inputs
- ✅ CORS configurado
- ✅ Rate limiting (recomendado agregar)
- ✅ Autenticación (recomendado agregar)

## 🐛 Troubleshooting

### Error de conexión a MongoDB
```bash
# Verificar si MongoDB está corriendo
sudo systemctl status mongod

# Reiniciar MongoDB
sudo systemctl restart mongod
```

### Error de WebSockets
```bash
# Verificar puertos
netstat -tulpn | grep :4000

# Verificar logs
pm2 logs faster-order-backend
```

## 📈 Performance

### Optimizaciones implementadas
- ✅ Índices compuestos para consultas frecuentes
- ✅ Paginación en consultas grandes
- ✅ Connection pooling de MongoDB
- ✅ WebSocket rooms para reducir broadcast
- ✅ Settings organizados por tipo para mejor performance

### Recomendaciones adicionales
- 🔄 Implementar Redis para cache
- 🔄 Agregar rate limiting
- 🔄 Implementar logging estructurado
- 🔄 Agregar métricas con Prometheus

## 🤝 Contribuir

1. Fork el proyecto
2. Crear feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia ISC.

---

**¡Migración completada! 🎉** Tu backend ahora usa MongoDB con WebSockets para updates en tiempo real, similar a Firestore pero con control total sobre tu infraestructura. 