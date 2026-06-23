import http from 'http';
import express from 'express';
import https from 'https';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import selfsigned from 'selfsigned';
import { env } from './config/env';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/error';
import { logger } from './config/logger';
import apiRouter from './routes/api';
import { initTrackingSocket } from './sockets/trackingSocket';
import fs from 'fs';
import path from 'path';

const app = express();

// Setup security headers
app.use(helmet());

// Enable CORS
app.use(cors({
  origin: true, // Reflect request origin back to support local dev IPs dynamically
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Parse JSON request bodies
app.use(express.json());

// Apply rate limiting to all requests
app.use('/api', apiLimiter);

// API Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Root welcome endpoint
app.get('/', (req, res) => {
  res.send('<h1>Kurye Takip API Servisi Aktif</h1><p>API endpointlerine erişmek için <b>/api</b> ön ekini kullanın. Harita paneli için lütfen frontend uygulamasını açın (port 5173).</p>');
});

// Global Error Handler
app.use(errorHandler);

// Async server initialization wrapper to handle asynchronous self-signed certificate generation
async function startServer() {
  let server;

  if (env.NODE_ENV === 'production') {
    server = http.createServer(app);
    logger.info('Server configured to run in HTTP mode for production/Render.');
  } else {
    const sslDir = path.join(__dirname, '..', 'ssl');
    const keyPath = path.join(sslDir, 'server.key');
    const certPath = path.join(sslDir, 'server.crt');

    let privateKey: string;
    let certificate: string;

    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      privateKey = fs.readFileSync(keyPath, 'utf8');
      certificate = fs.readFileSync(certPath, 'utf8');
      logger.info('SSL certificates loaded successfully from disk.');
    } else {
      logger.info('Generating new SSL certificates...');
      if (!fs.existsSync(sslDir)) {
        fs.mkdirSync(sslDir, { recursive: true });
      }
      const attrs = [{ name: 'commonName', value: 'localhost' }];
      const pems = await selfsigned.generate(attrs, { keySize: 2048 });
      
      fs.writeFileSync(keyPath, pems.private, 'utf8');
      fs.writeFileSync(certPath, pems.cert, 'utf8');
      
      privateKey = pems.private;
      certificate = pems.cert;
      logger.info('New SSL certificates generated and saved to disk.');
    }

    server = https.createServer({
      key: privateKey,
      cert: certificate
    }, app);
  }

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow any origin dynamically for local HTTPS development
        callback(null, origin || '*');
      },
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Initialize Socket Tracking logic
  initTrackingSocket(io);

  // Start server
  server.listen(env.PORT, () => {
    logger.info(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    console.log(`[SERVER]: Running on ${env.NODE_ENV === 'production' ? 'http' : 'https'}://localhost:${env.PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
