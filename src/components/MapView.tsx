import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { CivicReport, isVideoMedia } from "../types";

interface MapViewProps {
  reports: CivicReport[];
  userLat?: number;
  userLng?: number;
}

export default function MapView({ reports, userLat, userLng }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Determine initial center
    // If we have reports, center on the first one, else center on user coords, else default
    let initialCenter: L.LatLngExpression = [37.7749, -122.4194]; // Default to San Francisco area of starter reports
    if (reports.length > 0 && reports[0].lat && reports[0].lng) {
      initialCenter = [reports[0].lat, reports[0].lng];
    } else if (userLat && userLng) {
      initialCenter = [userLat, userLng];
    }

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 13,
      zoomControl: true,
    });

    // Add OpenStreetMap tiles with nice clean muted colors
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    // Create a group layer for markers
    const markersLayer = L.layerGroup().addTo(map);

    mapRef.current = map;
    markersLayerRef.current = markersLayer;

    // Cleanup map on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Markers when reports change
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    // Clear old markers
    markersLayer.clearLayers();

    // Custom Icon Creator
    const createCustomMarker = (severity: string) => {
      let colorClass = "bg-emerald-500 border-white text-emerald-500 shadow-md";
      let ringClass = "ring-emerald-400";
      if (severity === "Critical") {
        colorClass = "bg-red-600 border-white text-red-600 shadow-md";
        ringClass = "ring-red-400 animate-ping opacity-75";
      } else if (severity === "High") {
        colorClass = "bg-orange-500 border-white text-orange-500 shadow-md";
        ringClass = "ring-orange-400 animate-pulse";
      } else if (severity === "Medium") {
        colorClass = "bg-amber-500 border-white text-amber-500 shadow-md";
        ringClass = "ring-amber-400";
      }

      return L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div class="relative flex items-center justify-center w-8 h-8">
            <span class="absolute inline-flex h-6 w-6 rounded-full ${ringClass} opacity-50"></span>
            <span class="relative inline-flex rounded-full h-4 w-4 ${colorClass} border-2"></span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -12],
      });
    };

    // Add reports to map
    reports.forEach((report) => {
      if (report.lat === undefined || report.lng === undefined) return;

      const marker = L.marker([report.lat, report.lng], {
        icon: createCustomMarker(report.severity),
      });

      // Severity styling in popup
      let severityColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
      if (report.severity === "Critical") severityColor = "bg-red-50 text-red-700 border-red-100";
      else if (report.severity === "High") severityColor = "bg-orange-50 text-orange-700 border-orange-100";
      else if (report.severity === "Medium") severityColor = "bg-amber-50 text-amber-700 border-amber-100";

      let escalationBadge = "";
      let escalationTextInPopup = "";
      if (report.escalated && report.escalationNote) {
        escalationBadge = `<span class="bg-rose-50 text-rose-700 border-rose-200 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border">⚠️ Escalated</span>`;
        escalationTextInPopup = `<div class="bg-rose-50 text-rose-800 p-1.5 rounded text-[10px] mt-1 border border-rose-100 italic" style="max-height: 50px; overflow-y: auto;"><strong>Escalation:</strong> "${report.escalationNote}"</div>`;
      }

      // Popup Content Card style
      const popupContent = `
        <div class="p-1 max-w-[240px] font-sans">
          <div class="flex items-center justify-between gap-1.5 mb-1.5 border-b border-slate-100 pb-1.5">
            <span class="font-display font-extrabold text-slate-800 text-sm tracking-tight leading-tight">${report.category}</span>
            <div class="flex flex-wrap gap-1 justify-end items-center">
              <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${severityColor}">${report.severity}</span>
              ${escalationBadge}
            </div>
          </div>
          <div class="max-h-[80px] overflow-hidden rounded mb-2 bg-slate-900 flex justify-center items-center">
            ${isVideoMedia(report.photo) ? `
              <video src="${report.photo}" class="w-full h-full object-cover rounded" controls muted playsinline style="max-height: 80px;"></video>
            ` : `
              <img src="${report.photo}" alt="${report.category}" class="w-full h-full object-cover rounded" />
            `}
          </div>
          <p class="text-[11px] text-slate-600 line-clamp-2 leading-relaxed mb-1.5 bg-slate-50 p-1.5 rounded">"${report.description}"</p>
          ${escalationTextInPopup}
          <div class="flex items-center justify-between text-[10px] text-slate-400 font-medium mt-1.5">
            <span>Dept: ${report.department}</span>
            <span class="font-bold text-indigo-650 opacity-90">${report.status}</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        closeButton: true,
        className: "custom-leaflet-popup",
      });

      markersLayer.addLayer(marker);
    });

    // Optionally center map on the newest report if coordinates exist
    if (reports.length > 0) {
      const latest = reports[0];
      if (latest.lat !== undefined && latest.lng !== undefined) {
        map.panTo([latest.lat, latest.lng]);
      }
    }
  }, [reports]);

  return (
    <div className="relative w-full rounded-2xl border border-slate-150 overflow-hidden shadow-sm" id="leaflet_map_view_wrapper">
      <div ref={mapContainerRef} className="w-full h-[450px] z-10" />
      
      {/* Mini Legend overlay */}
      <div className="absolute bottom-5 left-5 z-20 bg-white/95 backdrop-blur px-3.5 py-2.5 rounded-xl border border-slate-150 shadow-md text-xs space-y-1.5 text-left font-sans">
        <span className="font-bold text-slate-700 block text-[10px] uppercase tracking-wider mb-1">Issue Severity</span>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 bg-red-600 rounded-full inline-block animate-pulse"></span>
          <span className="text-slate-600">Critical</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 bg-orange-500 rounded-full inline-block"></span>
          <span className="text-slate-600">High</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 bg-amber-500 rounded-full inline-block"></span>
          <span className="text-slate-600">Medium</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 bg-emerald-500 rounded-full inline-block"></span>
          <span className="text-slate-600">Low</span>
        </div>
      </div>
    </div>
  );
}
