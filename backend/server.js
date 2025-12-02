const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001"
].filter(Boolean);

function isOriginAllowed(origin) {
  if (!origin) return true; // non-browser or same-origin
  if (allowedOrigins.includes(origin)) return true;
  // In development, allow any localhost/127.0.0.1 port
  if ((process.env.NODE_ENV || 'development') !== 'production') {
    try {
      const u = new URL(origin);
      if ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && (u.protocol === 'http:' || u.protocol === 'https:')) {
        return true;
      }
    } catch {}
  }
  return false;
}

const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Middleware
// Basic env validation to avoid accidental misconfig
if (!process.env.CLIENT_URL) {
  console.warn('CLIENT_URL not set; defaulting to http://localhost:3000');
}
if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET not set - using fallback is unsafe in production');
}
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Preflight for invoice/download endpoints and others
app.options('*', cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Smarter rate limiting: higher allowance for GETs, stricter for writes
const getLimiter = rateLimit({ windowMs: 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
app.use('/api/', (req, res, next) => {
  if (req.path === '/health' || req.path === '/status/maintenance') return next();
  if (req.method === 'GET') return getLimiter(req, res, next);
  return writeLimiter(req, res, next);
});

// Request timeout middleware
app.use((req, res, next) => {
  // Set timeout for all requests to 45 seconds (less than frontend 60s timeout)
  let timeoutCleared = false;
  
  const timeoutId = setTimeout(() => {
    if (!res.headersSent && !timeoutCleared) {
      console.error(`Request timeout: ${req.method} ${req.url}`);
      timeoutCleared = true;
      res.status(408).json({
        message: 'Request timeout - server processing took too long',
        success: false
      });
    }
  }, 45000);
  
  // Clear timeout when response is sent
  const clearTimeoutOnce = () => {
    if (!timeoutCleared) {
      clearTimeout(timeoutId);
      timeoutCleared = true;
    }
  };
  
  const originalSend = res.send;
  res.send = function(...args) {
    clearTimeoutOnce();
    return originalSend.apply(this, args);
  };
  
  const originalJson = res.json;
  res.json = function(...args) {
    clearTimeoutOnce();
    return originalJson.apply(this, args);
  };
  
  const originalStatus = res.status;
  res.status = function(...args) {
    clearTimeoutOnce();
    return originalStatus.apply(this, args);
  };
  
  // Also clear timeout on response finish event
  res.on('finish', clearTimeoutOnce);
  res.on('close', clearTimeoutOnce);
  
  next();
});
// Static for chat uploads
app.use('/uploads/chat', express.static(require('path').join(__dirname, 'uploads', 'chat')));
// Static for profile images
app.use('/uploads/profiles', express.static(require('path').join(__dirname, 'uploads', 'profiles')));

// MongoDB Connection with optimized settings
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/roadside-assistance', {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 30000, // Close sockets after 30 seconds of inactivity
  connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
  heartbeatFrequencyMS: 10000, // Check connection every 10 seconds
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
})
.then(() => {
  console.log('✅ MongoDB Connected Successfully');
  
  // Monitor connection events
  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
  });
  
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected');
  });
  
  mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected');
  });
})
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Import Routes
const authRoutes = require('./routes/auth');
const mechanicRoutes = require('./routes/mechanics');
const requestRoutes = require('./routes/requests');
const adminRoutes = require('./routes/admin');
const historyRoutes = require('./routes/history');
const userRoutes = require('./routes/user');
const mechanicPanelRoutes = require('./routes/mechanic');
const paymentRoutes = require('./routes/payments');
const chatRoutes = require('./routes/chat');
const uploadRoutes = require('./routes/upload');
const { maintenanceGuard, optionalAuth } = require('./middleware/auth');

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/mechanics', mechanicRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/history', historyRoutes);
// Backward-compat alias to avoid typos in clients
app.use('/api/histtory', historyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/mechanic', mechanicPanelRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/upload', uploadRoutes);

// Health Check Route
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const dbStatus = mongoose.connection.readyState;
    const dbStatusText = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbStatus];
    
    // Simple database query test
    const queryStart = Date.now();
    await mongoose.connection.db.admin().ping();
    const queryTime = Date.now() - queryStart;
    
    res.json({ 
      message: 'Roadside Assistance API is running!', 
      timestamp: new Date().toISOString(),
      status: 'healthy',
      database: {
        status: dbStatusText,
        pingTime: `${queryTime}ms`
      }
    });
  } catch (error) {
    res.status(503).json({
      message: 'Service unavailable',
      timestamp: new Date().toISOString(),
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Public maintenance status
const mongoose2 = require('mongoose');
const settingsSchema2 = new mongoose2.Schema({ key: String, value: mongoose2.Schema.Types.Mixed }, { collection: 'settings' });
const Setting2 = mongoose2.models.Setting || mongoose2.model('Setting', settingsSchema2);
app.get('/api/status/maintenance', async (req, res) => {
  try {
    const doc = await Setting2.findOne({ key: 'maintenanceMode' });
    res.json({ success: true, maintenance: !!doc?.value });
  } catch (e) {
    res.json({ success: true, maintenance: false });
  }
});

// Socket.IO Connection Handling
const socketHandler = require('./socket/socketHandler');
socketHandler(io);

// Make io instance available to routes
app.set('io', io);

// Apply maintenance guard after health and status endpoints are defined
app.use(optionalAuth, maintenanceGuard);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!', 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5002;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
});
