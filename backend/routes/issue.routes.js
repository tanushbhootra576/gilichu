const express = require('express');
const multer = require('multer');
const path = require('path');
const { body } = require('express-validator');
const issueController = require('../controllers/issue.controller');
const chatController = require('../controllers/chat.controller');
const { authenticate, authorizeGovernment } = require('../middlewares/auth.middleware');

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = file.fieldname === 'images' ? 'uploads/images' : 'uploads/audio';
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'images' && file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else if (file.fieldname === 'voiceNote' && file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type for ${file.fieldname}`), false);
        }
    }
});

// Validation middleware
const validateIssue = [
    body('title').trim().isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),
    body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
    body('category').isIn([
        'Roads & Infrastructure',
        'Waste Management',
        'Electricity',
        'Water Supply',
        'Sewage & Drainage',
        'Traffic & Transportation',
        'Public Safety',
        'Parks & Recreation',
        'Street Lighting',
        'Noise Pollution',
        'Other'
    ]).withMessage('Invalid category'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
];

// Get all issues (government only now)
router.get('/', authenticate, authorizeGovernment, issueController.getAllIssues);

// Government overview (counts + recent issues)
router.get('/government/overview', authenticate, authorizeGovernment, issueController.getGovernmentOverview);

// Government full list (unpaginated)
router.get('/all', authenticate, authorizeGovernment, issueController.getAllIssuesFull);

// Government map feed: unresolved issues with coordinates
router.get('/map/unresolved', authenticate, authorizeGovernment, (req, res) => issueController.getUnresolvedIssuesCoordinates(req, res));

// Retroactive clustering (dedupe existing issues) - government only
router.post('/cluster/retroactive', authenticate, authorizeGovernment, issueController.retroactiveCluster);

// Reporter consent for merged issue participation
router.post('/:id/consent', authenticate, issueController.recordConsent);

// Temporary debug route (remove in production): returns raw issue docs
router.get('/debug/raw', authenticate, authorizeGovernment, async (req, res) => {
    try {
        const Issue = require('../models/Issue');
        const issues = await Issue.find({}).sort({ createdAt: -1 }).lean();
        console.log('[DEBUG /issues/debug/raw] count:', issues.length);
        res.json({ success: true, count: issues.length, data: issues });
    } catch (e) {
        console.error('[DEBUG /issues/debug/raw] error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Debug reporters & duplicates for a specific issue (canonical resolution)
router.get('/debug/:id/reporters', authenticate, authorizeGovernment, async (req, res) => {
    try {
        const Issue = require('../models/Issue');
        let issue = await Issue.findById(req.params.id).select('_id mergedInto');
        if (!issue) return res.status(404).json({ success: false, error: 'Issue not found' });
        if (issue.mergedInto) issue = await Issue.findById(issue.mergedInto).select('_id');
        const canonical = await Issue.findById(issue._id)
            .populate('reporters.user', 'name email')
            .populate('duplicates', 'reportedBy createdAt')
            .lean();
        res.json({
            success: true,
            canonicalId: canonical._id,
            reporters: canonical.reporters,
            duplicates: canonical.duplicates,
            votes: canonical.votes,
            voters: canonical.voters
        });
    } catch (e) {
        console.error('[DEBUG /issues/debug/:id/reporters] error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Debug user issues mapping (government) - show canonical resolution
router.get('/debug/user/:userId/issues', authenticate, authorizeGovernment, async (req, res) => {
    try {
        const Issue = require('../models/Issue');
        const userId = req.params.userId;
        const issues = await Issue.find({ reportedBy: userId }).select('_id title mergedInto category status createdAt').lean();
        const out = [];
        for (const iss of issues) {
            let canonicalId = iss._id;
            if (iss.mergedInto) {
                canonicalId = iss.mergedInto;
            }
            out.push({
                issueId: iss._id,
                mergedInto: iss.mergedInto || null,
                canonicalId,
                status: iss.status,
                category: iss.category,
                createdAt: iss.createdAt
            });
        }
        res.json({ success: true, count: out.length, data: out });
    } catch (e) {
        console.error('[DEBUG /issues/debug/user/:userId/issues] error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Get issue statistics
router.get('/statistics', authenticate, issueController.getIssueStatistics);

// Get current user's issues
router.get('/user/me', authenticate, issueController.getUserIssues);

// Get single issue by ID
router.get('/:id', issueController.getIssueById);

// Create new issue
router.post('/',
    authenticate,
    // Enhanced logging middleware for diagnostics
    (req, res, next) => {
        try {
            console.log('============================================================');
            console.log('[ROUTE] POST /api/issues HIT');
            console.log('[ROUTE] Time:', new Date().toISOString());
            console.log('[ROUTE] Content-Type:', req.headers['content-type']);
            console.log('[ROUTE] Authorization present:', !!req.headers['authorization']);
            console.log('[ROUTE] User (from auth middleware):', req.user ? { id: req.user.id, role: req.user.role } : 'NONE');
        } catch (e) {
            console.log('[ROUTE] Preliminary log error:', e.message);
        }
        next();
    },
    upload.fields([
        { name: 'images', maxCount: 5 },
        { name: 'voiceNote', maxCount: 1 }
    ]),
    (req, res, next) => {
        // Log multipart parsing results
        try {
            console.log('[ROUTE] Multer parsed fields keys:', Object.keys(req.body || {}));
            console.log('[ROUTE] Multer files summary:', {
                images: req.files?.images ? req.files.images.map(f => ({ fn: f.filename, size: f.size })) : [],
                voiceNote: req.files?.voiceNote ? req.files.voiceNote.map(f => ({ fn: f.filename, size: f.size })) : []
            });
        } catch (e) {
            console.log('[ROUTE] Multer logging error:', e.message);
        }
        next();
    },
    validateIssue,
    issueController.createIssue
);

// Assign issue to department/official (government only)
router.put('/:id/assign', authenticate, authorizeGovernment, [
    body('department').notEmpty().withMessage('Department is required'),
    body('comment').optional().trim().isLength({ max: 500 }).withMessage('Comment must be less than 500 characters')
], issueController.assignIssue);

// Update issue status (government only)
router.put('/:id/status', authenticate, authorizeGovernment, [
    body('status').isIn(['pending', 'acknowledged', 'assigned', 'in-progress', 'resolved', 'rejected', 'closed']).withMessage('Invalid status'),
    body('comment').optional().trim().isLength({ max: 500 }).withMessage('Comment must be less than 500 characters')
], issueController.updateIssueStatus);

// Vote on issue
router.post('/:id/vote', authenticate, issueController.voteOnIssue);

// Chat routes
router.get('/:id/chat', authenticate, chatController.getMessages);
router.post('/:id/chat', authenticate, chatController.postMessage);

module.exports = router;
