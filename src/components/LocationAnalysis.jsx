import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React Leaflet
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

export default function LocationAnalysis() {
  // Demo coordinates (Riyadh - Al Narjis)
  const position = [24.8136, 46.6753];

  return (
    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h3 style={{ margin: '0 0 1rem', color: '#1e293b' }}>التحليل الجغرافي للموقع 🗺️</h3>
      <div style={{ height: '350px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <MapContainer center={position} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position}>
            <Popup>موقع المشروع المقترح</Popup>
          </Marker>
          <Circle center={position} pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.1 }} radius={2000} />
        </MapContainer>
      </div>
      <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '1rem', textAlign: 'center' }}>توضح الدائرة الحمراء النطاق الجغرافي للمنافسين (قطر 2كم)</p>
    </div>
  );
}
