import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/faster-order';

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30 segundos para selección de servidor
      socketTimeoutMS: 45000, // 45 segundos para operaciones de socket
      connectTimeoutMS: 30000, // 30 segundos para conexión inicial
      maxPoolSize: 10, // Máximo de conexiones en el pool
      minPoolSize: 1, // Mínimo de conexiones en el pool
      maxIdleTimeMS: 30000, // Tiempo máximo de inactividad
      retryWrites: true, // Reintentar escrituras fallidas
      w: 'majority' // Confirmar escrituras en mayoría de réplicas
    });
    // ✅ Debug condicional - solo en development
    if (process.env.NODE_ENV === 'development' && process.env.MONGOOSE_DEBUG === 'true') {
      mongoose.set('debug', true);
      console.log('🔍 Mongoose debug mode activado');
    }
    console.log('✅ MongoDB conectado exitosamente');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('🔌 MongoDB desconectado');
  } catch (error) {
    console.error('❌ Error desconectando MongoDB:', error);
  }
}; 