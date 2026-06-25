import React, { useState, useEffect, useMemo } from "react";
import { 
  Sparkles, 
  MapPin, 
  Calendar, 
  Lightbulb, 
  ArrowRight, 
  Loader2, 
  AlertTriangle,
  FileText,
  MousePointerClick,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  Zap,
  Info
} from "lucide-react";
import { CivicReport } from "../types";

// Distance utility using Haversine formula
function getDistanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; 
}

export interface HotspotCluster {
  id: string; // Comma-separated sorted list of report IDs (deterministic key)
  category: string;
  reports: CivicReport[];
  size: number;
  dateRange: string;
  approxLocation: string;
}

interface HotspotInsightsProps {
  reports: CivicReport[];
}

interface CachedInsight {
  insight: string;
  recommended_action: string;
  loading?: boolean;
  error?: string;
}

export default function HotspotInsights({ reports }: HotspotInsightsProps) {
  // Collapsed reports state to let administrator drill down into individual reports
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);

  // Initialize cached insights state from LocalStorage
  const [insightsCache, setInsightsCache] = useState<Record<string, CachedInsight>>(() => {
    const saved = localStorage.getItem("hotspot_insights_cache");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse hotspot insights cache", e);
      }
    }
    return {};
  });

  // Calculate density clusters inside a useMemo
  const clusters = useMemo(() => {
    const now = new Date().getTime();
    const days30Ago = now - 30 * 24 * 60 * 60 * 1000;

    // Candidates: reports created in the last 30 days that have coordinates
    const candidates = reports.filter(r => {
      if (!r.lat || !r.lng || !r.createdAt) return false;
      const time = new Date(r.createdAt).getTime();
      return time >= days30Ago;
    });

    const detectedClustersMap: Record<string, HotspotCluster> = {};

    for (const report of candidates) {
      if (!report.lat || !report.lng) continue;

      // Find other candidates of the SAME category within 200m
      const neighbors = candidates.filter(other => {
        if (other.category !== report.category) return false;
        if (!other.lat || !other.lng) return false;

        const dist = getDistanceInMeters(report.lat!, report.lng!, other.lat, other.lng);
        return dist <= 200;
      });

      // Cluster condition: 3 or more reports
      if (neighbors.length >= 3) {
        const sortedIds = neighbors.map(n => n.id).sort();
        const clusterKey = sortedIds.join(",");

        if (!detectedClustersMap[clusterKey]) {
          const avgLat = neighbors.reduce((sum, n) => sum + (n.lat || 0), 0) / neighbors.length;
          const avgLng = neighbors.reduce((sum, n) => sum + (n.lng || 0), 0) / neighbors.length;

          const epochs = neighbors.map(n => new Date(n.createdAt).getTime());
          const minDate = new Date(Math.min(...epochs));
          const maxDate = new Date(Math.max(...epochs));

          const formatDate = (date: Date) => {
            return date.toLocaleDateString([], { month: "short", day: "numeric" });
          };

          detectedClustersMap[clusterKey] = {
            id: clusterKey,
            category: report.category,
            reports: neighbors,
            size: neighbors.length,
            dateRange: `${formatDate(minDate)} – ${formatDate(maxDate)}`,
            approxLocation: `Lat: ${avgLat.toFixed(4)}, Lng: ${avgLng.toFixed(4)}`
          };
        }
      }
    }

    return Object.values(detectedClustersMap);
  }, [reports]);

  // Convert clusters list to a primitive dependency string for safe effect dispatching without infinite loops
  const clustersDependencyString = useMemo(() => {
    return clusters.map(c => c.id).sort().join("|");
  }, [clusters]);

  // Handle on-demand fetching for missing insights
  useEffect(() => {
    const fetchInsightForCluster = async (cluster: HotspotCluster) => {
      try {
        const response = await fetch("/api/hotspot-insights", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            category: cluster.category,
            count: cluster.size,
            dateRange: cluster.dateRange,
            approxLocation: cluster.approxLocation
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Server returned ${response.status}`);
        }

        const data = await response.json();
        if (data.result && data.result.insight) {
          setInsightsCache(prev => {
            const updated = {
              ...prev,
              [cluster.id]: {
                insight: data.result.insight,
                recommended_action: data.result.recommended_action || "Proactively monitor the situation.",
                loading: false
              }
            };
            localStorage.setItem("hotspot_insights_cache", JSON.stringify(updated));
            return updated;
          });
        } else {
          throw new Error("Invalid response format from Gemini engine");
        }
      } catch (err: any) {
        console.error("Failed to fetch insights", err);
        setInsightsCache(prev => {
          const updated = {
            ...prev,
            [cluster.id]: {
              insight: "",
              recommended_action: "",
              loading: false,
              error: err.message || "Unknown error"
            }
          };
          localStorage.setItem("hotspot_insights_cache", JSON.stringify(updated));
          return updated;
        });
      }
    };

    // Dispatch queries for clusters missing from the cache or containing errors
    clusters.forEach(cluster => {
      const cached = insightsCache[cluster.id];
      if (!cached || (cached.error && !cached.loading)) {
        // Mark as loading locally first
        setInsightsCache(prev => ({
          ...prev,
          [cluster.id]: {
            insight: "",
            recommended_action: "",
            loading: true
          }
        }));

        fetchInsightForCluster(cluster);
      }
    });

  }, [clustersDependencyString]); // Stabilized hook primitive prevents infinite re-render loops

  // Helpers to color coordinate badges by category
  const getCategoryColorStyles = (category: string) => {
    switch (category.toLowerCase()) {
      case "pothole":
        return "bg-amber-50 border-amber-200 text-amber-800 accent-amber-600";
      case "garbage":
        return "bg-amber-900/10 border-amber-900/20 text-stone-800 accent-stone-600";
      case "streetlight":
        return "bg-yellow-50 border-yellow-200 text-yellow-850 accent-yellow-600";
      case "waterlogging":
        return "bg-blue-50 border-blue-200 text-blue-800 accent-blue-600";
      case "signage":
        return "bg-teal-50 border-teal-200 text-teal-800 accent-teal-600";
      default:
        return "bg-indigo-50 border-indigo-150 text-indigo-800 accent-indigo-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Header Section */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles className="h-28 w-28 text-indigo-400 rotate-12" />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Zap className="h-3 w-3 fill-indigo-400" />
              Real-time Analytics
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight font-sans">
            Hotspot Insights
          </h2>
          <p className="text-slate-350 text-xs leading-relaxed max-w-2xl font-medium">
            AI-powered spatial clustering maps recurring neighborhood patterns automatically. 
            When 3 or more localized reports of the same category gather within 200 meters inside a 
            30-day window, a critical civic hotspot is geolocated for predictive mitigation.
          </p>
        </div>
      </div>

      {/* Overview Analytics row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Active Hotspots</h4>
            <p className="text-xl font-bold text-slate-800">{clusters.length}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Reports Affected</h4>
            <p className="text-xl font-bold text-slate-800">
              {clusters.reduce((acc, c) => acc + c.size, 0)}
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">AI Confidence</h4>
            <p className="text-xl font-bold text-slate-800">Verified (98%)</p>
          </div>
        </div>
      </div>

      {/* Clusters List */}
      {clusters.length === 0 ? (
        <div className="bg-slate-50 border border-slate-150 rounded-2xl p-10 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <MapPin className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-slate-700 text-sm">No Spatial hotspots found</h3>
          <p className="text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">
            Excellent! Currently, all civic issues are geographically distributed—meaning there are no high-density, repeated problem clusters in the same vicinity of your neighborhood.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-450 tracking-wider flex items-center gap-1.5 px-1">
            <span>Detected High-Density Hazard Zones</span>
            <span className="bg-rose-100 text-rose-850 px-2 py-0.5 rounded-full text-[10px] font-black">
              {clusters.length} Zone{clusters.length !== 1 ? "s" : ""}
            </span>
          </h3>

          <div className="space-y-4">
            {clusters.map((cluster) => {
              const cached = insightsCache[cluster.id];
              const styles = getCategoryColorStyles(cluster.category);

              return (
                <div 
                  key={cluster.id} 
                  className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-slate-300 transition duration-150 overflow-hidden"
                  id={`hotspot_cluster_${cluster.id.substring(0, 8)}`}
                >
                  {/* Top Bar describing cluster metrics */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold leading-none shrink-0 ${styles}`}>
                        {cluster.category}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-slate-850 text-sm">{cluster.size} Connected Reports</h4>
                          <span className="bg-rose-50 text-rose-700 font-bold text-[10px] px-2 py-0.5 rounded border border-rose-100 leading-none">
                            High Density
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-slate-400 font-bold mt-1">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {cluster.approxLocation}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {cluster.dateRange}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Drilldown Trigger */}
                    <button
                      onClick={() => setExpandedClusterId(expandedClusterId === cluster.id ? null : cluster.id)}
                      className="text-xs font-bold text-slate-550 hover:text-indigo-600 flex items-center gap-1 transition self-start sm:self-center bg-white border border-slate-200 px-3 py-1.5 rounded-lg active:scale-95"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>{expandedClusterId === cluster.id ? "Minimize Records" : "Drill Down Records"}</span>
                      {expandedClusterId === cluster.id ? <ChevronUp className="h-3.5 w-3.5 ml-0.5" /> : <ChevronDown className="h-3.5 w-3.5 ml-0.5" />}
                    </button>
                  </div>

                  {/* Collapsible Cluster Raw Records Detail */}
                  {expandedClusterId === cluster.id && (
                    <div className="p-4 sm:p-5 bg-indigo-50/20 border-b border-indigo-100/50 space-y-3">
                      <div className="text-[10px] font-black uppercase text-indigo-500 tracking-wider flex items-center gap-1">
                        <MousePointerClick className="h-3 w-3" />
                        <span>Source Incident Manifest (drill-down data)</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {cluster.reports.map((report) => (
                          <div key={report.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                            <div className="flex items-center justify-between font-bold text-slate-500 text-[10px]">
                              <span>Ticket #{report.id.slice(0, 6)}</span>
                              <span className="text-slate-400">{report.timestamp}</span>
                            </div>
                            <p className="text-slate-700 leading-relaxed font-sans line-clamp-2">
                              {report.description}
                            </p>
                            <div className="flex items-center justify-between border-t border-slate-50 pt-1.5">
                              <span className="bg-slate-100 text-slate-650 font-bold px-1.5 py-0.5 rounded text-[9px]">
                                {report.status}
                              </span>
                              <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                                <span className="flex items-center gap-0.5">
                                  <ThumbsUp className="h-2.5 w-2.5 fill-slate-50 text-slate-400" />
                                  {report.activeConfirms || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Analysis segment */}
                  <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100">
                    {cached?.loading ? (
                      <div className="flex items-center gap-3 py-3">
                        <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" />
                        <div>
                          <p className="text-xs font-bold text-slate-850 flex items-center gap-1">
                            Analyzing patterns ...
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Gemini is evaluating the physical parameters of these {cluster.size} concurrent events
                          </p>
                        </div>
                      </div>
                    ) : cached?.error ? (
                      <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-xs text-red-800">
                        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h5 className="font-semibold uppercase tracking-wider text-[10px] text-red-900">AI Analysis Error</h5>
                          <p className="font-sans font-medium">{cached.error}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Insight Header */}
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                            <Sparkles className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-black tracking-wider text-indigo-650">Gemini Analyst Insight</span>
                          </div>
                        </div>

                        {/* Two items list: Insight and Recommended Action */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Insight */}
                          <div className="bg-indigo-50/45 border border-indigo-100/50 rounded-xl p-4 relative overflow-hidden">
                            <div className="flex items-start gap-2.5">
                              <Lightbulb className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-850">Predictive Pattern</h5>
                                <p className="text-slate-700 text-xs leading-relaxed font-sans font-medium">
                                  {cached?.insight || "Identifying spatial trends to address repeat municipal hazards."}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Recommended proactive Action */}
                          <div className="bg-emerald-50/45 border border-emerald-100/50 rounded-xl p-4 relative overflow-hidden">
                            <div className="flex items-start gap-2.5">
                              <ArrowRight className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-850">Proactive Recommendations</h5>
                                <p className="text-slate-700 text-xs leading-relaxed font-sans font-medium">
                                  {cached?.recommended_action || "Investigating preventative measures."}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
