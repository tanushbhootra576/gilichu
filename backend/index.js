require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { ensureUploadDirs } = require('./utils/ensureUploadDirs');
const { log, warn } = require('./utils/logger');
const authRoutes = require('./routes/auth.routes');
const issueRoutes = require('./routes/issue.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const notificationRoutes = require('./routes/notification.routes');
const alertRoutes = require('./routes/alert.routes');
const predictRoutes = require('./routes/predict.routes');
const uploadRoutes = require('./routes/upload.routes');
const mailRoutes = require('./routes/mail.routes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: function (origin, callback) {
            // Allow any origin for development (you can restrict this for production)
            callback(null, true);
        },
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Middleware

// Configure Helmet: allow popups (needed for Firebase auth) and disable COEP for dev
app.use(helmet({
    crossOriginOpenerPolicy: {
        policy: 'same-origin-allow-popups' // This allows Google auth popups
    },
    contentSecurityPolicy: false // Temporarily disable CSP for development
}));
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:5175'
        ];
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
// Ensure upload directories exist early (important for fresh deployments)
ensureUploadDirs();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Attach socket.io instance to each request for controllers to emit events
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Import routes

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/predict', predictRoutes);
app.use('/api/mail', mailRoutes);

// Root route
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Civic Pulse API' });
});

// Socket.io connection
io.on('connection', (socket) => {
    log('New client connected socketId=', socket.id, 'auth=', socket.handshake?.auth, 'query=', socket.handshake?.query);
    try {
        const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
        if (userId) {
            socket.join(userId.toString());
            log('[socket] joined personal room for user', userId);
        }
        socket.on('registerUser', (uid) => {
            if (uid) {
                socket.join(uid.toString());
                log('[socket] registerUser -> joined personal room', uid);
            }
        });
    } catch (e) {
        warn('[socket] error establishing personal room', e.message);
    }

    socket.on('disconnect', () => {
        log('Client disconnected socketId=', socket.id);
    });

    // Handle live updates for issues
    socket.on('newIssue', (data) => {
        log('[socket] newIssue relay issueId=', data?.issue?._id);
        io.emit('issueUpdate', data);
    });

    socket.on('statusChange', (data) => {
        log('[socket] statusChange relay issueId=', data?.issueId, 'status=', data?.status);
        io.emit('issueUpdate', data);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Server error'
    });
});

// Health endpoint (DB status + time)
app.get('/api/health', (req, res) => {
    const stateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    res.json({
        status: 'ok',
        dbState: stateMap[mongoose.connection.readyState] || 'unknown',
        time: new Date().toISOString()
    });
});

// Start server
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Listen on all network interfaces
connectDB().then(() => {
    server.listen(PORT, HOST, () => {
        console.log(`Server running on http://${HOST}:${PORT}`);
        console.log(`Server accessible on local network`);
    });
});

module.exports = { app, io };
