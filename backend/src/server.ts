// server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser'; // Add this
import dotenv from 'dotenv';
import { Server } from 'http';
import taskRoutes from './routes/tasks';
import authRoutes from './routes/auth'; // Add this import
import { initializeDatabase, checkDatabaseHealth, DatabaseInitError } from './db/init';

// Load environment variables
dotenv.config();
console.log('🔍 Database config check:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***HIDDEN***' : 'NOT SET');
const app = express();
const port = process.env.PORT || 5000;
const isDevelopment = process.env.NODE_ENV !== 'production';

// Declare server variable at module level
let server: Server;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 100, // limit each IP to 100 requests per windowMs in production
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Compression middleware
app.use(compression());

// CORS configuration
const corsOptions = {
  origin: isDevelopment 
    ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:9002', 'http://localhost:9000'] 
    : process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Set-Cookie'],
  preflightContinue: false,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Cookie parser middleware (for JWT tokens in cookies)
app.use(cookieParser());

// Add additional headers middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && corsOptions.origin.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`[${timestamp}] ${method} ${url} - ${ip}`);
  
  // Log response time
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    console.log(`[${timestamp}] ${method} ${url} - ${status} - ${duration}ms`);
  });
  
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Comprehensive health check
app.get('/health/detailed', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    const healthStatus = {
      status: dbHealth.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth,
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          platform: process.platform,
          nodeVersion: process.version
        }
      }
    };
    
    const statusCode = dbHealth.healthy ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Database initialization endpoint (for development/testing)
app.post('/admin/init-db', async (req, res) => {
  if (!isDevelopment && req.headers.authorization !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    await initializeDatabase();
    res.json({ 
      message: 'Database initialized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database initialization error:', error);
    res.status(500).json({ 
      error: 'Database initialization failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  const apiDocs = {
    title: 'Task Management API',
    version: '1.0.0',
    description: 'RESTful API for task management with attachments and comments',
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    endpoints: {
      auth: {
        'POST /auth/register': 'Register a new user',
        'POST /auth/login': 'Login user',
        'POST /auth/logout': 'Logout user',
        'GET /auth/me': 'Get current user info',
        'GET /users': 'Get all users (authenticated)'
      },
      tasks: {
        'GET /tasks': 'Get all tasks with pagination and filtering',
        'GET /tasks/:id': 'Get a specific task by ID',
        'POST /tasks': 'Create a new task',
        'PUT /tasks/:id': 'Update a task',
        'DELETE /tasks/:id': 'Delete a task',
        'GET /tasks/user/:userId': 'Get tasks by user ID',
        'GET /tasks/stats/overview': 'Get task statistics',
        'POST /tasks/:id/comments': 'Add comment to a task',
        'PATCH /tasks/bulk/status': 'Bulk update task status'
      },
      health: {
        'GET /health': 'Basic health check',
        'GET /health/detailed': 'Detailed health check with database status'
      }
    },
    authentication: 'JWT tokens via cookies or Authorization header',
    rateLimit: `${isDevelopment ? 1000 : 100} requests per 15 minutes per IP`,
  };
  
  res.json(apiDocs);
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.method} ${req.originalUrl} does not exist`,
    availableRoutes: [
      'GET /health',
      'GET /health/detailed', 
      'GET /api/docs',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/logout',
      'GET /api/auth/me',
      'GET /api/users',
      'GET /api/tasks',
      'POST /api/tasks',
      'GET /api/tasks/:id',
      'PUT /api/tasks/:id',
      'DELETE /api/tasks/:id'
    ]
  });
});

// Global error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const timestamp = new Date().toISOString();
  const errorId = Math.random().toString(36).substring(7);
  
  // Log error with ID for tracking
  console.error(`[${timestamp}] Error ${errorId}:`, {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Don't expose internal errors in production
  const errorResponse = {
    error: 'Internal server error',
    errorId,
    timestamp,
    ...(isDevelopment && {
      message: err.message,
      stack: err.stack
    })
  };
  
  res.status(err.status || 500).json(errorResponse);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Initialize database and start server
const startServer = async () => {
  try {
    console.log('🚀 Starting server...');
    
    // Initialize database
    await initializeDatabase();
    
    // Start server and assign to module-level variable
    server = app.listen(port, () => {
      console.log(`✅ Server is running on port ${port}`);
      console.log(`🔗 Health check: http://localhost:${port}/health`);
      console.log(`📚 API docs: http://localhost:${port}/api/docs`);
      console.log(`🔐 Auth endpoints: http://localhost:${port}/api/auth/*`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      
      if (isDevelopment) {
        console.log('🔧 Development mode - Debug logging enabled');
        console.log('📝 Environment variables:', {
          DB_HOST: process.env.DB_HOST,
          DB_PORT: process.env.DB_PORT,
          DB_NAME: process.env.DB_NAME,
          DB_USER: process.env.DB_USER
        });
      }
    });
    
  } catch (error) {
    if (error instanceof DatabaseInitError) {
      console.error('❌ Database initialization failed:', error.message);
    } else {
      console.error('❌ Failed to start server:', error);
    }
    process.exit(1);
  }
};


// Start the server
startServer();

export default app;