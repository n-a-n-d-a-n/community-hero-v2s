import React from "react";
import { Trophy, Award, Zap, Heart, ShieldAlert, Sparkles, HelpCircle } from "lucide-react";

export interface LeaderboardEntry {
  deviceId: string;
  label: string;
  points: number;
  isCurrentUser?: boolean;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  userPoints: number;
  deviceId: string;
}

export default function Leaderboard({ entries, userPoints, deviceId }: LeaderboardProps) {
  const getTierDetails = (pts: number) => {
    if (pts >= 150) {
      return { 
        name: "Gold", 
        badge: "🏆", 
        color: "text-amber-500 bg-amber-500/10 border-amber-500/35", 
        desc: "Elite Civic Protector",
        nextTier: "Max Tier Reached"
      };
    }
    if (pts >= 50) {
      return { 
        name: "Silver", 
        badge: "🥈", 
        color: "text-slate-500 bg-slate-500/10 border-slate-500/35", 
        desc: "Active Neighborhood Helper",
        nextTier: `${150 - pts} pts to Gold`
      };
    }
    return { 
      name: "Bronze", 
      badge: "🥉", 
      color: "text-amber-700 bg-amber-700/10 border-amber-700/35", 
      desc: "Local Support Intern",
      nextTier: `${50 - pts} pts to Silver`
    };
  };

  const userTier = getTierDetails(userPoints);

  // Simple reward helper for help tip
  const rewardStructure = [
    { action: "Submit Report", reward: "+10 pts" },
    { action: "Confirm Issue ('I see this too')", reward: "+5 pts" },
    { action: "Confirm Resolved ('This is resolved')", reward: "+5 pts" },
  ];

  return (
    <div className="space-y-6">
      {/* User Progress card */}
      <div className="bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 shadow-md border border-slate-700/50 relative overflow-hidden text-left">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Trophy className="h-24 w-24 text-white rotate-12" />
        </div>
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-mono uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md">
              Your Persona
            </span>
            <span className={`text-[10px] border font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 ${userTier.color}`}>
              {userTier.badge} {userTier.name}
            </span>
          </div>

          <div className="space-y-1">
            <h4 className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Cumulative Impact</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-white">{userPoints}</span>
              <span className="text-xs text-indigo-300 font-bold">total pts</span>
            </div>
          </div>

          {/* Progress bar towards next tier */}
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
              <span>{userTier.desc}</span>
              <span className="text-indigo-300">{userTier.nextTier}</span>
            </div>
            {userPoints < 150 ? (
              <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (userPoints / (userPoints >= 50 ? 150 : 50)) * 100)}%` }}
                ></div>
              </div>
            ) : (
              <div className="w-full h-1.5 bg-amber-500/30 rounded-full overflow-hidden">
                <div className="bg-amber-400 h-full rounded-full w-full"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leaderboard panel itself */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4 text-left">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4.5 w-4.5 text-indigo-600" />
            <h3 className="font-display font-extrabold text-sm text-slate-850">
              Top Contributors
            </h3>
          </div>
          <span className="bg-indigo-50 text-indigo-700 hover:text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-md">
            All devices
          </span>
        </div>

        <div className="space-y-2.5">
          {entries.map((entry, index) => {
            const isSelf = entry.deviceId === deviceId;
            const rankStyle = 
              index === 0 ? "bg-amber-100 text-amber-800 border-amber-200" :
              index === 1 ? "bg-slate-100 text-slate-700 border-slate-200" :
              index === 2 ? "bg-amber-100/50 text-amber-900 border-amber-150" :
              "bg-slate-50 text-slate-500 border-slate-150";

            const tierMeta = getTierDetails(entry.points);

            return (
              <div 
                key={entry.deviceId}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                  isSelf 
                    ? "bg-indigo-50/75 border-indigo-200 text-indigo-950 shadow-xs ring-1 ring-indigo-100" 
                    : "bg-white border-slate-100 hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Rank Badge */}
                  <span className={`h-5 w-5 rounded-md border text-[11px] font-black flex items-center justify-center shrink-0 ${rankStyle}`}>
                    {index + 1}
                  </span>
                  
                  {/* Contributor label */}
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${isSelf ? "text-indigo-950 font-black" : "text-slate-700"}`}>
                      {isSelf ? "You (Contributor)" : entry.label}
                    </p>
                    <p className="text-[9.5px] text-slate-400 font-semibold uppercase font-mono tracking-wider flex items-center gap-1 mt-0.5">
                      <span>{tierMeta.badge} {tierMeta.name}</span>
                      {isSelf && <span className="text-indigo-500">• Persistent Device</span>}
                    </p>
                  </div>
                </div>

                {/* Score */}
                <span className="text-xs font-black text-slate-800 font-mono whitespace-nowrap bg-slate-50 border border-slate-150 px-2 py-1 rounded-lg">
                  {entry.points} pts
                </span>
              </div>
            );
          })}
        </div>

        {/* Informative point breakdown footnote */}
        <div className="border-t border-slate-100 pt-3.5 space-y-2">
          <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[9px] uppercase tracking-wider">
            <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
            <span>How to earn cumulative points:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-550">
            {rewardStructure.map((r, i) => (
              <div key={i} className="flex justify-between items-center bg-slate-50 border border-slate-100 px-2 py-1 rounded-md">
                <span className="truncate max-w-[95px] font-medium">{r.action}</span>
                <span className="font-extrabold text-indigo-600 font-mono ml-1">{r.reward}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
