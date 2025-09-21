import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout';
import { useAuth } from '../../hooks/useAuth';
import { IconLocation, IconUser, IconCalendar, IconMessage } from '../../components/common/Icons';
import { IconChart, IconHourglass, IconCheckCircle } from '../../components/common/Icons';
import api from '../../services/api';
import { getMyIssues, getPendingIssues, getAllIssues, getGovernmentOverview, getAllIssuesFull } from '../../services/issues';
import { listNotifications } from '../../services/notifications';
import '../../styles/dashboard-home.css';
import GovIssuesMap from '../../components/map/GovIssuesMap';

const Dashboard = () => {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [stats, setStats] = useState({
        totalIssues: 0,
        pendingIssues: 0,
        resolvedIssues: 0,
        inProgressIssues: 0
    });
    const [recentIssues, setRecentIssues] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const manualFetchAll = async () => {
        try {
            console.log('[Dashboard manualFetchAll] Invoked. user role:', user?.role);
            const resp = await getAllIssuesFull();
            console.log('[Dashboard manualFetchAll] Response:', resp);
            if (resp.success) {
                const issues = resp.data || [];
                console.log('[Dashboard manualFetchAll] Issues length:', issues.length);
                const counts = issues.reduce((acc, it) => {
                    acc.total += 1;
                    const st = (it.status || '').toLowerCase();
                    if (st === 'resolved') acc.resolved += 1; else if (st.includes('progress')) acc.inProgress += 1; else acc.pending += 1;
                    return acc;
                }, { total: 0, pending: 0, resolved: 0, inProgress: 0 });
                setStats({
                    totalIssues: counts.total,
                    pendingIssues: counts.pending,
                    resolvedIssues: counts.resolved,
                    inProgressIssues: counts.inProgress
                });
            }
        } catch (e) {
            console.warn('[Dashboard manualFetchAll] Error:', e);
        }
    };

    const formatDate = (d) => {
        try {
            const date = new Date(d);
            return isNaN(date.getTime()) ? d : date.toLocaleDateString();
        } catch {
            return d;
        }
    };

    const computeCitizenStats = (issues) => {
        const counts = issues.reduce((acc, it) => {
            const st = (it.status || '').toLowerCase();
            acc.total += 1;
            if (st.includes('progress')) acc.inProgress += 1;
            else if (st.includes('resolved')) acc.resolved += 1;
            else acc.pending += 1;
            return acc;
        }, { total: 0, pending: 0, resolved: 0, inProgress: 0 });
        return {
            totalIssues: counts.total,
            pendingIssues: counts.pending,
            resolvedIssues: counts.resolved,
            inProgressIssues: counts.inProgress
        };
    };

    // Normalize various shapes of `updates` into a numeric count
    const getUpdateCount = (updates) => {
        if (Array.isArray(updates)) return updates.length;
        if (typeof updates === 'number') return updates;
        return updates ? 1 : 0; // treat single object or truthy value as one update
    };

    useEffect(() => {
        let mounted = true;
        // Don't run until auth finished loading (user null vs undefined distinction not needed here, rely on presence or absence of user + isAuthenticated) 
        // If user is still null but auth provider loading finished, we still attempt citizen path (will show empty state) 
        const load = async () => {
            console.log('[Dashboard] effect start. user:', user);
            setIsLoading(true);
            setError('');
            try {
                const role = (user?.role || '').toLowerCase();
                if (role === 'governement') {
                    console.warn('[Dashboard] Detected misspelled role "governement". Treating as government.');
                }
                if (role === 'government' || role === 'governement') {
                    console.log('[Dashboard] Government user detected. Fetching all issues...');
                    const [fullResp, notifResp] = await Promise.all([
                        getAllIssuesFull(),
                        listNotifications({ limit: 5 })
                    ]);

                    if (!mounted) return;
                    console.log('[Dashboard] getAllIssuesFull response:', fullResp);

                    const issues = fullResp.success ? (fullResp.data || []) : [];
                    console.log('[Dashboard] issues length:', issues.length);
                    const counts = issues.reduce((acc, it) => {
                        acc.total += 1;
                        const st = (it.status || '').toLowerCase();
                        if (st === 'resolved') acc.resolved += 1; else if (st.includes('progress')) acc.inProgress += 1; else acc.pending += 1;
                        return acc;
                    }, { total: 0, pending: 0, resolved: 0, inProgress: 0 });

                    console.log('[Dashboard] computed counts:', counts);
                    setStats({
                        totalIssues: counts.total,
                        pendingIssues: counts.pending,
                        resolvedIssues: counts.resolved,
                        inProgressIssues: counts.inProgress
                    });

                    const sortedAll = [...issues].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
                    setRecentIssues(sortedAll.slice(0, 5));

                    const notifs = notifResp.notifications || [];
                    setNotifications(notifs.slice(0, 5).map(n => ({
                        id: n._id,
                        message: n.title ? `${n.title}: ${n.message}` : n.message,
                        date: formatDate(n.createdAt),
                        read: n.isRead
                    })));
                } else if (user) { // citizen path
                    console.log('[Dashboard] Citizen user detected. Fetching my issues...');
                    const [myResp, notifResp] = await Promise.all([
                        getMyIssues(),
                        listNotifications({ limit: 5 })
                    ]);

                    if (!mounted) return;
                    console.log('[Dashboard] getMyIssues response:', myResp);
                    const myIssues = myResp.success ? (myResp.data || []) : [];
                    setStats(computeCitizenStats(myIssues));
                    const sorted = [...myIssues].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
                    setRecentIssues(sorted.slice(0, 5));

                    const notifs = notifResp.notifications || [];
                    setNotifications(notifs.slice(0, 5).map(n => ({
                        id: n._id,
                        message: n.title ? `${n.title}: ${n.message}` : n.message,
                        date: formatDate(n.createdAt),
                        read: n.isRead
                    })));
                } else {
                    console.log('[Dashboard] No authenticated user yet. Skipping data fetch.');
                }
            } catch (e) {
                console.error('Dashboard load error:', e);
                setError('Failed to load dashboard. Please refresh.');
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        load();
        return () => { mounted = false; };
    }, [user]);

    // Note: status/priority classes will be derived directly where needed for clarity

    return (
        <DashboardLayout>
            <div className="dashboard-header">
                <h1>Welcome, {user?.name || 'User'}</h1>
                <p>Here's an overview of your civic engagement activities</p>
                {user?.role === 'government' && (
                    <button onClick={manualFetchAll} className="btn btn-outline btn-sm" style={{ marginLeft: '1rem' }}>
                        Debug Fetch All Issues
                    </button>
                )}
            </div>

            {isLoading ? (
                <>
                    <section className="stats-grid">
                        {[1, 2, 3, 4].map((k) => (
                            <div key={k} className="stat-card skeleton">
                                <div className="stat-icon skeleton-circle" />
                                <div className="skeleton-line w-60" />
                                <div className="skeleton-line w-40" />
                            </div>
                        ))}
                    </section>
                    <div className="dashboard-grid">
                        {user?.role === 'government' && (
                            <section className="map-section" style={{ gridColumn: '1 / -1' }}>
                                <div className="section-header">
                                    <h2>City Issues Map (Unresolved)</h2>
                                </div>
                                <GovIssuesMap height={420} />
                            </section>
                        )}
                        <section className="recent-issues-section">
                            <div className="section-header"><h2>Recent Issues</h2></div>
                            <div className="issue-list">
                                {[1, 2, 3].map((k) => (
                                    <div key={k} className="issue-card skeleton">
                                        <div className="skeleton-line w-80" />
                                        <div className="skeleton-line w-50" />
                                        <div className="skeleton-line w-30" />
                                    </div>
                                ))}
                            </div>
                        </section>
                        <section className="notifications-section">
                            <div className="section-header"><h2>Notifications</h2></div>
                            <div className="notification-list">
                                {[1, 2, 3].map((k) => (
                                    <div key={k} className="notification-item skeleton">
                                        <div className="skeleton-line w-70" />
                                        <div className="skeleton-line w-40" />
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </>
            ) : (
                <>
                    {error && (
                        <div className="alert alert-danger" role="alert">{error}</div>
                    )}
                    <section className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon total-icon"><IconChart /></div>
                            <div className="stat-content">
                                <h3>Total Issues</h3>
                                <div className="stat-number">{stats.totalIssues}</div>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon pending-icon"><IconHourglass /></div>
                            <div className="stat-content">
                                <h3>Pending</h3>
                                <div className="stat-number">{stats.pendingIssues}</div>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon progress-icon"><IconChart /></div>
                            <div className="stat-content">
                                <h3>In Progress</h3>
                                <div className="stat-number">{stats.inProgressIssues}</div>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon resolved-icon"><IconCheckCircle /></div>
                            <div className="stat-content">
                                <h3>Resolved</h3>
                                <div className="stat-number">{stats.resolvedIssues}</div>
                            </div>
                        </div>
                    </section>

                    <div className="dashboard-grid">
                        <section className="recent-issues-section">
                            <div className="section-header">
                                <h2>Recent Issues</h2>
                                <Link
                                    to={user?.role === 'government' ? '/dashboard/pending-issues' : '/dashboard/my-issues'}
                                    className="btn btn-outline btn-sm"
                                >
                                    View All
                                </Link>
                            </div>

                            {recentIssues.length === 0 ? (
                                <div className="empty-state">
                                    <p>No issues found. Start by reporting a new issue!</p>
                                    {user?.role === 'citizen' && (
                                        <Link to="/report-issue" className="btn btn-primary">
                                            Report Issue
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                <div className="issue-list">
                                    {recentIssues.map((issue) => (
                                        <div key={issue.id || issue._id} className="issue-card">
                                            <div className="issue-meta">
                                                <div className="meta-item">
                                                    <span className="icon"><IconLocation /></span>
                                                    <span>{issue.location?.address || issue.location || '—'}</span>
                                                </div>
                                                <div className="meta-item">
                                                    <span className="icon"><IconCalendar /></span>
                                                    <span>{formatDate(issue.date || issue.createdAt)}</span>
                                                </div>
                                                {issue.reporter && (
                                                    <div className="meta-item">
                                                        <span className="icon"><IconUser /></span>
                                                        <span>{issue.reporter?.name || issue.reporter}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="issue-details">
                                                <div className="issue-location">
                                                    <span className="icon"><IconLocation /></span>
                                                    <span>{issue.location?.address || issue.location || '—'}</span>
                                                </div>

                                                <div className="issue-date">
                                                    <span className="icon"><IconCalendar /></span>
                                                    <span>{formatDate(issue.date || issue.createdAt)}</span>
                                                </div>

                                                {issue.reporter && (
                                                    <div className="issue-reporter">
                                                        <span className="icon"><IconUser /></span>
                                                        <span>{issue.reporter?.name || issue.reporter}</span>
                                                    </div>
                                                )}

                                                {issue.updates !== undefined && (
                                                    <div className="issue-updates">
                                                        <span className="icon"><IconMessage /></span>
                                                        <span>{getUpdateCount(issue.updates)} updates</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* <div className="issue-actions">
                                                <Link to="/frontend/src/components/issues" className="btn btn-sm">
                                                    View Details
                                                </Link>

                                                {user?.role === 'government' && (
                                                    <button className="btn btn-primary btn-sm">
                                                        Take Action
                                                    </button>
                                                )}
                                            </div> */}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="notifications-section">
                            <div className="section-header">
                                <h2>Notifications</h2>
                                <Link to="/dashboard/notifications" className="btn btn-outline btn-sm">
                                    View All
                                </Link>
                            </div>

                            {notifications.length === 0 ? (
                                <div className="empty-state">
                                    <p>No notifications yet.</p>
                                </div>
                            ) : (
                                <div className="notification-list">
                                    {notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            className={`notification-item ${!notification.read ? 'unread' : ''}`}
                                        >
                                            <div className="notification-content">
                                                <p>{notification.message}</p>
                                                <span className="notification-date">{notification.date}</span>
                                            </div>
                                            {!notification.read && (
                                                <div className="notification-badge">New</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    <section className="quick-actions">
                        <h2>Quick Actions</h2>
                        <div className="action-buttons">
                            {user?.role === 'citizen' && (
                                <>
                                    <Link to="/report-issue" className="btn btn-primary">
                                        Report New Issue
                                    </Link>
                                    <Link to="/dashboard/my-issues" className="btn btn-outline">
                                        View My Issues
                                    </Link>
                                </>
                            )}

                            {user?.role === 'government' && (
                                <>
                                    <Link to="/dashboard/all-issues" className="btn btn-primary">
                                        View All Issues
                                    </Link>
                                    <Link to="/dashboard/pending-issues" className="btn btn-outline">
                                        View Pending Issues
                                    </Link>
                                    <Link to="/dashboard/analytics" className="btn btn-outline">
                                        View Analytics
                                    </Link>
                                    <Link to="/dashboard/alerts/create" className="btn btn-outline">
                                        Create Alert
                                    </Link>
                                    <Link to="/dashboard/date" className="btn btn-outline">
                                        Create Alert
                                    </Link>
                                </>
                            )}

                            <Link to="/profile" className="btn btn-outline">
                                Update Profile
                            </Link>
                        </div>
                    </section>
                </>
            )}
        </DashboardLayout>
    );
};

export default Dashboard;
