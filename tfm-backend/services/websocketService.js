import { Server } from 'socket.io';
import mongoose from 'mongoose';

class WebSocketService {
  constructor() {
    this.io = null;
    this.changeStreams = new Map();
    this.changeStreamsEnabled = false;
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: ["https://demo.fasterorder.store", "https://menu.quierotermino.com", "https://faster-order-central--fasterordercentral.us-central1.hosted.app", "https://menu.triplekb.com", "http://localhost:3000", "http://localhost:3001", "https://minimal.fasterorder.store"],
        credentials: true
      }
    });

    this.setupSocketHandlers();
    this.setupChangeStreams();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('🔌 Cliente conectado:', socket.id);

      // Join business room for real-time updates
      socket.on('join-business', (businessId) => {
        socket.join(`business-${businessId}`);
        console.log(`👥 Cliente ${socket.id} se unió al negocio: ${businessId}`);
      });

      // Leave business room
      socket.on('leave-business', (businessId) => {
        socket.leave(`business-${businessId}`);
        console.log(`👋 Cliente ${socket.id} salió del negocio: ${businessId}`);
      });

      // Join order room for specific order updates
      socket.on('join-order', (orderId) => {
        socket.join(`order-${orderId}`);
        console.log(`📦 Cliente ${socket.id} se unió al pedido: ${orderId}`);
      });

      socket.on('disconnect', () => {
        console.log('🔌 Cliente desconectado:', socket.id);
      });
    });
  }

  async setupChangeStreams() {
    try {
      // Verificar si MongoDB soporta Change Streams (requiere replica set)
      const adminDb = mongoose.connection.db.admin();
      const serverStatus = await adminDb.serverStatus();
      
      if (serverStatus.repl && serverStatus.repl.ismaster) {
        console.log('✅ MongoDB replica set detectado - Change Streams habilitados');
        this.changeStreamsEnabled = true;
        this.setupCollectionChangeStreams();
      } else {
        console.log('⚠️  MongoDB no está configurado como replica set');
        console.log('📡 Usando WebSockets manuales para real-time updates');
        this.changeStreamsEnabled = false;
      }
    } catch (error) {
      console.log('⚠️  Error verificando replica set:', error.message);
      console.log('📡 Usando WebSockets manuales para real-time updates');
      this.changeStreamsEnabled = false;
    }
  }

  setupCollectionChangeStreams() {
    if (!this.changeStreamsEnabled) return;

    // Setup change streams for all collections using correct MongoDB collection names
    this.setupCollectionChangeStream('orders');
    this.setupCollectionChangeStream('branches');
    this.setupCollectionChangeStream('products');
    this.setupCollectionChangeStream('categories');
    this.setupCollectionChangeStream('extras');
    this.setupCollectionChangeStream('extragroups'); 
    this.setupCollectionChangeStream('images'); 
    this.setupCollectionChangeStream('settings');
  }

  setupCollectionChangeStream(collectionName) {
    try {
      const collection = mongoose.connection.db.collection(collectionName);
      
      const changeStream = collection.watch([], {
        fullDocument: 'updateLookup'
      });

      changeStream.on('change', (change) => {
        console.log(`🔄 Change Stream detectado en ${collectionName}:`, {
          operationType: change.operationType,
          documentKey: change.documentKey,
          businessId: change.fullDocument?.businessId,
          timestamp: new Date().toISOString()
        });
        this.handleChange(collectionName, change);
      });

      changeStream.on('error', (error) => {
        console.error(`❌ Error en change stream de ${collectionName}:`, error);
        this.changeStreams.delete(collectionName);
      });

      this.changeStreams.set(collectionName, changeStream);
      console.log(`📡 Change stream configurado para: ${collectionName}`);
    } catch (error) {
      console.error(`❌ Error configurando change stream para ${collectionName}:`, error);
    }
  }

  handleChange(collectionName, change) {
    const { operationType, fullDocument, documentKey } = change;
    
    if (!fullDocument) {
      console.log(`⚠️  No fullDocument en cambio de ${collectionName}`);
      return;
    }

    const businessId = fullDocument.businessId;
    const eventData = {
      collection: collectionName,
      operation: operationType,
      document: fullDocument,
      timestamp: new Date()
    };

    console.log(`📡 Procesando cambio en ${collectionName}:`, {
      operationType,
      businessId,
      documentId: documentKey?.id,
      hasBusinessId: !!businessId
    });

    // Emit to business room
    if (businessId) {
      this.io.to(`business-${businessId}`).emit('document-change', eventData);
      console.log(`📤 Emitido 'document-change' a business-${businessId}`);
    }

    // Emit to specific document room if it's an order
    if (collectionName === 'orders' && documentKey) {
      this.io.to(`order-${documentKey.id}`).emit('order-update', {
        order: fullDocument,
        operation: operationType,
        timestamp: new Date()
      });
      console.log(`📤 Emitido 'order-update' a order-${documentKey.id}`);
    }

    // Emit specific events for products
    if (collectionName === 'products' && businessId) {
      const productEvent = {
        product: fullDocument,
        operation: operationType,
        timestamp: new Date()
      };
      
      this.io.to(`business-${businessId}`).emit('product-updated', productEvent);
      console.log(`📤 Emitido 'product-updated' a business-${businessId}:`, {
        productId: fullDocument.id,
        productName: fullDocument.name,
        operation: operationType
      });
    }

    // Emit specific events for settings
    if (collectionName === 'settings' && businessId) {
      this.io.to(`business-${businessId}`).emit('settings-updated', {
        settings: fullDocument,
        operation: operationType,
        timestamp: new Date()
      });
      console.log(`📤 Emitido 'settings-updated' a business-${businessId}`);
    }

    // Emit specific events for extra groups
    if (collectionName === 'extragroups' && businessId) {
      this.io.to(`business-${businessId}`).emit('extra-group-updated', {
        extraGroup: fullDocument,
        operation: operationType,
        timestamp: new Date()
      });
      console.log(`📤 Emitido 'extra-group-updated' a business-${businessId}`);
    }

    // Emit specific events for gallery images
    if (collectionName === 'images' && businessId) {
      this.io.to(`business-${businessId}`).emit('gallery-image-updated', {
        image: fullDocument,
        operation: operationType,
        timestamp: new Date()
      });
      console.log(`📤 Emitido 'gallery-image-updated' a business-${businessId}`);
    }

    console.log(`✅ Cambio procesado en ${collectionName}: ${operationType} - ${documentKey?.id}`);
  }

  // Manual emit methods for immediate updates (usado cuando Change Streams no están disponibles)
  emitToBusiness(businessId, event, data) {
    if (this.io) {
      console.log(`📤 Emitido manual a business-${businessId}: ${event}`, {
        businessId,
        event,
        dataId: data?.id,
        dataName: data?.name,
        timestamp: new Date().toISOString()
      });
      
      this.io.to(`business-${businessId}`).emit(event, data);
      console.log(`✅ Evento ${event} enviado exitosamente a business-${businessId}`);
    } else {
      console.error(`❌ No se pudo emitir ${event} - WebSocket no inicializado`);
    }
  }

  emitToOrder(orderId, event, data) {
    if (this.io) {
      console.log(`📤 Emitido a order-${orderId}: ${event}`, {
        orderId,
        event,
        data: data
      });
      
      this.io.to(`order-${orderId}`).emit(event, data);
      console.log(`✅ Evento ${event} enviado exitosamente a order-${orderId}`);
    } else {
      console.error(`❌ No se pudo emitir ${event} - WebSocket no inicializado`);
    }
  }

  // Broadcast to all connected clients
  broadcast(event, data) {
    if (this.io) {
      console.log(`📤 Broadcast: ${event}`, {
        event,
        data: data
      });
      
      this.io.emit(event, data);
      console.log(`✅ Broadcast ${event} enviado exitosamente`);
    } else {
      console.error(`❌ No se pudo hacer broadcast de ${event} - WebSocket no inicializado`);
    }
  }

  // Get connection status
  getStatus() {
    const status = {
      changeStreamsEnabled: this.changeStreamsEnabled,
      activeConnections: this.io ? this.io.engine.clientsCount : 0,
      changeStreamsCount: this.changeStreams.size
    };
    
    console.log('📊 Estado de WebSockets:', status);
    return status;
  }

  // Cleanup method
  cleanup() {
    this.changeStreams.forEach((stream, collection) => {
      try {
        stream.close();
        console.log(`🔌 Change stream cerrado para: ${collection}`);
      } catch (error) {
        console.error(`❌ Error cerrando change stream de ${collection}:`, error);
      }
    });
    this.changeStreams.clear();
  }
}

export default new WebSocketService(); 