import React from "react";
import { motion } from "motion/react";
import { 
  Shield, 
  AlertTriangle, 
  AlertOctagon, 
  CheckCircle, 
  Clock, 
  Calendar,
  Layers,
  ArrowRight,
  TrendingDown,
  Activity,
  Briefcase
} from "lucide-react";
import { CivicReport, isVideoMedia } from "../types";

interface AdminDashboardProps {
  reports: CivicReport[];
  onUpdateStatus: (reportId: string, newStatus: "Reported" | "Acknowledged" | "In Progress" | "Resolved") => void;
}

export default function AdminDashboard({ reports, onUpdateStatus }: AdminDashboardProps) {
  // Stats Calculation
  const totalReports = reports.length;
  const criticalOpen = reports.filter(r => r.severity === "Critical" && r.status !== "Resolved").length;
  const escalated = reports.filter(r => r.escalated && r.status !== "Resolved").length;
  const resolved = reports.filter(r => r.status === "Resolved").length;

  // Sorting: Severity (Critical first) then age (oldest first)
  const severityMap: Record<string, number> = {
    "Critical": 4,
    "High": 3,
    "Medium": 2,
    "Low": 1
  };

  const sortedReports = [...reports].sort((a, b) => {
    const sevA = severityMap[a.severity] || 0;
    const sevB = severityMap[b.severity] || 0;
    
    if (sevB !== sevA) {
      return sevB - sevA; // Critical (4) down to Low (1)
    }
    
    // Sort by age: oldest first (earlier date means smaller epoch milliseconds)
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeA - timeB;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "Critical": return "bg-rose-50 text-rose-700 border-rose-100";
      case "High": return "bg-orange-50 text-orange-700 border-orange-100";
      case "Medium": return "bg-amber-50 text-amber-700 border-amber-100";
      default: return "bg-slate-50 text-slate-700 border-slate-100";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Resolved": return "bg-emerald-150 bg-emerald-50 text-emerald-800 border border-emerald-100";
      case "In Progress": return "bg-blue-50 text-blue-850 border border-blue-105/50 border-blue-100";
      case "Acknowledged": return "bg-indigo-50 text-indigo-850 border border-indigo-100";
      default: return "bg-slate-100 text-slate-800 border border-slate-200";
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn font-sans">
      {/* Overview stats layout */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Reports */}
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs flex flex-col justify-between text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-12 h-12 bg-slate-50 rounded-bl-full opacity-50" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Reports</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display font-extrabold text-3xl text-slate-850">{totalReports}</span>
            <span className="text-[10px] text-slate-400 font-medium">registered</span>
          </div>
        </div>

        {/* Critical Open */}
        <div className="bg-white p-5 rounded-2xl border-l-4 border-l-rose-500 border border-slate-150 shadow-xs flex flex-col justify-between text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-12 h-12 bg-rose-50 rounded-bl-full opacity-50" />
          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest block flex items-center gap-1">
            <AlertOctagon className="h-3 w-3 inline" />
            Critical Open
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display font-extrabold text-3xl text-rose-600">{criticalOpen}</span>
            <span className="text-[10px] text-slate-400 font-medium">pending dispatch</span>
          </div>
        </div>

        {/* Escalated Tickets */}
        <div className="bg-white p-5 rounded-2xl border-l-4 border-l-amber-500 border border-slate-150 shadow-xs flex flex-col justify-between text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-12 h-12 bg-amber-50 rounded-bl-full opacity-50" />
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 inline" />
            Escalated SLA
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display font-extrabold text-3xl text-amber-600">{escalated}</span>
            <span className="text-[10px] text-slate-400 font-medium">SLA breaches</span>
          </div>
        </div>

        {/* Resolved Today */}
        <div className="bg-white p-5 rounded-2xl border-l-4 border-l-emerald-500 border border-slate-150 shadow-xs flex flex-col justify-between text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-50 rounded-bl-full opacity-50" />
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest block flex items-center gap-1">
            <CheckCircle className="h-3 w-3 inline" />
            Resolved Today
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display font-extrabold text-3xl text-emerald-600">{resolved}</span>
            <span className="text-[10px] text-slate-400 font-medium">closed issues</span>
          </div>
        </div>
      </div>

      {/* Header section */}
      <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-4">
          <div className="text-left">
            <h2 className="font-display font-black text-lg text-slate-800 flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-600" />
              Municipal Triage & Resolution Console
            </h2>
            <p className="text-xs text-slate-400 mt-1">Supervise, triage, and reassemble municipal department statuses sorted by emergency severity constraints.</p>
          </div>
          <span className="bg-indigo-50 border border-indigo-100 text-[10px] text-indigo-750 font-extrabold tracking-wider uppercase px-3 py-1 rounded-full flex items-center gap-1 inline-block self-start sm:self-auto">
            <Activity className="h-3 w-3 animate-pulse text-indigo-600" />
            Authority Desk Mode
          </span>
        </div>

        {/* Admin control list frame */}
        <div className="space-y-4">
          {sortedReports.length > 0 ? (
            sortedReports.map((report) => (
              <div 
                key={`admin-${report.id}`}
                className="bg-slate-50/50 hover:bg-slate-50 border border-slate-150 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row gap-5 transition duration-150"
              >
                {/* Visual Media Asset (left) */}
                <div className="relative aspect-video w-full md:w-44 h-28 md:h-28 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shrink-0">
                  {isVideoMedia(report.photo) ? (
                    <video
                      src={report.photo}
                      controls
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img 
                      referrerPolicy="no-referrer"
                      src={report.photo} 
                      alt={report.category}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <span className={`absolute top-2 left-2 text-[8px] font-black tracking-wider uppercase border px-2 py-0.5 rounded shadow-sm text-slate-800 bg-white`}>
                    #{report.id.substring(4, 8)}
                  </span>
                </div>

                {/* Mid detail column */}
                <div className="flex-1 text-left space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display font-bold text-base text-slate-850">
                      {report.category}
                    </h3>
                    
                    <span className={`text-[9px] font-bold border px-2 py-0.5 rounded-full ${getSeverityColor(report.severity)}`}>
                      {report.severity}
                    </span>

                    <span className={`text-[9px] font-bold border px-2 py-0.5 rounded-full ${getStatusColor(report.status)}`}>
                      {report.status}
                    </span>

                    {report.escalated && report.status !== "Resolved" && (
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        SLA Escalated
                      </span>
                    )}

                    {report.communityResolved && report.status !== "Resolved" && (
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                        <CheckCircle className="h-2.5 w-2.5 text-emerald-600" />
                        Community-reported resolved (3+ votes)
                      </span>
                    )}
                  </div>

                  <p className="text-slate-600 text-xs leading-relaxed max-w-2xl font-sans">
                    "{report.description}"
                  </p>

                  <div className="flex flex-wrap gap-4 text-[10.5px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1 bg-white border border-slate-150 px-2 py-0.5 rounded">
                      <Briefcase className="h-3 w-3 text-slate-400 text-[10px] inline-block mr-0.5" />
                      Dept: <strong className="text-slate-600 font-semibold">{report.department}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      Frame check: <strong className="text-slate-500 font-medium">{report.timestamp}</strong>
                    </span>
                    {report.createdAt && (
                      <span className="hidden sm:inline">
                        Registered: {new Date(report.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>

                  {/* Generated escalation warnings in card */}
                  {report.escalated && report.status !== "Resolved" && report.escalationNote && (
                    <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 mt-2 text-rose-800 italic text-[11px] leading-relaxed">
                      <span className="text-[9px] tracking-wider font-extrabold uppercase text-rose-700 block mb-0.5">⚠️ Generated Escalation Warning Note:</span>
                      "{report.escalationNote}"
                    </div>
                  )}
                </div>

                {/* Right Interactive Controls */}
                <div className="flex flex-col justify-center min-w-[200px] text-left md:text-right border-t md:border-t-0 md:border-l border-slate-150 pt-4 md:pt-0 md:pl-5 shrink-0 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Update Status Stage</label>
                    <div className="flex md:flex-col lg:flex-row flex-wrap gap-1 bg-white p-1 rounded-xl border border-slate-200">
                      {["Reported", "Acknowledged", "In Progress", "Resolved"].map((stage) => {
                        const isCurrent = report.status === stage;
                        return (
                          <button
                            key={stage}
                            onClick={() => onUpdateStatus(report.id, stage as any)}
                            className={`flex-1 min-w-[70px] text-center px-1.5 py-1.5 rounded-lg text-[9.5px] font-bold transition duration-150 ${
                              isCurrent 
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                            }`}
                          >
                            {stage === "Acknowledged" ? "Ack" : stage === "In Progress" ? "Progress" : stage}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="text-[9px] text-slate-400 italic">
                    Log updates reflect in live neighborhood timeline trackers.
                  </div>
                </div>

              </div>
            ))
          ) : (
            <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-6">
              <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
              <h4 className="font-semibold text-slate-700 text-sm mt-3">No Reports Managed</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                All registered system tickets are clean and clear.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
