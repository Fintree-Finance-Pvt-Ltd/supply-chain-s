import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import * as dotenv from 'dotenv';
import path from 'path';
import routes from './routes';
import aadhaarWebhookRoutes from './routes/aadhaarWebhook.routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { startBureauPdfCron } from './cron/bureauPdf.cron';
import { startCaseReminderCron } from './cron/caseReminder.cron';

dotenv.config();

const app: Application = express();

// Security middleware - configure for static file serving
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration - handle multiple origins properly
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'];

app.use(cors({
  origin: true, // allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Body parsing
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

startBureauPdfCron();
startCaseReminderCron();

// Aadhaar Webhook route (must be public, before auth)
app.use('/api', aadhaarWebhookRoutes);

// Serve uploaded files with CORS headers
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  },
}));

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

// API root handler
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Supply Chain Finance API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      roles: '/api/roles',
      customers: '/api/customers',
      kyc: '/api/kyc',
      credit: '/api/credit',
      approvals: '/api/approvals',
      documents: '/api/documents',
      operations: '/api/operations',
      workflows: '/api/workflows',
      onboarding: '/api/onboarding'
    }
  });
});

// API routes
app.use('/api', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;



