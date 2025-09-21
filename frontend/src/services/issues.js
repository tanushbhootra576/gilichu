import axios from 'axios';
import mockData from '../utils/mockData';

// Configure axios base URL
const API_URL = import.meta.env.VITE_API_URL || '/api';
axios.defaults.baseURL = API_URL;
axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || false; // Default to real API now

// Local storage caching for issues removed per requirements (only credentials retained elsewhere)

// Helper to handle API errors
const handleApiError = (error) => {
    console.error('API Error:', error);
    let errorMessage = 'An error occurred. Please try again.';

    if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorMessage = error.response.data.message || errorMessage;
    } else if (error.request) {
        // The request was made but no response was received
        errorMessage = 'No response from server. Please check your internet connection.';
    }

    return { success: false, error: errorMessage };
};

// Get all issues (government dashboard / general listing)
export const getAllIssues = async (queryParams = {}) => {
    if (USE_MOCK) {
        // Combine mock categories for a fuller dataset
        const combined = [
            ...mockData.pendingIssues,
            ...mockData.inProgressIssues,
            ...mockData.resolvedIssues
        ];
        return { success: true, data: combined };
    }

    try {
    const response = await axios.get('/issues', { params: queryParams });
        const responseData = response.data;
        if (responseData.success && responseData.data) {
            const payload = responseData.data.docs || responseData.data;
            const normalized = Array.isArray(payload)
                ? payload.map(doc => ({
                    id: doc._id || doc.id,
                    title: doc.title,
                    description: doc.description,
                    category: doc.category,
                    priority: doc.priority || 'low',
                    reporter: doc.reportedBy ? { name: doc.reportedBy.name, id: doc.reportedBy._id } : null,
                    location: doc.location ? { address: doc.location.address } : null,
                    date: doc.createdAt,
                    status: doc.status,
                    votes: doc.votes || 0
                }))
                : [];
            return {
                success: true,
                data: normalized,
                pagination: {
                    totalCount: responseData.totalCount,
                    currentPage: responseData.currentPage,
                    totalPages: responseData.totalPages
                }
            };
        }
        return { success: true, data: [] };
    } catch (error) {
        return handleApiError(error);
    }
};

// Government overview (counts + recent issues)
export const getGovernmentOverview = async () => {
    try {
    const response = await axios.get('/issues/government/overview');
        const responseData = response.data;
        if (responseData.success && responseData.data) {
            const counts = responseData.data.counts || {};
            const recent = responseData.data.recent || [];
            return {
                success: true,
                data: {
                    counts,
                    recent
                }
            };
        }
        return { success: false, error: 'Invalid overview payload' };
    } catch (error) {
        return handleApiError(error);
    }
};

// Government: fetch ALL issues (unpaginated)
export const getAllIssuesFull = async () => {
    try {
        console.log('[issues.service] getAllIssuesFull: START request -> GET /issues/all');
        const response = await axios.get('/issues/all');
        console.log('[issues.service] getAllIssuesFull: response status', response.status);
        const responseData = response.data;
        if (responseData.success && Array.isArray(responseData.data)) {
            console.log('[issues.service] getAllIssuesFull: success data length', responseData.data.length);
            return { success: true, data: responseData.data };
        }
        console.log('[issues.service] getAllIssuesFull: unexpected payload shape', responseData);
        return { success: true, data: [] };
    } catch (error) {
        console.warn('[issues.service] getAllIssuesFull: ERROR', error?.response?.status, error?.message);
        return handleApiError(error);
    }
};

// Get all pending issues
export const getPendingIssues = async () => {
    if (USE_MOCK) {
        return {
            success: true,
            data: mockData.pendingIssues
        };
    }

    try {
        console.log('[issues.service] getPendingIssues: START request -> GET /issues?status=pending');
        const response = await axios.get('/issues', {
            params: { status: 'pending' }
        });
        console.log('[issues.service] getPendingIssues: response status', response.status);
        const responseData = response.data;
        if (responseData.success && responseData.data) {
            const payload = responseData.data.docs || responseData.data;
            const normalized = Array.isArray(payload)
                ? payload.map(doc => ({
                    id: doc._id || doc.id,
                    title: doc.title,
                    description: doc.description,
                    category: doc.category,
                    priority: doc.priority || 'low',
                    reporter: doc.reportedBy ? { name: doc.reportedBy.name, id: doc.reportedBy._id } : null,
                    location: doc.location ? { address: doc.location.address } : null,
                    date: doc.createdAt,
                    votes: doc.votes || 0
                }))
                : [];
            return {
                success: true,
                data: normalized,
                pagination: {
                    totalCount: responseData.totalCount,
                    currentPage: responseData.currentPage,
                    totalPages: responseData.totalPages
                }
            };
        }
        return { success: true, data: [] };
    } catch (error) {
        console.warn('[issues.service] getPendingIssues: ERROR', error?.response?.status, error?.message);
        return handleApiError(error);
    }
};

// Get all in-progress issues
export const getInProgressIssues = async () => {
    if (USE_MOCK) {
        return {
            success: true,
            data: mockData.inProgressIssues
        };
    }

    try {
    const response = await axios.get('/issues', { params: { status: 'in-progress' } });
        // Handle paginated response structure
        const responseData = response.data;
        if (responseData.success && responseData.data) {
            return {
                success: true,
                data: responseData.data.docs || responseData.data,
                pagination: {
                    totalCount: responseData.totalCount,
                    currentPage: responseData.currentPage,
                    totalPages: responseData.totalPages
                }
            };
        }
        return { success: true, data: [] };
    } catch (error) {
        return handleApiError(error);
    }
};

// Get all resolved issues
export const getResolvedIssues = async () => {
    if (USE_MOCK) {
        return {
            success: true,
            data: mockData.resolvedIssues
        };
    }

    try {
    console.log('[issues.service] getResolvedIssues: START request -> GET /issues?status=resolved');
    const response = await axios.get('/issues', { params: { status: 'resolved' } });
    console.log('[issues.service] getResolvedIssues: response status', response.status);
        // Handle paginated response structure
        const responseData = response.data;
        if (responseData.success && responseData.data) {
            return {
                success: true,
                data: responseData.data.docs || responseData.data,
                pagination: {
                    totalCount: responseData.totalCount,
                    currentPage: responseData.currentPage,
                    totalPages: responseData.totalPages
                }
            };
        }
        return { success: true, data: [] };
    } catch (error) {
        console.warn('[issues.service] getResolvedIssues: ERROR', error?.response?.status, error?.message);
        return handleApiError(error);
    }
};

// Get issue by ID
export const getIssueById = async (issueId) => {
    if (USE_MOCK) {
        const allIssues = [
            ...mockData.pendingIssues,
            ...mockData.inProgressIssues,
            ...mockData.resolvedIssues
        ];
        const issue = allIssues.find(issue => issue.id === issueId);
        return {
            success: !!issue,
            data: issue || null,
            error: !issue ? 'Issue not found' : null
        };
    }

    try {
    const response = await axios.get(`/issues/${issueId}`);
        return { success: true, data: response.data };
    } catch (error) {
        return handleApiError(error);
    }
};

// Assign issue to department/official
export const assignIssue = async (issueId, assignmentData) => {
    if (USE_MOCK) {
        const allIssues = [
            ...mockData.pendingIssues,
            ...mockData.inProgressIssues,
            ...mockData.resolvedIssues
        ];

        const issueIndex = allIssues.findIndex(issue => issue.id === issueId);
        if (issueIndex === -1) {
            return { success: false, error: 'Issue not found' };
        }

        // In a real implementation, this would update the state properly
        return {
            success: true,
            message: 'Issue assigned successfully',
            data: {
                ...allIssues[issueIndex],
                assignedTo: {
                    department: assignmentData.department,
                    official: assignmentData.officialId ? {
                        id: assignmentData.officialId,
                        name: mockData.officials.find(o => o.id === assignmentData.officialId)?.name || 'Unknown'
                    } : null
                },
                status: 'in-progress',
                statusHistory: [
                    ...(allIssues[issueIndex].statusHistory || []),
                    {
                        status: 'in-progress',
                        date: new Date().toISOString().split('T')[0],
                        comment: `Assigned to ${assignmentData.department} department${assignmentData.officialId ? ' and official' : ''}.`
                    }
                ]
            }
        };
    }

    try {
    const response = await axios.put(`/issues/${issueId}/assign`, assignmentData);
        return { success: true, data: response.data };
    } catch (error) {
        return handleApiError(error);
    }
};

// Update issue status
export const updateIssueStatus = async (issueId, statusData) => {
    if (USE_MOCK) {
        const allIssues = [
            ...mockData.pendingIssues,
            ...mockData.inProgressIssues,
            ...mockData.resolvedIssues
        ];

        const issueIndex = allIssues.findIndex(issue => issue.id === issueId);
        if (issueIndex === -1) {
            return { success: false, error: 'Issue not found' };
        }

        // In a real implementation, this would update the state properly
        return {
            success: true,
            message: 'Issue status updated successfully',
            data: {
                ...allIssues[issueIndex],
                status: statusData.status,
                statusHistory: [
                    ...(allIssues[issueIndex].statusHistory || []),
                    {
                        status: statusData.status,
                        date: new Date().toISOString().split('T')[0],
                        comment: statusData.comment || `Status updated to ${statusData.status}`
                    }
                ],
                ...(statusData.status === 'resolved' ? {
                    resolvedDate: new Date().toISOString().split('T')[0],
                    resolutionDetails: {
                        description: statusData.resolutionDetails?.description || '',
                        images: statusData.resolutionDetails?.images || []
                    }
                } : {})
            }
        };
    }

    try {
    const response = await axios.put(`/issues/${issueId}/status`, statusData);
        return { success: true, data: response.data };
    } catch (error) {
        return handleApiError(error);
    }
};

// Add resolution proof
export const addResolutionProof = async (issueId, proofData) => {
    if (USE_MOCK) {
        return {
            success: true,
            message: 'Resolution proof added successfully'
        };
    }

    try {
        // For file uploads, we need to use FormData
        const formData = new FormData();

        if (proofData.description) {
            formData.append('description', proofData.description);
        }

        if (proofData.images && proofData.images.length) {
            proofData.images.forEach((image) => {
                formData.append('images', image);
            });
        }

        const response = await axios.post(
            `/issues/${issueId}/resolution`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            }
        );

        return { success: true, data: response.data };
    } catch (error) {
        return handleApiError(error);
    }
};

// Delete issue (for admin purposes)
export const deleteIssue = async (issueId) => {
    if (USE_MOCK) {
        return {
            success: true,
            message: 'Issue deleted successfully'
        };
    }

    try {
    await axios.delete(`/issues/${issueId}`);
        return { success: true, message: 'Issue deleted successfully' };
    } catch (error) {
        return handleApiError(error);
    }
};

// Get issue tracking status (for live tracking)
export const getIssueTrackingStatus = async (issueId) => {
    if (USE_MOCK) {
        const allIssues = [
            ...mockData.pendingIssues,
            ...mockData.inProgressIssues,
            ...mockData.resolvedIssues
        ];

        const issue = allIssues.find(issue => issue.id === issueId);
        if (!issue) {
            return { success: false, error: 'Issue not found' };
        }

        // Simulated tracking data
        return {
            success: true,
            data: {
                issue: issue,
                trackingSteps: [
                    {
                        name: 'Submitted',
                        status: 'completed',
                        date: issue.date,
                        details: 'Issue reported successfully'
                    },
                    {
                        name: 'Verification',
                        status: issue.status !== 'submitted' ? 'completed' : 'pending',
                        date: issue.status !== 'submitted' ? new Date(new Date(issue.date).getTime() + 86400000).toISOString().split('T')[0] : null,
                        details: issue.status !== 'submitted' ? 'Issue verified by department' : 'Awaiting verification'
                    },
                    {
                        name: 'Assigned',
                        status: issue.assignedTo ? 'completed' : 'pending',
                        date: issue.assignedTo ? new Date(new Date(issue.date).getTime() + 172800000).toISOString().split('T')[0] : null,
                        details: issue.assignedTo ? `Assigned to ${issue.assignedTo.department}` : 'Not yet assigned'
                    },
                    {
                        name: 'In Progress',
                        status: issue.status === 'in-progress' ? 'active' : (issue.status === 'resolved' ? 'completed' : 'pending'),
                        date: issue.status === 'in-progress' || issue.status === 'resolved' ? new Date(new Date(issue.date).getTime() + 259200000).toISOString().split('T')[0] : null,
                        details: issue.status === 'in-progress' ? 'Work in progress' : (issue.status === 'resolved' ? 'Work completed' : 'Not started')
                    },
                    {
                        name: 'Resolved',
                        status: issue.status === 'resolved' ? 'completed' : 'pending',
                        date: issue.resolvedDate || null,
                        details: issue.status === 'resolved' ? 'Issue has been resolved' : 'Resolution pending'
                    }
                ],
                estimatedResolutionDate: new Date(new Date(issue.date).getTime() + 604800000).toISOString().split('T')[0]
            }
        };
    }

    try {
    const response = await axios.get(`/issues/${issueId}/tracking`);
        return { success: true, data: response.data };
    } catch (error) {
        return handleApiError(error);
    }
};

// Get issue statistics by department (for analytics)
export const getIssueStatsByDepartment = async () => {
    if (USE_MOCK) {
        return {
            success: true,
            data: mockData.analytics
        };
    }

    try {
        const response = await axios.get(`${API_URL}/analytics/issues/by-department`);
        return { success: true, data: response.data };
    } catch (error) {
        return handleApiError(error);
    }
};

// Get user's reported issues
export const getUserIssues = async () => {
    if (USE_MOCK) {
        // Simulate a mix of different status issues for the user
        return {
            success: true,
            data: [
                ...mockData.pendingIssues.slice(0, 2),
                ...mockData.inProgressIssues.slice(0, 1),
                ...mockData.resolvedIssues.slice(0, 2)
            ]
        };
    }

    try {
    const response = await axios.get('/issues/user/me');
        // Handle paginated response structure
        const responseData = response.data;
        if (responseData.success && responseData.data) {
            return {
                success: true,
                data: responseData.data.docs || responseData.data,
                pagination: {
                    totalCount: responseData.totalCount,
                    currentPage: responseData.currentPage,
                    totalPages: responseData.totalPages
                }
            };
        }
        return { success: true, data: [] };
    } catch (error) {
        return handleApiError(error);
    }
};

// Get issues for a specific citizen
export const getMyIssues = async () => {
    if (USE_MOCK) {
        // Simulate delayed response
        await new Promise(resolve => setTimeout(resolve, 800));

        // Generate some mock issues with updates for the citizen
        const mockIssues = [
            {
                id: 101,
                title: 'Pothole on Main Street',
                description: 'Large pothole causing traffic problems',
                category: 'Roads & Infrastructure',
                location: 'Main Street & 5th Avenue',
                status: 'In Progress',
                date: '2023-05-15',
                updates: [
                    {
                        type: 'status_change',
                        message: 'Issue reported',
                        date: '2023-05-15T10:30:00Z',
                    },
                    {
                        type: 'comment',
                        message: 'Issue has been verified',
                        details: 'Our team has verified this issue and assigned it to the Roads Department',
                        date: '2023-05-16T14:20:00Z',
                    },
                    {
                        type: 'status_change',
                        message: 'Status changed to In Progress',
                        details: 'Work scheduled for next week',
                        date: '2023-05-17T09:15:00Z',
                    }
                ]
            },
            {
                id: 102,
                title: 'Streetlight not working',
                description: 'Streetlight at the corner of Park Road has been out for a week',
                category: 'Electricity',
                location: 'Park Road & Elm Street',
                status: 'Pending',
                date: '2023-05-18',
                updates: [
                    {
                        type: 'status_change',
                        message: 'Issue reported',
                        date: '2023-05-18T16:45:00Z',
                    }
                ]
            },
            {
                id: 103,
                title: 'Garbage not collected',
                description: 'Garbage has not been collected for two weeks',
                category: 'Waste Management',
                location: 'Cedar Lane',
                status: 'Resolved',
                date: '2023-05-10',
                updates: [
                    {
                        type: 'status_change',
                        message: 'Issue reported',
                        date: '2023-05-10T08:30:00Z',
                    },
                    {
                        type: 'comment',
                        message: 'Issue has been verified',
                        details: 'Our team has verified this issue and assigned it to the Sanitation Department',
                        date: '2023-05-10T11:20:00Z',
                    },
                    {
                        type: 'status_change',
                        message: 'Status changed to In Progress',
                        details: 'Special collection scheduled',
                        date: '2023-05-11T14:15:00Z',
                    },
                    {
                        type: 'status_change',
                        message: 'Status changed to Resolved',
                        details: 'Garbage has been collected and area cleaned',
                        date: '2023-05-12T10:00:00Z',
                    }
                ]
            },
            {
                id: 104,
                title: 'Water leakage',
                description: 'Water pipe leaking on the sidewalk',
                category: 'Water Supply',
                location: 'Maple Street',
                status: 'In Progress',
                date: '2023-05-14',
                updates: [
                    {
                        type: 'status_change',
                        message: 'Issue reported',
                        date: '2023-05-14T13:30:00Z',
                    },
                    {
                        type: 'comment',
                        message: 'Issue has been verified',
                        details: 'Our team has verified this issue and assigned it to the Water Department',
                        date: '2023-05-15T09:20:00Z',
                    },
                    {
                        type: 'status_change',
                        message: 'Status changed to In Progress',
                        details: 'Emergency repair team dispatched',
                        date: '2023-05-15T11:15:00Z',
                    }
                ]
            }
        ];

        return {
            success: true,
            data: mockIssues
        };
    }

    try {
    const response = await axios.get('/issues/user/me');
        const responseData = response.data;
        if (responseData.success && responseData.data) {
            const payload = responseData.data.docs || responseData.data;
            const mapStatus = (raw) => {
                if (!raw) return 'pending';
                // Normalize hyphenated backend statuses to UI friendly forms
                const lowered = raw.toLowerCase();
                if (lowered === 'in-progress') return 'In Progress';
                if (lowered === 'in progress') return 'In Progress';
                if (lowered === 'pending') return 'Pending';
                if (lowered === 'resolved') return 'Resolved';
                if (lowered === 'rejected') return 'Rejected';
                if (lowered === 'assigned') return 'In Progress'; // treat assigned as in progress for citizen view
                if (lowered === 'acknowledged') return 'In Progress';
                if (lowered === 'closed') return 'Resolved';
                return raw.charAt(0).toUpperCase() + raw.slice(1);
            };
            const normalized = Array.isArray(payload)
                ? payload.map(doc => ({
                    id: doc._id || doc.id,
                    title: doc.title,
                    description: doc.description,
                    category: doc.category,
                    status: mapStatus(doc.status),
                    location: doc.location ? doc.location.address : '',
                    date: doc.createdAt,
                    updates: Array.isArray(doc.statusHistory) ? doc.statusHistory.map(h => ({
                        type: 'status_change',
                        message: h.comment || `Status changed to ${mapStatus(h.status)}`,
                        date: h.timestamp
                    })) : [],
                    votes: doc.votes || 0
                }))
                : [];
            return { success: true, data: normalized };
        }
        return { success: true, data: [] };
    } catch (error) {
        return handleApiError(error);
    }
};

// Get detailed tracking information for a specific issue
export const getIssueTracking = async (issueId) => {
    if (USE_MOCK) {
        // Simulate delayed response
        await new Promise(resolve => setTimeout(resolve, 600));

        // Find the issue in our mock data
        const allMockIssues = [
            ...mockData.pendingIssues,
            ...mockData.inProgressIssues,
            ...mockData.resolvedIssues
        ];

        const issue = allMockIssues.find(issue => issue.id === issueId);

        if (!issue) {
            return {
                success: false,
                error: 'Issue not found'
            };
        }

        // If the issue doesn't have updates, generate some based on status
        if (!issue.updates) {
            issue.updates = [
                {
                    type: 'status_change',
                    message: 'Issue reported',
                    date: issue.date,
                }
            ];

            if (issue.status === 'In Progress') {
                issue.updates.push({
                    type: 'status_change',
                    message: 'Status changed to In Progress',
                    details: 'Issue assigned to department',
                    date: new Date(new Date(issue.date).getTime() + 86400000).toISOString(), // One day later
                });
            } else if (issue.status === 'Resolved') {
                issue.updates.push({
                    type: 'status_change',
                    message: 'Status changed to In Progress',
                    details: 'Issue assigned to department',
                    date: new Date(new Date(issue.date).getTime() + 86400000).toISOString(), // One day later
                });

                issue.updates.push({
                    type: 'status_change',
                    message: 'Status changed to Resolved',
                    details: 'Issue has been fixed',
                    date: new Date(new Date(issue.date).getTime() + 172800000).toISOString(), // Two days later
                });
            }
        }

        return {
            success: true,
            data: issue
        };
    }

    try {
    const response = await axios.get(`/issues/${issueId}/tracking`);
        return { success: true, data: response.data };
    } catch (error) {
        return handleApiError(error);
    }
};

// Get unresolved issues for the map
export const getUnresolvedIssuesForMap = async () => {
    try {
        const response = await axios.get('/issues/map/unresolved');
        const payload = response.data;
        if (payload.success && Array.isArray(payload.data)) {
            return { success: true, data: payload.data };
        }
        return { success: true, data: [] };
    } catch (error) {
        return handleApiError(error);
    }
};

export default {
    getPendingIssues,
    getInProgressIssues,
    getResolvedIssues,
    getIssueById,
    assignIssue,
    updateIssueStatus,
    addResolutionProof,
    deleteIssue,
    getIssueTrackingStatus,
    getIssueStatsByDepartment,
    getUserIssues,
    getMyIssues,
    getIssueTracking,
    getAllIssues,
    getGovernmentOverview,
    getAllIssuesFull,
    getUnresolvedIssuesForMap
};
