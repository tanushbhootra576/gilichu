import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { IconDashboard, IconPredict, IconNotes, IconBell, IconPlus, IconHourglass, IconCheckCircle, IconChart, IconAlert, IconUser, IconSettings, IconLocation } from '../common/Icons';

// Custom SVG icon for Predict Issues
// const IconPredict = () => (
//     <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
//         <circle cx="10" cy="10" r="9" stroke="#2563eb" strokeWidth="2" fill="#eff6ff" />
//         <path d="M10 5V10L13 13" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
//         <circle cx="10" cy="10" r="1.5" fill="#2563eb" />
//     </svg>
// );
//import '../../styles/sidebar.css';
const Sidebar = ({ isOpen }) => {
    const { isGovernment, isCitizen } = useAuth();

    const sidebarClass = isOpen ? "sidebar open" : "sidebar";

    // Hide sidebar on mobile using CSS
    return (
        <aside className={sidebarClass + ' sidebar-hide-mobile'}>
            {/* <div className="sidebar-header">
                <h3>Dashboard</h3>
            </div> */}

            <nav className="sidebar-nav">
                <ul>
                    <li>
                        <NavLink
                            to="/dashboard"
                            end
                            className={({ isActive }) => isActive ? 'active' : ''}
                        >
                            <span className="icon"><IconDashboard /></span>
                            <span>Overview</span>
                        </NavLink>
                    </li>

                    {isCitizen && (
                        <>
                            <li>
                                <NavLink
                                    to="/dashboard/my-issues"
                                    className={({ isActive }) => isActive ? 'active' : ''}
                                >
                                    <span className="icon"><IconNotes /></span>
                                    <span>My Issues</span>
                                </NavLink>
                            </li>
                            <li>
                                <NavLink
                                    to="/dashboard/notifications"
                                    className={({ isActive }) => isActive ? 'active' : ''}
                                >
                                    <span className="icon"><IconBell /></span>
                                    <span>Notifications</span>
                                </NavLink>
                            </li>
                            <li>
                                <NavLink
                                    to="/report-issue"
                                    className={({ isActive }) => isActive ? 'active' : ''}
                                >
                                    <span className="icon"><IconPlus /></span>
                                    <span>Report New Issue</span>
                                </NavLink>
                            </li>
                        </>
                    )}

                    {isGovernment && (
                        <>
                          
                            <li>
                                <NavLink
                                    to="/dashboard/pending-issues"
                                    className={({ isActive }) => isActive ? 'active' : ''}
                                >
                                    <span className="icon"><IconHourglass /></span>
                                    <span>Pending Issues</span>
                                </NavLink>
                            </li>
                            <li>
                                <NavLink
                                    to="/dashboard/resolved-issues"
                                    className={({ isActive }) => isActive ? 'active' : ''}
                                >
                                    <span className="icon"><IconCheckCircle /></span>
                                    <span>Resolved Issues</span>
                                </NavLink>
                            </li>
                            <li>
                                <NavLink
                                    to="/dashboard/analytics"
                                    className={({ isActive }) => isActive ? 'active' : ''}
                                >
                                    <span className="icon"><IconChart /></span>
                                    <span>Analytics</span>
                                </NavLink>
                            </li>
                            <li>
                                <NavLink
                                    to="/dashboard/alerts"
                                    className={({ isActive }) => isActive ? 'active' : ''}
                                >
                                    <span className="icon"><IconAlert /></span>
                                    <span>Manage Alerts</span>
                                </NavLink>
                            </li>
                            <li>
                                <NavLink
                                    to="/dashboard/predict"
                                    className={({ isActive }) => isActive ? 'active' : ''}
                                >
                                    <span className="icon"><IconPredict /></span>
                                    <span>Predict Issues</span>
                                </NavLink>
                            </li>
                            <li>
                                <NavLink
                                    to="/dashboard/map"
                                    className={({ isActive }) => isActive ? 'active' : ''}
                                >
                                    <span className="icon"><IconLocation /></span>
                                    <span>Map</span>
                                </NavLink>
                            </li>
                        </>
                    )}

                    <li className="divider"></li>

                    <li>
                        <NavLink
                            to="/profile"
                            className={({ isActive }) => isActive ? 'active' : ''}
                        >
                            <span className="icon"><IconUser /></span>
                            <span>Profile</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                            to="/settings"
                            className={({ isActive }) => isActive ? 'active' : ''}
                        >
                            <span className="icon"><IconSettings /></span>
                            <span>Settings</span>
                        </NavLink>
                    </li>
                </ul>
            </nav>
        </aside>
    );
};

export default Sidebar;
