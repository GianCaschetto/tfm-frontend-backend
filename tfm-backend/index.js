import express from 'express';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { connectDB } from './config/database.js';
import websocketService from './services/websocketService.js';
import ordersRouter from './orders.js';
import branchesRouter from './branches.js';
import categoriesRouter from './categories.js';
import extrasRouter from './extras.js';
import productsRouter from './products.js';
import settingsRouter from './settings.js';
import galleryRouter from './gallery.js';
import scrapperRouter from './scrapper.js';
import usersRouter from './users.js';
import paymentRouter from './payment.js';
import agentRouter from './agent.js';

dotenv.config();

// Connect to MongoDB
connectDB();

export const app = express();
const server = createServer(app);

// Initialize WebSocket service
websocketService.initialize(server);

// Configura CORS
app.use(cors({
  origin: ["https://demo.fasterorder.store", "https://menu.quierotermino.com","https://faster-order-central--fasterordercentral.us-central1.hosted.app", "https://menu.triplekb.com", "http://localhost:3000", "http://localhost:3001", "http://localhost:8080", "https://nevadaprojectcompany.com", "https://mezclilla-san-miguel.web.app", "https://mezclilla-san-miguel.firebaseapp.com", "https://www.americangrafca.com", "https://americangrafca.com/"],
  credentials: true,
}));

app.use(cookieParser());
app.use(bodyParser.json());

// Middleware para asignar cookie guest_id
// app.use((req, res, next) => {
//   if (!req.cookies.guest_id) {
//     const guestId = uuidv4();
//     res.cookie("guest_id", guestId, {
//       httpOnly: true,
//       secure: false,
//       sameSite: "Strict",
//       maxAge: 1000 * 60 * 60 * 24 * 7, // 1 semana
//     });

//     console.log("Nuevo guest_id asignado:", guestId);
//   }
//   next();
// });

// Usar el router de orders
app.use('/orders', ordersRouter);
app.use('/branches', branchesRouter);
app.use('/categories', categoriesRouter);
app.use('/extras', extrasRouter);
app.use('/products', productsRouter);
app.use('/settings', settingsRouter);
app.use('/gallery', galleryRouter);
app.use('/scrapper', scrapperRouter);
app.use('/users', usersRouter);
app.use('/payment', paymentRouter);
app.use('/agent', agentRouter);

//Get cookie
app.get("/get-cookie", (req, res) => {
  res.status(200).json({ cookie: req.cookies.guest_id });
});

// Health check endpoint
app.get("/health", (req, res) => {
  const wsStatus = websocketService.getStatus();
  res.status(200).json({ 
    status: "OK", 
    database: "MongoDB", 
    websockets: wsStatus,
    timestamp: new Date().toISOString()
  });
});

// WebSocket status endpoint
app.get("/websocket-status", (req, res) => {
  const status = websocketService.getStatus();
  res.status(200).json({
    changeStreamsEnabled: status.changeStreamsEnabled,
    activeConnections: status.activeConnections,
    changeStreamsCount: status.changeStreamsCount,
    message: status.changeStreamsEnabled 
      ? "Change Streams activos para real-time automático" 
      : "WebSockets manuales activos para real-time"
  });
});

// Servidor
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Backend multi-negocio corriendo en puerto ${PORT}`);
  console.log(`📡 WebSockets activos para real-time updates`);
  console.log(`🗄️  Base de datos: MongoDB`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 WebSocket status: http://localhost:${PORT}/websocket-status`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Cerrando servidor...');
  websocketService.cleanup();
  server.close(() => {
    console.log('✅ Servidor cerrado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 Cerrando servidor...');
  websocketService.cleanup();
  server.close(() => {
    console.log('✅ Servidor cerrado');
    process.exit(0);
  });
});
