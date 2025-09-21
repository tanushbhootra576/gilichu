const Issue = require('../models/Issue');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { computePriority } = require('../utils/priority');
const { uploadBuffer } = require('../config/cloudinary');
const { log, warn, error } = require('../utils/logger');
const mailController = require('./mail.controller');

class IssueController {
    // Government map feed: unresolved issues with coordinates only
    async getUnresolvedIssuesCoordinates(req, res) {
        try {
            if (!req.user || req.user.role !== 'government') {
                return res.status(403).json({ success: false, error: 'Forbidden' });
            }

            // Canonical issues only (exclude merged duplicates), status not resolved
            const filter = {
                mergedInto: { $exists: false },
                status: { $ne: 'resolved' },
                // Ensure coordinates exist
                'location.coordinates.0': { $exists: true },
                'location.coordinates.1': { $exists: true }
            };

            const issues = await Issue.find(filter)
                .select('_id title status category priority location.coordinates location.address thumbnailImage createdAt')
                .lean();

            const data = (issues || []).map(doc => {
                const coords = Array.isArray(doc.location?.coordinates) ? doc.location.coordinates : [];
                const [lng, lat] = coords;
                return {
                    id: doc._id,
                    title: doc.title,
                    status: doc.status,
                    category: doc.category,
                    priority: doc.priority || 'low',
                    address: doc.location?.address || '',
                    coordinates: { lat, lng },
                    thumbnailImage: doc.thumbnailImage || null,
                    date: doc.createdAt
                };
            }).filter(p => Number.isFinite(p.coordinates?.lat) && Number.isFinite(p.coordinates?.lng));

            return res.json({ success: true, data });
        } catch (e) {
            console.error('[getUnresolvedIssuesCoordinates] error', e);
            return res.status(500).json({ success: false, error: 'Failed to fetch unresolved issues for map', message: e.message });
        }
    }
    // Get all issues with comprehensive filtering and pagination
    async getAllIssues(req, res) {
        try {
            // Failsafe: ensure only government role (route already guards but double-check)
            if (!req.user || req.user.role !== 'government') {
                return res.status(403).json({ success: false, error: 'Forbidden' });
            }
            const {
                status,
                category,
                priority,
                assignedTo,
                reportedBy,
                location,
                page = 1,
                limit = 10,
                sortBy = 'createdAt',
                sortOrder = 'desc',
                search,
                dateFrom,
                dateTo
            } = req.query;

            // Build filter object
            const filter = { mergedInto: { $exists: false } }; // only canonical

            if (status) filter.status = status;
            if (category) filter.category = category;
            if (priority) filter.priority = priority;
            if (assignedTo) filter['assignedTo.official'] = assignedTo;
            if (reportedBy) filter.reportedBy = reportedBy;

            // Date range filter
            if (dateFrom || dateTo) {
                filter.createdAt = {};
                if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
                if (dateTo) filter.createdAt.$lte = new Date(dateTo);
            }

            // Search functionality
            if (search) {
                filter.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                    { 'location.address': { $regex: search, $options: 'i' } },
                    { category: { $regex: search, $options: 'i' } }
                ];
            }

            // Location-based search
            if (location) {
                const [lng, lat, radius] = location.split(',');
                if (lng && lat) {
                    filter['location.coordinates'] = {
                        $near: {
                            $geometry: {
                                type: 'Point',
                                coordinates: [parseFloat(lng), parseFloat(lat)]
                            },
                            $maxDistance: parseInt(radius) || 5000 // default 5km
                        }
                    };
                }
            }

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
                populate: [
                    { path: 'reportedBy', select: 'name email phone role' },
                    { path: 'assignedTo.official', select: 'name email department' },
                    { path: 'resolutionDetails.resolvedBy', select: 'name email' },
                    { path: 'statusHistory.updatedBy', select: 'name email' }
                ]
            };

            log('[GOV getAllIssues] START page=', page, 'limit=', limit, 'filter=', JSON.stringify(filter));
            const issues = await Issue.paginate(filter, options);
            log('[GOV getAllIssues] fetched canonical count=', issues.docs.length, 'totalDocsRaw=', issues.totalDocs);
            // Quick heuristic: find possible near duplicates not merged (same category, < 120m) for debugging
            try {
                const sample = issues.docs.slice(0, 50); // limit debug cost
                for (let i = 0; i < sample.length; i++) {
                    for (let j = i + 1; j < sample.length; j++) {
                        const A = sample[i];
                        const B = sample[j];
                        if (A.category !== B.category) continue;
                        const [lngA, latA] = A.location.coordinates;
                        const [lngB, latB] = B.location.coordinates;
                        const dLng = (lngA - lngB) * Math.PI / 180;
                        const dLat = (latA - latB) * Math.PI / 180;
                        const a = Math.sin(dLat/2)**2 + Math.cos(latA*Math.PI/180) * Math.cos(latB*Math.PI/180) * Math.sin(dLng/2)**2;
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                        const dist = 6378137 * c;
                        if (dist < 120) {
                            log('[GOV getAllIssues][DEBUG] Close canonical pair not merged', A._id.toString(), B._id.toString(), 'dist(m)=', Math.round(dist));
                        }
                    }
                }
            } catch (dbgErr) {
                warn('[GOV getAllIssues][DEBUG] proximity scan failed', dbgErr.message);
            }

            // Enrich with reporters count and duplicates count
            const enriched = issues.docs.map(doc => {
                const reportersArr = doc.reporters || [];
                const consenting = reportersArr.filter(r => r.consent === true).length;
                return {
                    ...doc.toObject(),
                    reportersCount: reportersArr.length,
                    consentingReportersCount: consenting,
                    duplicatesCount: (doc.duplicates || []).length,
                    thumbnailImage: doc.thumbnailImage || (doc.images?.[0] || null)
                };
            });

            res.json({
                success: true,
                data: enriched,
                pagination: {
                    totalCount: issues.totalDocs,
                    currentPage: issues.page,
                    totalPages: issues.totalPages,
                    limit: issues.limit
                }
            });
        } catch (error) {
            error('Error fetching issues:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch issues',
                message: error.message
            });
        }
    }

    // Retroactive deduplication: scans recent canonical issues and merges close duplicates (government only)
    async retroactiveCluster(req, res) {
        try {
            if (!req.user || req.user.role !== 'government') {
                return res.status(403).json({ success: false, error: 'Forbidden' });
            }
            const { lookbackHours = 720, radiusMeters = 100, category } = req.query;
            const since = new Date(Date.now() - parseInt(lookbackHours) * 3600 * 1000);
            const baseFilter = { createdAt: { $gte: since } };
            if (category) baseFilter.category = category;
            // Pull canonical only first
            const canonicals = await Issue.find({ ...baseFilter, mergedInto: { $exists: false } })
                .sort({ createdAt: 1 })
                .limit(500) // safety cap
                .exec();
            let mergeOps = 0;
            // Simple O(n^2) within cap using haversine
            for (let i = 0; i < canonicals.length; i++) {
                const A = canonicals[i];
                if (A.mergedInto) continue; // may have been merged during loop
                const [lngA, latA] = A.location.coordinates;
                for (let j = i + 1; j < canonicals.length; j++) {
                    const B = canonicals[j];
                    if (B.mergedInto) continue;
                    if (A.category !== B.category) continue;
                    const [lngB, latB] = B.location.coordinates;
                    const dLat = (latA - latB) * Math.PI / 180;
                    const dLng = (lngA - lngB) * Math.PI / 180;
                    const a = Math.sin(dLat/2)**2 + Math.cos(latA*Math.PI/180) * Math.cos(latB*Math.PI/180) * Math.sin(dLng/2)**2;
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    const dist = 6378137 * c;
                    if (dist <= radiusMeters) {
                        // Merge newer (B) into older (A)
                        const canonical = A.createdAt <= B.createdAt ? A : B;
                        const duplicate = canonical === A ? B : A;
                        canonical.duplicates = canonical.duplicates || [];
                        canonical.reporters = canonical.reporters || [];
                        if (!canonical.reporters.some(r => r.toString() === duplicate.reportedBy.toString())) {
                            canonical.reporters.push(duplicate.reportedBy);
                        }
                        canonical.duplicates.push(duplicate._id);
                        duplicate.mergedInto = canonical._id;
                        await duplicate.save();
                        await canonical.save();
                        mergeOps++;
                        console.log('[retroactiveCluster] merged', duplicate._id.toString(), 'into', canonical._id.toString(), 'dist(m)=', Math.round(dist));
                    }
                }
            }
            return res.json({ success: true, mergedPairs: mergeOps });
        } catch (e) {
            console.error('[retroactiveCluster] error', e);
            res.status(500).json({ success: false, error: e.message });
        }
    }

    // Record reporter consent for merged-in participation and chat access
    async recordConsent(req, res) {
        try {
            const { id } = req.params; // canonical or duplicate id
            const { accept } = req.body;
            if (typeof accept !== 'boolean') {
                return res.status(400).json({ success: false, error: 'accept boolean required' });
            }
            let issue = await Issue.findById(id).select('_id mergedInto reporters votes voters').exec();
            if (!issue) return res.status(404).json({ success: false, error: 'Issue not found' });
            if (issue.mergedInto) issue = await Issue.findById(issue.mergedInto).select('_id reporters votes voters').exec();
            const userId = req.user.id;
            const entry = issue.reporters.find(r => r.user?.toString() === userId);
            if (!entry) {
                return res.status(403).json({ success: false, error: 'You are not a reporter on this issue' });
            }
            // Only update if currently null or different
            entry.consent = accept;
            await issue.save();
            // Notify user of confirmation
            req.io?.to(userId.toString()).emit('issueConsentUpdated', { issueId: issue._id, consent: accept });
            return res.json({ success: true, data: { issueId: issue._id, consent: accept } });
        } catch (e) {
            console.error('[recordConsent] error', e);
            res.status(500).json({ success: false, error: e.message });
        }
    }

    // Government overview: aggregate counts + recent issues
    async getGovernmentOverview(req, res) {
        try {
            if (!req.user || req.user.role !== 'government') {
                return res.status(403).json({ success: false, error: 'Forbidden' });
            }

            // Aggregate counts by status
            const statusPipeline = [
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ];
            const statusResults = await Issue.aggregate(statusPipeline);
            const counts = statusResults.reduce((acc, cur) => {
                acc[cur._id] = cur.count;
                return acc;
            }, {});

            const total = Object.values(counts).reduce((a, b) => a + b, 0);

            // Recent issues (latest 10)
            const recentIssues = await Issue.find({})
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('reportedBy', 'name role')
                .lean();

            const normalized = recentIssues.map(doc => ({
                id: doc._id,
                title: doc.title,
                description: doc.description,
                category: doc.category,
                priority: doc.priority || 'low',
                reporter: doc.reportedBy ? { name: doc.reportedBy.name, id: doc.reportedBy._id } : null,
                location: doc.location ? { address: doc.location.address } : null,
                date: doc.createdAt,
                status: doc.status,
                votes: doc.votes || 0,
                updates: (doc.statusHistory || []).length
            }));

            res.json({
                success: true,
                data: {
                    counts: {
                        total: total,
                        submitted: counts['pending'] || 0,
                        resolved: counts['resolved'] || 0,
                        'in-progress': counts['in-progress'] || 0
                    },
                    recent: normalized
                }
            });
        } catch (error) {
            console.error('Error building government overview:', error);
            res.status(500).json({ success: false, error: 'Failed to build overview', message: error.message });
        }
    }

    // Full list of all issues (no pagination) for government
    async getAllIssuesFull(req, res) {
        try {
            if (!req.user || req.user.role !== 'government') {
                return res.status(403).json({ success: false, error: 'Forbidden' });
            }
            console.log('[getAllIssuesFull] user:', req.user.id, 'role:', req.user.role, 'time:', new Date().toISOString());
            log('[GOV getAllIssuesFull] fetching canonical issues only');
            const issues = await Issue.find({ mergedInto: { $exists: false } })
                .sort({ createdAt: -1 })
                .populate('reportedBy', 'name email role')
                .lean();
            log('[GOV getAllIssuesFull] result count=', issues.length);

            console.log('[getAllIssuesFull] total issues found:', issues.length);

            const data = issues.map(doc => ({
                id: doc._id,
                title: doc.title,
                description: doc.description,
                category: doc.category,
                priority: doc.priority,
                status: doc.status,
                reporter: doc.reportedBy ? { id: doc.reportedBy._id, name: doc.reportedBy.name } : null,
                location: doc.location ? { address: doc.location.address } : null,
                date: doc.createdAt,
                votes: doc.votes || 0,
                reportersCount: (doc.reporters || []).length,
                consentingReportersCount: (doc.reporters || []).filter(r => r.consent === true).length,
                duplicatesCount: (doc.duplicates || []).length,
                thumbnailImage: doc.thumbnailImage || (doc.images?.[0] || null)
            }));

            res.json({ success: true, data });
        } catch (error) {
            error('Error fetching full issue list:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch issues', message: error.message });
        }
    }

    // Create new issue
    async createIssue(req, res) {
        try {
            log('[CTRL createIssue] START ------------------------------------------------');
            log('[CTRL createIssue] Time:', new Date().toISOString());
            log('[CTRL createIssue] Content-Type:', req.headers['content-type']);
            log('[CTRL createIssue] Auth user object:', req.user ? { id: req.user.id, role: req.user.role, email: req.user.email } : 'NONE');
            log('[CTRL createIssue] Raw body keys:', Object.keys(req.body || {}));
            log('[CTRL createIssue] Incoming body snippet:', JSON.stringify({
                title: req.body?.title,
                category: req.body?.category,
                hasLocation: !!req.body?.location,
                locationLength: req.body?.location ? String(req.body.location).length : 0
            }));
            log('[CTRL createIssue] Files summary:', {
                images: Array.isArray(req.files?.images) ? req.files.images.map(f => ({ name: f.filename, size: f.size })) : [],
                voiceNote: Array.isArray(req.files?.voiceNote) ? req.files.voiceNote.map(f => ({ name: f.filename, size: f.size })) : []
            });
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                    warn('[CTRL createIssue] Validation errors:', errors.array());
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const {
                title,
                description,
                category,
                location,
                priority = 'low'
            } = req.body;

                // Handle file uploads OR already-uploaded Cloudinary URLs sent from frontend
                let images = [];
                if (req.files?.images) {
                    log('[CTRL createIssue] Detected', req.files.images.length, 'image file(s) for server-side Cloudinary upload');
                    const uploadPromises = req.files.images.map(async (file, idx) => {
                        const label = file.originalname || `buffer-${idx}`;
                        const start = Date.now();
                        try {
                            log(`[CTRL createIssue] [Upload->Cloudinary] START name=${label} size=${file.size}B type=${file.mimetype}`);
                            const result = await uploadBuffer(file.buffer, 'issues', label, file.mimetype);
                            const ms = Date.now() - start;
                            log(`[CTRL createIssue] [Upload->Cloudinary] SUCCESS name=${label} url=${result.secure_url} bytes=${file.size} timeMs=${ms}`);
                            return result.secure_url;
                        } catch (e) {
                            const ms = Date.now() - start;
                            error(`[CTRL createIssue] [Upload->Cloudinary] FAIL name=${label} timeMs=${ms} err=${e.message}`);
                            return null;
                        }
                    });
                    const uploaded = await Promise.all(uploadPromises);
                    images = uploaded.filter(Boolean);
                    const failed = req.files.images.length - images.length;
                    log('[CTRL createIssue] Cloudinary upload summary: success=', images.length, 'failed=', failed);
                    if (images.length === 0) {
                        warn('[CTRL createIssue] WARNING: All Cloudinary uploads failed. Check credentials and network.', {
                            hasCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
                            hasApiKey: !!process.env.CLOUDINARY_API_KEY,
                            hasApiSecret: !!process.env.CLOUDINARY_API_SECRET
                        });
                    }
                } else if (req.body.images || req.body.imageUrls) {
                    log('[CTRL createIssue] Using client-provided image URL path (no file buffers)');
                    // Accept either a JSON string or an array
                    const raw = req.body.images || req.body.imageUrls;
                    try {
                        if (typeof raw === 'string') {
                            images = JSON.parse(raw);
                        } else if (Array.isArray(raw)) {
                            images = raw;
                        }
                    } catch (e) {
                        warn('[CTRL createIssue] Failed to parse incoming image URLs:', e.message);
                    }
                    if (!Array.isArray(images)) images = [];
                    // Basic URL validation
                    const beforeFilter = images.length;
                    images = images.filter(u => typeof u === 'string' && /^https?:\/\//.test(u));
                    log('[CTRL createIssue] Accepted', images.length, 'URL(s); filtered out', beforeFilter - images.length);
                }
                // Voice note: (optional) still on disk approach not supported now; future: upload to cloudinary with resource_type: 'video' or 'raw'
                const voiceNote = null;

            // Parse & normalize location data (support multiple client formats)
            let locationData = null;
            try {
                if (location) {
                    if (typeof location === 'string') {
                        // Could be JSON string OR plain address string
                        if (location.trim().startsWith('{')) {
                            locationData = JSON.parse(location);
                        } else {
                            // treat as plain address (no coordinates)
                            locationData = { address: location.trim() };
                        }
                    } else if (typeof location === 'object') {
                        locationData = location;
                    }
                }
            } catch (e) {
                        warn('[CTRL createIssue] Location parse error. Raw value:', location, 'err:', e.message);
                return res.status(400).json({ success: false, message: 'Invalid location format' });
            }

            // Accept alternate lat/lng fields (lat,lng) or (latitude,longitude) arriving separately in body
            const rawLat = req.body.latitude || req.body.lat;
            const rawLng = req.body.longitude || req.body.lng || req.body.long;
            if (locationData && (!locationData.coordinates || !Array.isArray(locationData.coordinates))) {
                if (rawLat && rawLng) {
                    const latNum = parseFloat(rawLat);
                    const lngNum = parseFloat(rawLng);
                    if (!isNaN(latNum) && !isNaN(lngNum)) {
                        locationData.coordinates = [lngNum, latNum]; // GeoJSON expects [lng, lat]
                        log('[CTRL createIssue] Derived coordinates from separate fields');
                    }
                } else if (locationData.lat && locationData.lng) {
                    const latNum = parseFloat(locationData.lat);
                    const lngNum = parseFloat(locationData.lng);
                    if (!isNaN(latNum) && !isNaN(lngNum)) {
                        locationData.coordinates = [lngNum, latNum];
                        log('[CTRL createIssue] Derived coordinates from locationData.lat/lng');
                    }
                }
            }

            if (!locationData || !Array.isArray(locationData.coordinates) || locationData.coordinates.length !== 2) {
                warn('[CTRL createIssue] Missing or invalid coordinates in locationData (will reject). Provided:', locationData);
                return res.status(400).json({ success: false, message: 'Location coordinates required (lng,lat)' });
            }
            if (!locationData.address) {
                log('[CTRL createIssue] Missing address field in locationData. Provided object:', locationData);
                // Not fatal yet, but supply placeholder address to satisfy schema
                locationData.address = 'Address not specified';
            }

            // Calculate estimated resolution time based on category and priority (standalone helper to avoid lost `this` context)
            const estimatedTime = calculateEstimatedResolutionTime(category, priority);

            let issue = new Issue({
                title,
                description,
                category,
                location: {
                    type: 'Point',
                    coordinates: locationData.coordinates,
                    address: locationData.address,
                    city: locationData.city,
                    state: locationData.state,
                    pincode: locationData.pincode
                },
                    images, // now array of Cloudinary URLs
                voiceNote,
                reportedBy: req.user.id,
                priority,
                // reporters array now handled by pre-save hook (adds creator with consent true)
                estimatedResolutionTime: estimatedTime,
                statusHistory: [{
                    status: 'pending',
                    comment: 'Issue reported by citizen',
                    timestamp: new Date()
                }],
                notifications: [{
                    message: 'Your issue has been successfully reported and is under review',
                    type: 'status_change',
                    timestamp: new Date()
                }]
            });

            try {
                await issue.save();
                log('[CTRL createIssue] Issue saved with _id:', issue._id);
            } catch (saveErr) {
                error('[CTRL createIssue] Mongoose save error:', saveErr.message);
                if (saveErr.name === 'ValidationError') {
                    const fieldErrors = Object.keys(saveErr.errors).map(k => ({ field: k, message: saveErr.errors[k].message }));
                    console.log('[CTRL createIssue] Validation errors detailed:', fieldErrors);
                    return res.status(400).json({ success: false, message: 'Validation failed', errors: fieldErrors });
                }
                return res.status(500).json({ success: false, message: 'Database save failed', error: saveErr.message });
            }
            await issue.populate([{ path: 'reportedBy', select: 'name email phone' }]);
            // Preserve raw reporter id for socket room targeting before population side-effects
            const reporterId = req.user.id;

            // Duplicate merge logic: find existing canonical issue in same category within 100m
            try {
                const [lng, lat] = issue.location.coordinates;
                let nearbyCanonical = await Issue.findOne({
                    _id: { $ne: issue._id },
                    category: issue.category,
                    mergedInto: { $exists: false },
                    location: {
                        $geoWithin: {
                            $centerSphere: [[lng, lat], 100 / 6378137]
                        }
                    }
                }).sort({ createdAt: 1 }).exec();

                // Fallback 1: bounding box + manual haversine if geoWithin returns nothing (possible index issues)
                if (!nearbyCanonical) {
                    log('[CTRL createIssue] MERGE: geoWithin found none, running fallback bounding-box scan');
                    const RADIUS_METERS = 100;
                    const METERS_PER_DEG_LAT = 111_320; // approximate
                    const deltaLat = RADIUS_METERS / METERS_PER_DEG_LAT;
                    const metersPerDegLng = 111_320 * Math.cos(lat * Math.PI / 180);
                    const deltaLng = RADIUS_METERS / metersPerDegLng;
                    const minLat = lat - deltaLat;
                    const maxLat = lat + deltaLat;
                    const minLng = lng - deltaLng;
                    const maxLng = lng + deltaLng;
                    const candidates = await Issue.find({
                        _id: { $ne: issue._id },
                        category: issue.category,
                        mergedInto: { $exists: false },
                        'location.coordinates.0': { $gte: minLng, $lte: maxLng },
                        'location.coordinates.1': { $gte: minLat, $lte: maxLat }
                    }).sort({ createdAt: 1 }).limit(10).exec();
                    for (const cand of candidates) {
                        const [cLng, cLat] = cand.location.coordinates;
                        const dLat = (lat - cLat) * Math.PI / 180;
                        const dLng = (lng - cLng) * Math.PI / 180;
                        const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180) * Math.cos(cLat*Math.PI/180) * Math.sin(dLng/2)**2;
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                        const dist = 6378137 * c;
                        if (dist <= RADIUS_METERS) {
                            nearbyCanonical = cand;
                            log('[CTRL createIssue] MERGE: Fallback bounding-box+Haversine matched canonical', cand._id.toString(), 'distance(m)=', Math.round(dist));
                            break;
                        }
                    }
                    if (!nearbyCanonical) {
                        log('[CTRL createIssue] MERGE: Fallback also found none');
                    }
                }

                if (nearbyCanonical) {
                    log('[CTRL createIssue] MERGE: Found canonical issue', nearbyCanonical._id.toString(), 'for new issue', issue._id.toString());
                    // Update canonical reporters & duplicates (reporters now objects)
                    nearbyCanonical.reporters = nearbyCanonical.reporters || [];
                    const alreadyReporter = nearbyCanonical.reporters.some(r => r.user?.toString() === reporterId);
                    if (!alreadyReporter) {
                        nearbyCanonical.reporters.push({ user: reporterId, consent: null, joinedAt: new Date() });
                        // Auto-increment votes to reflect crowd interest if not already voted
                        if (!nearbyCanonical.voters.some(v => v.toString() === reporterId)) {
                            nearbyCanonical.voters.push(reporterId);
                            nearbyCanonical.votes += 1;
                        }
                    }
                    nearbyCanonical.duplicates = nearbyCanonical.duplicates || [];
                    nearbyCanonical.duplicates.push(issue._id);
                    await nearbyCanonical.save();

                    // Mark new issue as merged
                    issue.mergedInto = nearbyCanonical._id;
                    // Inherit thumbnail if canonical lacks one and new issue has images
                    if (!nearbyCanonical.thumbnailImage && images.length) {
                        nearbyCanonical.thumbnailImage = images[0];
                        await nearbyCanonical.save();
                    }
                    await issue.save();
                        log('[CTRL createIssue] MERGE: New issue marked duplicate of', nearbyCanonical._id.toString());

                    // Recompute priority on canonical after adding reporter (vote logic separate)
                    try {
                        const result = await computePriority(nearbyCanonical);
                        nearbyCanonical.priority = result.priority;
                        nearbyCanonical.priorityReasons = result.reasons;
                        await nearbyCanonical.save();
                        log('[CTRL createIssue] MERGE: Canonical priority recomputed', result);
                    } catch (e) {
                        warn('[CTRL createIssue] MERGE: priority recompute failed', e.message);
                    }

                    // Emit consent request ONLY to the new reporter (targeted)
                    try {
                        const roomId = reporterId.toString();
                        let room = req.io?.sockets?.adapter?.rooms?.get(roomId);
                        log('[CTRL createIssue] MERGE: consent emit targeting room', roomId, 'currentSize=', room ? room.size : 0);
                        if (!room || room.size === 0) {
                            // Fallback: scan all sockets for matching handshake userId
                            for (const [sid, sock] of req.io.sockets.sockets) {
                                if (sock.handshake?.auth?.userId === roomId || sock.handshake?.query?.userId === roomId) {
                                    log('[CTRL createIssue] MERGE: Fallback direct emit via socketId', sid);
                                    sock.emit('issueConsentRequest', {
                                        issueId: nearbyCanonical._id,
                                        canonical: true,
                                        message: 'Do you want to join the discussion group for this existing issue?',
                                        thumbnail: nearbyCanonical.thumbnailImage || (nearbyCanonical.images?.[0] || null)
                                    });
                                    room = req.io?.sockets?.adapter?.rooms?.get(roomId);
                                    break;
                                }
                            }
                        }
                        req.io?.to(roomId).emit('issueConsentRequest', {
                            issueId: nearbyCanonical._id,
                            canonical: true,
                            message: 'Do you want to join the discussion group for this existing issue?',
                            thumbnail: nearbyCanonical.thumbnailImage || (nearbyCanonical.images?.[0] || null)
                        });
                        log('[CTRL createIssue] MERGE: Emitted issueConsentRequest to userId', reporterId);
                    } catch (e) {
                        warn('[CTRL createIssue] MERGE: consent request emit failed', e.message);
                    }

                    // Emit socket event for merged issue and canonical update
                    req.io?.emit('issueMerged', {
                        canonicalId: nearbyCanonical._id,
                        duplicateId: issue._id,
                        reporters: nearbyCanonical.reporters
                    });

                    // Respond referencing canonical
                    return res.status(201).json({
                        success: true,
                        message: 'Issue reported and merged with existing similar issue',
                        data: {
                            canonicalIssueId: nearbyCanonical._id,
                            duplicateIssueId: issue._id
                        }
                    });
                } else {
                    log('[CTRL createIssue] MERGE: No nearby canonical issue found (issue remains canonical)');
                }
            } catch (mergeErr) {
                warn('[CTRL createIssue] MERGE: merge logic error', mergeErr.message);
            }

            // Emit real-time notification
            req.io?.emit('newIssue', {
                issue: issue,
                message: `New issue reported: ${title}`
            });

            // Assign thumbnail for brand new canonical if not yet set
            if (!issue.mergedInto && images.length && !issue.thumbnailImage) {
                issue.thumbnailImage = images[0];
            }

            // Compute automatic priority & reasons (post-save so _id exists for cluster query)
            try {
                const { priority: autoPriority, reasons } = await computePriority(issue);
                issue.priority = autoPriority;
                issue.priorityReasons = reasons;
                await issue.save();
                log('[CTRL createIssue] Auto priority computed:', autoPriority, 'reasons:', reasons);
            } catch (e) {
                console.error('[CTRL createIssue] Auto priority computation failed:', e.message);
            }

            const responsePayload = {
                success: true,
                message: 'Issue reported successfully',
                data: issue
            };
            log('[CTRL createIssue] SUCCESS response payload keys:', Object.keys(responsePayload.data.toObject ? responsePayload.data.toObject() : responsePayload.data));
            res.status(201).json(responsePayload);
        } catch (error) {
            error('[CTRL createIssue] UNCAUGHT ERROR:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to report issue',
                message: error.message
            });
        }
    }

    // Get single issue by ID
    async getIssueById(req, res) {
        try {
            let issue = await Issue.findById(req.params.id)
                .populate('reportedBy', 'name email phone role')
                .populate('assignedTo.official', 'name email department')
                .populate('resolutionDetails.resolvedBy', 'name email')
                .populate('statusHistory.updatedBy', 'name email role');

            if (!issue) {
                return res.status(404).json({
                    success: false,
                    error: 'Issue not found'
                });
            }

            let canonical = issue;
            if (issue.mergedInto) {
                log('[getIssueById] Requested duplicate issue', issue._id.toString(), 'redirecting to canonical', issue.mergedInto.toString());
                canonical = await Issue.findById(issue.mergedInto)
                    .populate('reportedBy', 'name email phone role')
                    .populate('assignedTo.official', 'name email department')
                    .populate('resolutionDetails.resolvedBy', 'name email')
                    .populate('statusHistory.updatedBy', 'name email role')
                    .populate('duplicates', 'title reportedBy createdAt')
                    .populate('reporters.user', 'name email role');
            } else {
                canonical = await Issue.findById(issue._id)
                    .populate('duplicates', 'title reportedBy createdAt')
                    .populate('reporters.user', 'name email role');
            }

            // Mark notifications as read if viewed by the issue reporter
            if (req.user && req.user.id === canonical.reportedBy._id.toString()) {
                canonical.notifications.forEach(notification => {
                    notification.read = true;
                });
                await canonical.save();
            }

            res.json({
                success: true,
                data: {
                    issue: canonical,
                    isDuplicate: !!issue.mergedInto,
                    originalRequestedId: issue._id,
                    reportersCount: (canonical.reporters || []).length,
                    consentingReportersCount: (canonical.reporters || []).filter(r => r.consent === true).length,
                    duplicatesCount: (canonical.duplicates || []).length,
                    thumbnailImage: canonical.thumbnailImage || (canonical.images?.[0] || null)
                }
            });
        } catch (error) {
            error('Error fetching issue:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch issue',
                message: error.message
            });
        }
    }

    // Assign issue to department/official
    async assignIssue(req, res) {
        try {
            const { id } = req.params;
            const { department, officialId, comment } = req.body;

            if (req.user.role !== 'government') {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. Government officials only.'
                });
            }

            const issue = await Issue.findById(id);
            if (!issue) {
                return res.status(404).json({
                    success: false,
                    error: 'Issue not found'
                });
            }

            // Update assignment
            issue.assignedTo = {
                department,
                official: officialId || null
            };
            issue.status = 'assigned';

            // Add to status history
            issue.statusHistory.push({
                status: 'assigned',
                updatedBy: req.user.id,
                comment: comment || `Issue assigned to ${department} department${officialId ? ' and specific official' : ''}`,
                timestamp: new Date()
            });

            // Add notification
            issue.notifications.push({
                message: `Your issue has been assigned to the ${department} department`,
                type: 'assignment',
                timestamp: new Date()
            });

            await issue.save();
            await issue.populate([
                { path: 'reportedBy', select: 'name email phone' },
                { path: 'assignedTo.official', select: 'name email department' }
            ]);

            // Emit real-time notification
            req.io?.emit('issueAssigned', {
                issueId: issue._id,
                userId: issue.reportedBy._id,
                message: `Issue assigned to ${department} department`
            });

            res.json({
                success: true,
                message: 'Issue assigned successfully',
                data: issue
            });
        } catch (error) {
            console.error('Error assigning issue:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to assign issue',
                message: error.message
            });
        }
    }

    // Update issue status
    async updateIssueStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, comment, resolutionDetails } = req.body;

            if (req.user.role !== 'government') {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. Government officials only.'
                });
            }

            let issue = await Issue.findById(id);
            if (!issue) {
                return res.status(404).json({ success: false, error: 'Issue not found' });
            }

            // If updating a duplicate directly, redirect to canonical
            if (issue.mergedInto) {
                log('[updateIssueStatus] Redirecting duplicate', issue._id.toString(), 'to canonical', issue.mergedInto.toString());
                issue = await Issue.findById(issue.mergedInto);
                if (!issue) return res.status(404).json({ success: false, error: 'Canonical issue not found' });
            }

            const oldStatus = issue.status;
            issue.status = status;

            // Add to status history
            issue.statusHistory.push({
                status,
                updatedBy: req.user.id,
                comment: comment || `Status changed from ${oldStatus} to ${status}`,
                timestamp: new Date()
            });
            // Handle resolution
            if (status === 'resolved') {
                const createdAt = new Date(issue.createdAt);
                const resolvedAt = new Date();
                const resolutionTimeHours = Math.round((resolvedAt - createdAt) / (1000 * 60 * 60));

                issue.resolutionDetails = {
                    resolvedBy: req.user.id,
                    resolutionDate: resolvedAt,
                    resolutionDescription: resolutionDetails?.description || 'Issue has been resolved',
                    resolutionImages: resolutionDetails?.images || []
                };
                issue.actualResolutionTime = resolutionTimeHours;

                // Add resolution notification
                issue.notifications.push({
                    message: 'Your issue has been resolved! Thank you for reporting.',
                    type: 'resolution',
                    timestamp: new Date()
                });

                // Save the issue first to ensure all data is persisted
                await issue.save();

                // Send email notifications to all active reporters
                try {
                    log('[updateIssueStatus] Sending resolution emails for issue:', issue._id.toString());
                    const emailResult = await mailController.sendIssueResolutionEmail(issue._id.toString(), req.user.id);
                    log('[updateIssueStatus] Email notification result:', emailResult);
                } catch (emailError) {
                    // Log the error but don't fail the status update
                    error('[updateIssueStatus] Failed to send resolution emails:', emailError);
                }
            } else {
                // Add status change notification
                issue.notifications.push({
                    message: `Your issue status has been updated to: ${status}`,
                    type: 'status_change',
                    timestamp: new Date()
                });
                
                // Save the issue for non-resolution status changes
                await issue.save();
            }

            // Propagate status to duplicates (read-only display consistency) except if status is pending and duplicates may remain individualized
            if (Array.isArray(issue.duplicates) && issue.duplicates.length) {
                log('[updateIssueStatus] Propagating status', status, 'to duplicates count=', issue.duplicates.length);
                await Issue.updateMany(
                    { _id: { $in: issue.duplicates } },
                    {
                        $set: { status },
                        $push: {
                            statusHistory: {
                                status,
                                updatedBy: req.user.id,
                                comment: '[canonical-sync] ' + (comment || `Status synced from canonical ${issue._id.toString()}`),
                                timestamp: new Date()
                            }
                        }
                    }
                );
            }
            await issue.populate([
                { path: 'reportedBy', select: 'name email phone' },
                { path: 'assignedTo.official', select: 'name email department' },
                { path: 'resolutionDetails.resolvedBy', select: 'name email' }
            ]);

            // Emit real-time notification
            req.io?.emit('issueStatusUpdated', {
                issueId: issue._id,
                userId: issue.reportedBy._id,
                status,
                message: `Issue status updated to: ${status}`
            });

            res.json({
                success: true,
                message: 'Issue status updated successfully',
                data: issue
            });
        } catch (error) {
            console.error('Error updating issue status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update issue status',
                message: error.message
            });
        }
    }

    // Get user's issues
    async getUserIssues(req, res) {
        try {
            const { page = 1, limit = 10, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

            const filter = { reportedBy: req.user.id };
            if (status) filter.status = status;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
                populate: [
                    { path: 'assignedTo.official', select: 'name email department' },
                    { path: 'resolutionDetails.resolvedBy', select: 'name email' }
                ]
            };

            const issues = await Issue.paginate(filter, options);
            log('[getUserIssues] fetched count=', issues.docs.length, 'user=', req.user.id);
            // Resolve duplicates to canonical snapshot for display consistency
            const mapped = [];
            for (const doc of issues.docs) {
                if (doc.mergedInto) {
                    log('[getUserIssues] duplicate found issue=', doc._id.toString(), 'canonical=', doc.mergedInto.toString());
                    const canonical = await Issue.findById(doc.mergedInto).select('title status priority category createdAt thumbnailImage reporters votes').lean();
                    if (canonical) {
                        mapped.push({ ...canonical, originalDuplicateId: doc._id, isDuplicate: true });
                        continue;
                    }
                }
                mapped.push({ ...doc.toObject(), isDuplicate: false });
            }

            res.json({
                success: true,
                data: { ...issues, docs: mapped }
            });
        } catch (error) {
            console.error('Error fetching user issues:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch your issues',
                message: error.message
            });
        }
    }

    // Vote on issue
    async voteOnIssue(req, res) {
        try {
            const issue = await Issue.findById(req.params.id);
            if (!issue) {
                return res.status(404).json({
                    success: false,
                    error: 'Issue not found'
                });
            }

            const userId = req.user.id;
            const hasVoted = issue.voters.includes(userId);

            if (hasVoted) {
                issue.voters = issue.voters.filter(id => id.toString() !== userId);
                issue.votes = Math.max(0, issue.votes - 1);
                log('[voteOnIssue] vote removed user=', userId, 'issue=', issue._id.toString(), 'votes now=', issue.votes);
            } else {
                issue.voters.push(userId);
                issue.votes += 1;
                log('[voteOnIssue] vote added user=', userId, 'issue=', issue._id.toString(), 'votes now=', issue.votes);
            }

            const oldPriority = issue.priority;
            let newPriority = oldPriority;
            let reasons = issue.priorityReasons || [];
            if (issue.priorityAuto) {
                try {
                    log('[voteOnIssue] recompute start issue=', issue._id.toString(), 'oldPriority=', oldPriority, 'votes=', issue.votes);
                    const result = await computePriority(issue);
                    newPriority = result.priority;
                    reasons = result.reasons;
                    issue.priority = newPriority;
                    issue.priorityReasons = reasons;
                    log('[voteOnIssue] recompute done issue=', issue._id.toString(), 'newPriority=', newPriority, 'reasons=', reasons);
                } catch (e) {
                    console.error('[voteOnIssue] computePriority failed:', e.message);
                }
            }
                log('[voteOnIssue] priorityAuto=false skip recompute issue=', issue._id.toString());

            await issue.save();

            if (oldPriority !== newPriority) {
                req.io?.emit('issuePriorityUpdated', {
                    issueId: issue._id,
                    oldPriority,
                    newPriority,
                    reasons
                });
                log('[voteOnIssue] emitted issuePriorityUpdated issue=', issue._id.toString(), 'old=', oldPriority, 'new=', newPriority, 'reasons=', reasons);
            }

            res.json({
                success: true,
                message: hasVoted ? 'Vote removed' : 'Vote added',
                data: {
                    votes: issue.votes,
                    hasVoted: !hasVoted,
                    priority: issue.priority,
                    priorityReasons: issue.priorityReasons || []
                }
            });
        } catch (error) {
            error('Error voting on issue:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to vote on issue',
                message: error.message
            });
        }
    }

    // Get issue statistics
    async getIssueStatistics(req, res) {
        try {
            const { timeRange = '30d', department, category } = req.query;

            // Calculate date range
            const now = new Date();
            let startDate;
            switch (timeRange) {
                case '7d':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case '90d':
                    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
                case '1y':
                    startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            }

            const matchFilter = {
                createdAt: { $gte: startDate }
            };

            if (department) matchFilter['assignedTo.department'] = department;
            if (category) matchFilter.category = category;

            const [
                totalStats,
                statusStats,
                categoryStats,
                priorityStats,
                departmentStats,
                resolutionTimeStats
            ] = await Promise.all([
                // Total counts
                Issue.aggregate([
                    { $match: matchFilter },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            totalVotes: { $sum: '$votes' },
                            avgVotes: { $avg: '$votes' }
                        }
                    }
                ]),
                // Status breakdown
                Issue.aggregate([
                    { $match: matchFilter },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ]),
                // Category breakdown
                Issue.aggregate([
                    { $match: matchFilter },
                    {
                        $group: {
                            _id: '$category',
                            count: { $sum: 1 },
                            avgVotes: { $avg: '$votes' }
                        }
                    },
                    { $sort: { count: -1 } }
                ]),
                // Priority breakdown
                Issue.aggregate([
                    { $match: matchFilter },
                    {
                        $group: {
                            _id: '$priority',
                            count: { $sum: 1 }
                        }
                    }
                ]),
                // Department breakdown
                Issue.aggregate([
                    { $match: matchFilter },
                    {
                        $group: {
                            _id: '$assignedTo.department',
                            count: { $sum: 1 },
                            resolved: {
                                $sum: {
                                    $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0]
                                }
                            }
                        }
                    },
                    {
                        $addFields: {
                            resolutionRate: {
                                $round: [
                                    { $multiply: [{ $divide: ['$resolved', '$count'] }, 100] },
                                    2
                                ]
                            }
                        }
                    }
                ]),
                // Resolution time stats
                Issue.aggregate([
                    {
                        $match: {
                            ...matchFilter,
                            status: 'resolved',
                            actualResolutionTime: { $exists: true }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            avgResolutionTime: { $avg: '$actualResolutionTime' },
                            minResolutionTime: { $min: '$actualResolutionTime' },
                            maxResolutionTime: { $max: '$actualResolutionTime' }
                        }
                    }
                ])
            ]);

            res.json({
                success: true,
                data: {
                    total: totalStats[0] || { total: 0, totalVotes: 0, avgVotes: 0 },
                    byStatus: statusStats,
                    byCategory: categoryStats,
                    byPriority: priorityStats,
                    byDepartment: departmentStats,
                    resolutionTime: resolutionTimeStats[0] || { avgResolutionTime: 0, minResolutionTime: 0, maxResolutionTime: 0 }
                }
            });
        } catch (error) {
            error('Error fetching issue statistics:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch statistics',
                message: error.message
            });
        }
    }

}

// Standalone helper (removed from class to avoid `this` binding issues when passing methods to Express)
function calculateEstimatedResolutionTime(category, priority) {
    const baseHours = {
        'Roads & Infrastructure': 72,
        'Waste Management': 24,
        'Electricity': 48,
        'Water Supply': 48,
        'Sewage & Drainage': 48,
        'Traffic & Transportation': 24,
        'Public Safety': 12,
        'Parks & Recreation': 72,
        'Street Lighting': 24,
        'Noise Pollution': 48,
        'Other': 48
    };

    const priorityMultiplier = {
        'urgent': 0.25,
        'high': 0.5,
        'medium': 1,
        'low': 1.5
    };

    const base = baseHours[category] || 48;
    const multiplier = priorityMultiplier[priority] || 1;

    return Math.round(base * multiplier);
}

module.exports = new IssueController();