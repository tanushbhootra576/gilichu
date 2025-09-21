import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getUnresolvedIssuesForMap } from '../../services/issues';

// Fix default marker icons for Leaflet when using bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Configure the default marker icon paths
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const defaultCenter = { lat: 12.9716, lng: 77.5946 }; // Bengaluru as a sensible default

const statusColor = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'in-progress':
      return '#f59e0b';
    case 'acknowledged':
      return '#3b82f6';
    case 'assigned':
      return '#06b6d4';
    case 'pending':
      return '#ef4444';
    default:
      return '#64748b';
  }
};

const GovIssuesMap = ({ height = 420 }) => {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError('');
      const resp = await getUnresolvedIssuesForMap();
      if (!mounted) return;
      if (resp.success) {
        setPoints(resp.data || []);
      } else {
        setError(resp.error || 'Failed to load map data');
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const center = useMemo(() => {
    if (points.length > 0) {
      const lat = points[0]?.coordinates?.lat;
      const lng = points[0]?.coordinates?.lng;
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    return defaultCenter;
  }, [points]);

  return (
    <div className="gov-map-wrapper" style={{ height, borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      {error && (
        <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#991b1b', fontSize: 14 }}>{error}</div>
      )}
      <MapContainer center={center} zoom={12} scrollWheelZoom style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="bottomright" />

        {loading ? null : points.map((p) => {
          const lat = p.coordinates?.lat;
          const lng = p.coordinates?.lng;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const color = statusColor(p.status);
          return (
            <CircleMarker key={p.id} center={[lat, lng]} radius={8} pathOptions={{ color, fillColor: color, fillOpacity: 0.7 }}>
              <Popup>
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 6 }}>{p.address}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {p.thumbnailImage && (
                      <img src={p.thumbnailImage} alt="thumb" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                    )}
                    <div style={{ fontSize: 12 }}>
                      <div>
                        <strong>Status:</strong> {p.status}
                      </div>
                      <div>
                        <strong>Category:</strong> {p.category}
                      </div>
                      <div>
                        <strong>Priority:</strong> {p.priority}
                      </div>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default GovIssuesMap;
