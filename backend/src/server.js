/**
 * IoT Smart System - Backend API Server
 * ====================================
 * 
 * این سرور وظایف زیر را انجام می‌دهد:
 * - API endpoints برای frontend
 * - مدیریت MQTT messaging
 * - احراز هویت و authorization
 * - Real-time communication با WebSocket
 * - مدیریت دیتابیس
 * - فایل‌های آپلود و ذخیره‌سازی
 * 
 * نویسنده: تیم توسعه IoT
 * نسخه: 1.0.0
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const redis = require('redis');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Local imports
const mqttService = require('./services/mqttService');
const deviceService = require('./services/deviceService');
const authService = require('./services/authService');
const webSocketService = require('./services/webSocketService');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

// Routes
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const sensorRoutes = require('./routes/sensors');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes = require('./routes/users');
const alertRoutes = require('./routes/alerts');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Constants
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_smart_system';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Setup middleware
 */
function setupMiddleware() {
    // Security middleware
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
            },
        },
    }));

    // CORS
    app.use(cors({
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true
    }));

    // Compression
    app.use(compression());

    // Request logging
    app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

    // Rate limiting
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // limit each IP to 1000 requests per windowMs
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use(limiter);

    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Static files
    app.use('/uploads', express.static('uploads'));
    app.use('/public', express.static('public'));
}

/**
 * Setup database connections
 */
async function setupDatabases() {
    try {
        // MongoDB connection
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        logger.info('MongoDB connected successfully');

        // Redis connection
        const redisClient = redis.createClient({ url: REDIS_URL });
        await redisClient.connect();
        app.locals.redis = redisClient;
        logger.info('Redis connected successfully');

    } catch (error) {
        logger.error('Database connection failed:', error);
        process.exit(1);
    }
}

/**
 * Setup Swagger documentation
 */
function setupSwagger() {
    const options = {
        definition: {
            openapi: '3.0.0',
            info: {
                title: 'IoT Smart System API',
                version: '1.0.0',
                description: 'RESTful API برای سیستم IoT هوشمند',
                contact: {
                    name: 'IoT Development Team',
                    email: 'dev@iot-system.com'
                }
            },
            servers: [
                {
                    url: `http://localhost:${PORT}`,
                    description: 'Development server'
                },
                {
                    url: 'https://api.iot-system.com',
                    description: 'Production server'
                }
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT'
                    }
                }
            }
        },
        apis: ['./src/routes/*.js', './src/models/*.js']
    };

    const specs = swaggerJsdoc(options);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }'
    }));
}

/**
 * Setup routes
 */
function setupRoutes() {
    // Health check
    app.get('/health', (req, res) => {
        res.json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0'
        });
    });

    // API routes
    app.use('/api/auth', authRoutes);
    app.use('/api/devices', deviceRoutes);
    app.use('/api/sensors', sensorRoutes);
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/alerts', alertRoutes);

    // WebSocket events
    io.on('connection', (socket) => {
        logger.info(`New WebSocket connection: ${socket.id}`);
        webSocketService.handleConnection(socket, io);
    });

    // 404 handler
    app.use(notFound);

    // Error handler
    app.use(errorHandler);
}

/**
 * Initialize services
 */
async function initializeServices() {
    try {
        // MQTT Service
        await mqttService.initialize(io);
        logger.info('MQTT service initialized');

        // Device Service
        await deviceService.initialize();
        logger.info('Device service initialized');

        // WebSocket Service
        webSocketService.initialize(io);
        logger.info('WebSocket service initialized');

    } catch (error) {
        logger.error('Service initialization failed:', error);
        throw error;
    }
}

/**
 * Graceful shutdown
 */
function setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        
        // Close server
        server.close(async () => {
            logger.info('HTTP server closed');
            
            try {
                // Close database connections
                await mongoose.connection.close();
                logger.info('MongoDB connection closed');
                
                if (app.locals.redis) {
                    await app.locals.redis.quit();
                    logger.info('Redis connection closed');
                }
                
                // Close MQTT connection
                await mqttService.disconnect();
                logger.info('MQTT connection closed');
                
                process.exit(0);
            } catch (error) {
                logger.error('Error during shutdown:', error);
                process.exit(1);
            }
        });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

/**
 * Main application startup
 */
async function startServer() {
    try {
        logger.info('Starting IoT Smart System Backend...');

        // Setup components
        setupMiddleware();
        await setupDatabases();
        setupSwagger();
        setupRoutes();
        await initializeServices();
        setupGracefulShutdown();

        // Start server
        server.listen(PORT, () => {
            logger.info(`🚀 Server running on port ${PORT}`);
            logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
            logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Global error handlers
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the application
if (require.main === module) {
    startServer();
}

module.exports = { app, server, io };
