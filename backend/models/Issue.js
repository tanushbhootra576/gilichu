const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const { log } = require('../utils/logger');

const issueSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        enum: [
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
        ]
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        },
        address: {
            type: String,
            required: true
        },
        city: String,
        state: String,
        pincode: String
    },
    images: [{
        type: String,
        required: true
    }],
    voiceNote: {
        type: String
    },
    reportedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedTo: {
        department: String,
        official: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    status: {
        type: String,
        enum: ['pending', 'acknowledged', 'assigned', 'in-progress', 'resolved', 'rejected', 'closed'],
        default: 'pending'
    },
    votes: {
        type: Number,
        default: 1
    },
    voters: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'low'
    },
    // Tracks why an automatic priority was assigned (e.g., votes, clustering)
    priorityReasons: [{
        type: String
    }],
    // If true, system may automatically recompute priority. If an admin manually
    // overrides priority you can set this to false to lock it.
    priorityAuto: {
        type: Boolean,
        default: true
    },
    statusHistory: [{
        status: {
            type: String,
            enum: ['pending', 'acknowledged', 'assigned', 'in-progress', 'resolved', 'rejected', 'closed']
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        comment: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    notifications: [{
        message: String,
        type: {
            type: String,
            enum: ['status_change', 'assignment', 'comment', 'resolution']
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        read: {
            type: Boolean,
            default: false
        }
    }],
    estimatedResolutionTime: {
        type: Number, // in hours
        default: 72
    },
    actualResolutionTime: Number, // in hours
    resolutionDetails: {
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        resolutionDate: Date,
        resolutionImages: [String],
        resolutionDescription: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Duplicate clustering + reporter consent support
// mergedInto: if set, this issue is a duplicate and should not appear independently in government listings
// reporters: now richer objects capturing consent for chat/community participation
issueSchema.add({
    mergedInto: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', index: true },
    duplicates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Issue' }],
    // Backwards compatibility note: legacy data stored reporters as ObjectId[]; migration will convert.
    reporters: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        consent: { type: Boolean, default: true }, // creator auto-consents; merged reporters start as null until response
        joinedAt: { type: Date, default: Date.now },
        isActive: { type: Boolean, default: false }
    }],
    thumbnailImage: { type: String } // first reporter's first image becomes thumbnail
});

// Ensure reporters includes original reporter on save (only for new docs)
issueSchema.pre('save', function(next) {
    if (this.isNew) {
        log('[IssueModel][pre-save] New issue initialization _id=', this._id?.toString());
        // Upgrade legacy reporters array if provided externally
        if (Array.isArray(this.reporters) && this.reporters.length && typeof this.reporters[0] === 'string') {
            log('[IssueModel][pre-save] Migrating legacy reporters array length=', this.reporters.length);
            this.reporters = this.reporters.map(id => ({ user: id, consent: true, joinedAt: new Date() }));
        }
        if (!Array.isArray(this.reporters)) this.reporters = [];
        if (this.reportedBy && !this.reporters.some(r => r.user?.toString() === this.reportedBy.toString())) {
            log('[IssueModel][pre-save] Adding creator to reporters user=', this.reportedBy.toString());
            this.reporters.push({ 
                user: this.reportedBy, 
                consent: true, 
                joinedAt: new Date(),
                isActive: true // Set original reporter as active by default
            });
        }
    }
    next();
});

// Geospatial indexes (primary 2dsphere on full location subdocument + coordinates fallback)
issueSchema.index({ location: '2dsphere' });
issueSchema.index({ 'location.coordinates': '2dsphere' });

// Add pagination plugin
issueSchema.plugin(mongoosePaginate);

const Issue = mongoose.model('Issue', issueSchema);

module.exports = Issue;
