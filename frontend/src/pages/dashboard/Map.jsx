import React from 'react';
import { DashboardLayout } from '../../components/layout';
import GovIssuesMap from '../../components/map/GovIssuesMap';

const MapPage = () => {
  return (
    <DashboardLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Issue Map</h1>
          <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 14 }}>Live view of unresolved issues across the city.</p>
        </div>
      </div>
      <GovIssuesMap height={520} />
    </DashboardLayout>
  );
};

export default MapPage;
