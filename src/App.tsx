import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldCheck, 
  MapPin, 
  Flame, 
  Heart, 
  ListFilter, 
  TrendingUp, 
  BookOpen, 
  Smile, 
  Search, 
  ThumbsUp, 
  MessageSquare, 
  CheckCircle, 
  Calendar,
  Layers,
  ArrowUpDown,
  Compass,
  Volume2,
  Map,
  BadgeAlert,
  AlertOctagon,
  AlertTriangle,
  Shield,
  Sparkles
} from "lucide-react";
import ReportForm from "./components/ReportForm";
import { CivicReport, HistoryEvent, isVideoMedia } from "./types";
import { STARTER_REPORTS } from "./components/MockData";
import MapView from "./components/MapView";
import AdminDashboard from "./components/AdminDashboard";
import HotspotInsights from "./components/HotspotInsights";
import Leaderboard, { LeaderboardEntry } from "./components/Leaderboard";
import {
  db,
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove,
  User,
  handleFirestoreError,
  OperationType
} from "./firebase";

export default function App() {
  const [dbReports, setDbReports] = useState<CivicReport[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("All");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"newest" | "popular">("newest");
  const [viewMode, setViewMode] = useState<"feed" | "map" | "admin" | "insights">("feed");

  // Notifications state
  const [notification, setNotification] = useState<string | null>(null);

  // Persistent anonymous device ID (UUID stored in localStorage)
  const [deviceId] = useState<string>(() => {
    let id = localStorage.getItem("community_hero_device_id");
    if (id && !id.startsWith("dev_")) {
      id = "dev_" + id;
      localStorage.setItem("community_hero_device_id", id);
    }
    if (!id) {
      let rawId = "";
      try {
        if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
          rawId = window.crypto.randomUUID();
        }
      } catch (e) {}
      if (!rawId) {
        rawId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      }
      id = "dev_" + rawId;
      localStorage.setItem("community_hero_device_id", id);
    }
    return id;
  });

  const [user, setUser] = useState<User | null>(null);
  const [currentUid, setCurrentUid] = useState<string>(deviceId);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [myReportIds, setMyReportIds] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<{
    points: number;
    displayName: string;
    avatarUrl: string;
    activeConfirmedReportIds: string[];
    resolvedConfirmedReportIds: string[];
    upvotedReportIds: string[];
    myReportIds: string[];
  } | null>(null);

  // Synchronise Authentication status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      if (authUser) {
        setCurrentUid(authUser.uid);
      } else {
        setCurrentUid(deviceId);
      }
    });
    return () => unsubscribe();
  }, [deviceId]);

  // Synchronise User profile from Firestore
  useEffect(() => {
    if (!currentUid) return;
    const userDocRef = doc(db, "users", currentUid);
    const unsubscribe = onSnapshot(userDocRef, (userDoc) => {
      if (userDoc.exists()) {
        const data = userDoc.data();
        const profile = {
          points: typeof data.points === "number" ? data.points : 0,
          displayName: data.displayName || "",
          avatarUrl: data.avatarUrl || "",
          activeConfirmedReportIds: Array.isArray(data.activeConfirmedReportIds) ? data.activeConfirmedReportIds : [],
          resolvedConfirmedReportIds: Array.isArray(data.resolvedConfirmedReportIds) ? data.resolvedConfirmedReportIds : [],
          upvotedReportIds: Array.isArray(data.upvotedReportIds) ? data.upvotedReportIds : [],
          myReportIds: Array.isArray(data.myReportIds) ? data.myReportIds : [],
        };
        setUserProfile(profile);
        setUserPoints(profile.points);
        setMyReportIds(profile.myReportIds);
      } else {
        // Retrieve local storage backups to make the transition completely seamless!
        const localSavedPoints = localStorage.getItem(`community_hero_points_${deviceId}`);
        const initialPoints = localSavedPoints ? parseInt(localSavedPoints, 10) : 0;
        
        const localMyReports = localStorage.getItem("community_hero_my_reports");
        const initialMyReports = localMyReports ? JSON.parse(localMyReports) : [];

        const initialProfile = {
          id: currentUid,
          points: initialPoints,
          displayName: user?.displayName || `Contributor #${currentUid.replace("dev_", "").substring(0, 4)}`,
          avatarUrl: user?.photoURL || "",
          activeConfirmedReportIds: [],
          resolvedConfirmedReportIds: [],
          upvotedReportIds: [],
          myReportIds: initialMyReports,
        };
        
        setDoc(userDocRef, initialProfile).then(() => {
          console.log("User profile initialised in Firestore!");
        }).catch(err => {
          console.warn("Could not write initial user profile to Firestore (using local fallback):", err);
        });
      }
    }, (error) => {
      console.warn("User profile sync warning (operating in local-first/offline mode):", error.message || error);
      if (error?.message?.toLowerCase().includes("permission")) {
        handleFirestoreError(error, OperationType.GET, `users/${currentUid}`);
      }
      // Ensure local state fallback is initialized if connection fails
      const localSavedPoints = localStorage.getItem(`community_hero_points_${deviceId}`);
      const initialPoints = localSavedPoints ? parseInt(localSavedPoints, 10) : 0;
      const localMyReports = localStorage.getItem("community_hero_my_reports");
      const initialMyReports = localMyReports ? JSON.parse(localMyReports) : [];
      setUserProfile({
        points: initialPoints,
        displayName: user?.displayName || `Contributor #${currentUid?.replace("dev_", "").substring(0, 4) || "Guest"}`,
        avatarUrl: user?.photoURL || "",
        activeConfirmedReportIds: [],
        resolvedConfirmedReportIds: [],
        upvotedReportIds: [],
        myReportIds: initialMyReports,
      });
    });
    return () => unsubscribe();
  }, [currentUid, deviceId, user]);

  // Real-Time sync for reports
  useEffect(() => {
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // Seed reports if database collection is empty
        const batchRef = writeBatch(db);
        STARTER_REPORTS.forEach(report => {
          const docRef = doc(collection(db, "reports"), report.id);
          batchRef.set(docRef, report);
        });
        batchRef.commit().then(() => {
          console.log("Database seeded successfully with starter reports!");
        });
      } else {
        const list: CivicReport[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            ...data,
            history: Array.isArray(data.history) ? data.history : [],
            upvotes: typeof data.upvotes === "number" ? data.upvotes : 0,
            activeConfirms: typeof data.activeConfirms === "number" ? data.activeConfirms : 0,
            resolvedConfirms: typeof data.resolvedConfirms === "number" ? data.resolvedConfirms : 0,
          } as CivicReport);
        });
        setDbReports(list);
      }
    }, (error) => {
      console.warn("Reports sync warning (using starter reports fallback offline):", error.message || error);
      if (error?.message?.toLowerCase().includes("permission")) {
        handleFirestoreError(error, OperationType.LIST, "reports");
      }
      setDbReports(STARTER_REPORTS);
    });
    return () => unsubscribe();
  }, []);

  // Compute final reports with transient user-specific active/resolved flags
  const reports = useMemo(() => {
    return dbReports.map(rep => {
      const activeConfirmed = !!userProfile?.activeConfirmedReportIds?.includes(rep.id);
      const resolvedConfirmed = !!userProfile?.resolvedConfirmedReportIds?.includes(rep.id);
      return {
        ...rep,
        hasConfirmedActive: activeConfirmed,
        hasConfirmedResolved: resolvedConfirmed,
      };
    });
  }, [dbReports, userProfile]);

  const [dbUsers, setDbUsers] = useState<any[]>([]);

  // Listen to top real users (excluding synthetic or simulated IDs)
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("points", "desc"), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: any[] = [];
      snapshot.forEach(docSnap => {
        const id = docSnap.id;
        // Skip synthetic / developer pre-seeded users if any exist in the database
        if (!id.startsWith("sim-") && !id.startsWith("const-")) {
          users.push({ id, ...docSnap.data() });
        }
      });
      setDbUsers(users);
    }, (error) => {
      console.warn("Leaderboard sync warning:", error.message || error);
    });
    return () => unsubscribe();
  }, []);

  const leaderboard: LeaderboardEntry[] = useMemo(() => {
    return dbUsers.map(u => ({
      deviceId: u.id,
      label: u.id === currentUid ? `You (${u.displayName || "Contributor"})` : u.displayName || `Contributor #${u.id.replace("dev_", "").substring(0, 4)}`,
      points: u.points || 0,
      isCurrentUser: u.id === currentUid,
    }));
  }, [dbUsers, currentUid]);

  const handleSignInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const googleUser = result.user;
      
      const localAnonymousPoints = userPoints;
      const localAnonymousReports = myReportIds;
      
      const userDocRef = doc(db, "users", googleUser.uid);
      let userDoc: any;
      let hasFirestoreWritten = false;
      
      try {
        userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          const nextPoints = (data.points || 0) === 0 ? localAnonymousPoints : data.points;
          const nextReports = Array.isArray(data.myReportIds) && data.myReportIds.length > 0 
            ? data.myReportIds 
            : localAnonymousReports;
            
          await setDoc(userDocRef, {
            id: googleUser.uid,
            points: nextPoints,
            displayName: googleUser.displayName || `Contributor #${googleUser.uid.substring(0, 4)}`,
            avatarUrl: googleUser.photoURL || "",
            activeConfirmedReportIds: data.activeConfirmedReportIds || [],
            resolvedConfirmedReportIds: data.resolvedConfirmedReportIds || [],
            upvotedReportIds: data.upvotedReportIds || [],
            myReportIds: nextReports,
          }, { merge: true });
        } else {
          await setDoc(userDocRef, {
            id: googleUser.uid,
            points: localAnonymousPoints,
            displayName: googleUser.displayName || `Contributor #${googleUser.uid.substring(0, 4)}`,
            avatarUrl: googleUser.photoURL || "",
            activeConfirmedReportIds: [],
            resolvedConfirmedReportIds: [],
            upvotedReportIds: [],
            myReportIds: localAnonymousReports,
          });
        }
        hasFirestoreWritten = true;
      } catch (getErr: any) {
        console.warn("Firestore profile synchronization warning (falling back to offline local state):", getErr.message || getErr);
      }

      // If network is offline, initialize locally so the user is signed in seamlessly in UI
      if (!hasFirestoreWritten) {
        setUserProfile({
          points: localAnonymousPoints,
          displayName: googleUser.displayName || `Contributor #${googleUser.uid.substring(0, 4)}`,
          avatarUrl: googleUser.photoURL || "",
          activeConfirmedReportIds: [],
          resolvedConfirmedReportIds: [],
          upvotedReportIds: [],
          myReportIds: localAnonymousReports,
        });
      }

      showNotification(`Welcome, ${googleUser.displayName || "Hero"}! ${hasFirestoreWritten ? "Points consolidated." : "Operating in offline local-first mode."}`);
    } catch (err: any) {
      const errCode = err?.code || "";
      const errMsg = err?.message || "";
      
      if (errCode === "auth/popup-closed-by-user" || errMsg.includes("popup-closed-by-user")) {
        console.log("Sign-in popup closed by user.");
        showNotification("Sign-in cancelled. If the popup was blocked by your browser, click 'Open' in the top right to open the app in a new tab first.");
      } else if (errCode === "auth/popup-blocked" || errMsg.includes("popup-blocked")) {
        console.log("Sign-in popup blocked.");
        showNotification("Sign-in popup was blocked. Please enable popups or open the app in a new tab to sign in.");
      } else if (errCode === "auth/cancelled-popup-request" || errMsg.includes("cancelled-popup-request")) {
        console.log("Sign-in popup request cancelled.");
      } else {
        console.warn("Sign-in warning:", err);
        showNotification("Sign-In status: " + (err.message || err));
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showNotification("Successfully signed out your secure session!");
    } catch (err: any) {
      console.error("Sign-out failed:", err);
    }
  };

  const adjustUserPoints = async (amount: number) => {
    if (!currentUid) return;
    const nextPoints = Math.max(0, userPoints + amount);
    
    // Optimistically update React State instantly for stellar responsiveness
    setUserPoints(nextPoints);
    setUserProfile(prev => {
      if (!prev) return prev;
      return { ...prev, points: nextPoints };
    });

    const userDocRef = doc(db, "users", currentUid);
    try {
      await updateDoc(userDocRef, { points: nextPoints });
    } catch (e) {
      console.warn("Offline/Network issue on point synchronisation (kept local profile update):", e);
    }
  };

  const getUserTier = (pts: number) => {
    if (pts >= 150) return { name: "Gold", badge: "🏆", color: "text-amber-500 bg-amber-550/15 border-amber-300" };
    if (pts >= 50) return { name: "Silver", badge: "🥈", color: "text-slate-500 bg-slate-550/15 border-slate-300" };
    return { name: "Bronze", badge: "🥉", color: "text-amber-700 bg-amber-700/10 border-amber-200" };
  };

  // Keep reports state in ref for safe non-stale use in scheduler without re-triggering effect loops
  const reportsRef = useRef(reports);
  useEffect(() => {
    reportsRef.current = reports;
  }, [reports]);

  useEffect(() => {
    const runSlaChecks = async () => {
      const currentReports = reportsRef.current;
      const now = new Date().getTime();
      
      const getSlaLimit = (severity: string): number => {
        switch (severity) {
          case "Critical": return 24 * 60 * 60 * 1000;
          case "High": return 3 * 24 * 60 * 60 * 1000;
          case "Medium": return 7 * 24 * 60 * 60 * 1000;
          case "Low": return 14 * 24 * 60 * 60 * 1000;
          default: return 7 * 24 * 60 * 60 * 1000;
        }
      };

      // Filter reports in "Reported" or "Acknowledged" status that are older than SLA
      const staleCandidates = currentReports.filter(rep => {
        if (rep.escalated) return false;
        if (rep.status !== "Reported" && rep.status !== "Acknowledged") return false;
        if (!rep.createdAt) return false;
        
        const createdAtTime = new Date(rep.createdAt).getTime();
        const slalimit = getSlaLimit(rep.severity);
        return (now - createdAtTime) > slalimit;
      });

      if (staleCandidates.length === 0) return;

      for (const rep of staleCandidates) {
        try {
          const ageDays = Math.ceil((now - new Date(rep.createdAt).getTime()) / (24 * 60 * 60 * 1000));
          const response = await fetch("/api/escalate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category: rep.category,
              severity: rep.severity,
              description: rep.description,
              department: rep.department,
              ageDays: ageDays
            })
          });

          if (response.ok) {
            const body = await response.json();
            const note = body.result.escalation_note || `Escalation warning issued: Exceeded ${rep.severity} SLA.`;
            
            const repRef = doc(db, "reports", rep.id);
            await updateDoc(repRef, {
              escalated: true,
              escalationNote: note,
              escalatedAt: new Date().toISOString()
            });
            showNotification(`SLA violation detected for ${rep.category}. Auto-escalation generated.`);
          }
        } catch (err: any) {
          console.warn("Automatic Escalation Agent warning (retrying later):", err.message || err);
        }
      }
    };

    // Run first check on mount
    runSlaChecks();

    // Set up continuous 60-second periodic check
    const interval = setInterval(() => {
      runSlaChecks();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleCreateBackdatedReport = async () => {
    const backdatedTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const formattedTime = backdatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const backdatedReport: CivicReport = {
      id: `rep_backdated_${Date.now()}`,
      photo: "https://images.unsplash.com/photo-1599740831114-17105077a9a8?auto=format&fit=crop&q=80&w=600",
      lat: 37.7749 + (Math.random() - 0.5) * 0.02,
      lng: -122.4194 + (Math.random() - 0.5) * 0.02,
      category: "Trash/Emergency Spill",
      severity: "Critical", // 24h SLA threshold
      description: "Industrial hazardous container is leaking fluid nearby a major fire connection. Roadway is completely blocked.",
      department: "Fire Department",
      status: "Reported",
      timestamp: "25 hours ago",
      upvotes: 4,
      activeConfirms: 4,
      resolvedConfirms: 0,
      hasConfirmedActive: false,
      hasConfirmedResolved: false,
      communityResolved: false,
      createdAt: backdatedTime.toISOString(),
      history: [
        {
          status: "Reported",
          timestamp: "25 hours ago",
          note: `Auto-routed to Fire Department at ${formattedTime}`
        }
      ]
    };

    try {
      const repRef = doc(db, "reports", backdatedReport.id);
      await setDoc(repRef, backdatedReport);
      showNotification("Backdated SLA issue injected! Escalation Agent is evaluating...");
    } catch (err) {
      console.error("Inject backdated report failed:", err);
    }
  };

  const handleUpdateStatus = async (
    reportId: string,
    newStatus: "Reported" | "Acknowledged" | "In Progress" | "Resolved"
  ) => {
    try {
      const report = reports.find(r => r.id === reportId);
      if (!report) return;

      const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateString = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
      
      const newHistoryEvent: HistoryEvent = {
        status: newStatus,
        timestamp: "Just now",
        note: `Status updated to ${newStatus} on ${dateString} at ${formattedTime} by administrator.`
      };

      const updatedHistory = Array.isArray(report.history) ? [...report.history] : [];
      const existingIndex = updatedHistory.findIndex(h => h.status.toLowerCase() === newStatus.toLowerCase());
      if (existingIndex >= 0) {
        updatedHistory[existingIndex] = newHistoryEvent;
      } else {
        updatedHistory.push(newHistoryEvent);
      }

      const repRef = doc(db, "reports", reportId);
      await updateDoc(repRef, {
        status: newStatus,
        history: updatedHistory
      });

      showNotification(`Successfully updated report stage to ${newStatus}`);
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleIncrementUpvoteDirectly = async (reportId: string) => {
    try {
      const repRef = doc(db, "reports", reportId);
      const repSnap = await getDoc(repRef);
      if (!repSnap.exists()) return;
      
      const repData = repSnap.data();
      const alreadyConfirmed = userProfile?.activeConfirmedReportIds?.includes(reportId);
      
      const batchList = writeBatch(db);
      batchList.update(repRef, {
        upvotes: increment(1),
        activeConfirms: increment(1)
      });
      
      if (currentUid) {
        batchList.set(doc(db, "users", currentUid), {
          id: currentUid,
          upvotedReportIds: arrayUnion(reportId),
          activeConfirmedReportIds: arrayUnion(reportId),
          points: increment(alreadyConfirmed ? 0 : 5)
        }, { merge: true });
      }
      await batchList.commit();
      showNotification("Similar report detected nearby. We added your upvote to escalate this issue! +5 points!");
    } catch (err) {
      console.error("Upvote failed:", err);
    }
  };

  const handleAddNewReport = async (newReportData: Omit<CivicReport, "id" | "status" | "timestamp" | "upvotes" | "createdAt" | "history" | "escalated" | "escalationNote" | "escalatedAt" | "activeConfirms" | "resolvedConfirms" | "hasConfirmedActive" | "hasConfirmedResolved" | "communityResolved">) => {
    const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const freshReportId = `rep_${Date.now()}`;
    const freshReport: any = {
      ...newReportData,
      id: freshReportId,
      status: "Reported",
      timestamp: "Just now",
      upvotes: 0,
      activeConfirms: 0,
      resolvedConfirms: 0,
      communityResolved: false,
      createdAt: new Date().toISOString(),
      history: [
        {
          status: "Reported",
          timestamp: "Just now",
          note: `Auto-routed to ${newReportData.department} at ${formattedTime}`
        }
      ]
    };

    try {
      const batchList = writeBatch(db);
      batchList.set(doc(db, "reports", freshReportId), freshReport);
      
      if (currentUid) {
        batchList.set(doc(db, "users", currentUid), {
          id: currentUid,
          myReportIds: arrayUnion(freshReportId),
          points: increment(10)
        }, { merge: true });
      }
      await batchList.commit();
      showNotification(`Successfully published issue under ${freshReport.category}! +10 points awarded!`);
    } catch (err: any) {
      console.error("Report submit failed:", err);
      if (err?.message?.toLowerCase().includes("permission")) {
        handleFirestoreError(err, OperationType.WRITE, `reports/${freshReportId}`);
      }
      showNotification("Failed to submit report. Please try again.");
    }
  };

  const handleToggleActiveConfirm = async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const alreadyConfirmed = !!userProfile?.activeConfirmedReportIds?.includes(reportId);
      const delta = alreadyConfirmed ? -1 : 1;
      
      const batchList = writeBatch(db);
      batchList.update(doc(db, "reports", reportId), {
        activeConfirms: increment(delta),
        upvotes: increment(delta)
      });
      
      if (currentUid) {
        batchList.set(doc(db, "users", currentUid), {
          id: currentUid,
          activeConfirmedReportIds: alreadyConfirmed ? arrayRemove(reportId) : arrayUnion(reportId),
          points: increment(delta * 5)
        }, { merge: true });
      }
      await batchList.commit();
      showNotification(alreadyConfirmed ? "Removed active confirmation. (-5 pts)" : "Confirmed active status! (+5 pts)");
    } catch (err) {
      console.error("Confirm active failed:", err);
    }
  };

  const handleToggleResolvedConfirm = async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const report = reports.find(r => r.id === reportId);
      if (!report || report.status === "Resolved") return;

      const alreadyConfirmed = !!userProfile?.resolvedConfirmedReportIds?.includes(reportId);
      const delta = alreadyConfirmed ? -1 : 1;
      const newResolvedCount = (report.resolvedConfirms || 0) + delta;
      const isCommunityResolvedNow = newResolvedCount >= 3;

      let newHistory = Array.isArray(report.history) ? [...report.history] : [];
      let commResolvedVal = report.communityResolved;

      if (isCommunityResolvedNow && !report.communityResolved) {
        commResolvedVal = true;
        const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
        newHistory.push({
          status: "Community Flagged Resolved",
          timestamp: "Just now",
          note: `This report has been flagged as 'Community-reported resolved' by 3+ citizen voices on ${dateString} at ${formattedTime}.`
        });
      } else if (!isCommunityResolvedNow && report.communityResolved) {
        commResolvedVal = false;
      }

      const batchList = writeBatch(db);
      batchList.update(doc(db, "reports", reportId), {
        resolvedConfirms: increment(delta),
        communityResolved: commResolvedVal,
        history: newHistory
      });

      if (currentUid) {
        batchList.set(doc(db, "users", currentUid), {
          id: currentUid,
          resolvedConfirmedReportIds: alreadyConfirmed ? arrayRemove(reportId) : arrayUnion(reportId),
          points: increment(delta * 5)
        }, { merge: true });
      }
      await batchList.commit();
      showNotification(alreadyConfirmed ? "Removed resolution verification. (-5 pts)" : "Verified resolved status! (+5 pts)");
    } catch (err) {
      console.error("Confirm resolution failed:", err);
    }
  };

  // Filter & Sort Logic
  const filteredReports = reports.filter((rep) => {
    const matchesSearch = 
      rep.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.department.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === "All" || rep.category === selectedCategory;
    const matchesSeverity = selectedSeverity === "All" || rep.severity === selectedSeverity;
    const matchesDept = selectedDepartment === "All" || rep.department === selectedDepartment;

    return matchesSearch && matchesCategory && matchesSeverity && matchesDept;
  });

  const sortedReports = [...filteredReports].sort((a, b) => {
    if (sortBy === "popular") {
      return b.upvotes - a.upvotes;
    }
    // "Just now" or "2 hours ago" sorting
    if (a.timestamp === "Just now") return -1;
    if (b.timestamp === "Just now") return 1;
    return 0; // maintain default push order
  });

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case "Critical":
        return "bg-red-50 text-red-700 border-red-200";
      case "High":
        return "bg-orange-50 text-orange-700 border-orange-250";
      case "Medium":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  };

  const categories = ["All", "Pothole", "Garbage", "Streetlight", "Waterlogging", "Signage", "Other"];
  const severities = ["All", "Low", "Medium", "High", "Critical"];
  const departments = ["All", "Roads", "Sanitation", "Electricity", "Water", "Municipal General"];

  // Aggregate Stats
  const totalReportCount = reports.length;
  const criticalCount = reports.filter(r => r.severity === "Critical" || r.severity === "High").length;
  const resolvedCount = reports.filter(r => r.status === "Resolved").length;

  const stages = ["Reported", "Acknowledged", "In Progress", "Resolved"];
  const getStageTimestamp = (history: any[], stageName: string) => {
    if (!history) return null;
    const item = history.find(h => h.status.toLowerCase() === stageName.toLowerCase());
    return item ? item.timestamp : null;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans flex flex-col">
      
      {/* Dynamic Toast Alerts */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 16 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-indigo-900 text-white rounded-full px-5 py-2.5 shadow-lg border border-indigo-700/50 flex items-center gap-2 max-w-sm w-full text-xs font-semibold"
          >
            <ShieldCheck className="h-4.5 w-4.5 text-emerald-400 shrink-0 animate-bounce" />
            <span className="flex-1">{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3.5 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 shadow-sm flex items-center justify-center text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="font-display font-black tracking-tight text-slate-800 text-base md:text-lg block">
                COMMUNITY<span className="text-indigo-600">HERO</span>
              </span>
              <span className="text-[9.5px] font-mono tracking-widest text-slate-400 uppercase block font-bold">
                AI Civic Action Triage
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Gemini Triage Model Active
            </div>
            
            {/* Live Gamification & Auth Widget */}
            <div className="flex items-center gap-2 bg-indigo-550 bg-indigo-50/60 border border-indigo-100/80 rounded-xl px-2.5 py-1 text-left">
              {user ? (
                <div className="flex items-center gap-2">
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || "User"} 
                      referrerPolicy="no-referrer" 
                      className="h-6 w-6 rounded-lg object-cover border border-indigo-200" 
                    />
                  ) : (
                    <span className="text-[15px] select-none">{getUserTier(userPoints).badge}</span>
                  )}
                  <div className="leading-none">
                    <span className="text-[8px] text-slate-400 font-mono font-bold uppercase tracking-wider block truncate max-w-[80px]" title={user.displayName || ""}>
                      {user.displayName || "Citizen"}
                    </span>
                    <span className="text-[11px] text-indigo-900 font-black flex items-center gap-0.5 mt-0.5">
                      {userPoints} <span className="text-[9px] text-slate-500 font-medium font-sans">pts</span>
                    </span>
                  </div>
                  <button 
                    onClick={handleSignOut}
                    className="text-[10px] text-slate-400 hover:text-rose-600 font-bold ml-1 pl-1.5 border-l border-slate-200 transition duration-150 cursor-pointer"
                    title="Sign Out"
                  >
                    Out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[15px] select-none" title={`Rank: ${getUserTier(userPoints).name} Contributor`}>
                    {getUserTier(userPoints).badge}
                  </span>
                  <div className="leading-none mr-1">
                    <span className="text-[8px] text-slate-400 font-mono font-bold uppercase tracking-wider block">Your Impact</span>
                    <span className="text-[11px] text-indigo-900 font-black flex items-center gap-0.5 mt-0.5">
                      {userPoints} <span className="text-[9px] text-slate-550 font-extrabold uppercase font-sans">pts</span>
                    </span>
                  </div>
                  <button
                    onClick={handleSignInWithGoogle}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition duration-150 cursor-pointer"
                    title="Sign in with Google to sync points across devices"
                  >
                    <svg className="h-2.5 w-2.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Sign In</span>
                  </button>
                </div>
              )}
            </div>
            
            <a 
              href="#report_form_container"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-display px-4 py-2 rounded-xl transition shadow-sm hover:shadow-indigo-50"
            >
              File Issue
            </a>
          </div>
        </div>
      </header>

      {/* Hero Intro Display */}
      <section className="bg-gradient-to-b from-indigo-50/70 via-indigo-50/20 to-transparent py-10 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-150 rounded-full text-xs font-semibold text-slate-600 shadow-sm">
            <BadgeAlert className="h-3.5 w-3.5 text-indigo-500" />
            Empowering Citizen-Led Change
          </div>
          <h1 className="font-display font-extrabold text-3xl md:text-4xl text-slate-900 tracking-tight leading-tight">
            Spot a problem? <br className="sm:hidden" />
            Let <span className="bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent">Gemini AI</span> route it.
          </h1>
          <p className="text-slate-500 text-xs md:text-sm max-w-xl mx-auto leading-relaxed">
            Snap a picture of broken civic infrastructure. Gemini 2.5 instantly extracts the category, severity level, and alerts the correct municipal department.
          </p>
        </div>
      </section>

      {/* Main Grid Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 pb-16 space-y-12">
        
        {/* Core Reporting Input section */}
        <ReportForm 
          onReportSubmit={handleAddNewReport} 
          reports={reports}
          onIncrementUpvote={handleIncrementUpvoteDirectly} 
        />

        {/* Stats segment */}
        <section className="grid grid-cols-3 gap-3 md:gap-4 max-w-2xl mx-auto">
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Reports Active</span>
            <span className="font-display font-extrabold text-2xl text-slate-800 block mt-1">{totalReportCount}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
            <span className="text-[10px] font-bold text-orange-500 uppercase block tracking-wider">Urgent Action</span>
            <span className="font-display font-extrabold text-2xl text-orange-600 block mt-1">{criticalCount}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
            <span className="text-[10px] font-bold text-emerald-500 uppercase block tracking-wider">Resolved</span>
            <span className="font-display font-extrabold text-2xl text-emerald-600 block mt-1">{resolvedCount}</span>
          </div>
        </section>

        {/* Global Feed Section start */}

        {/* Community Feed block */}
        <section className="space-y-6">
          <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-extrabold text-xl text-slate-800 flex items-center gap-2">
                <Compass className="h-5 w-5 text-indigo-600" />
                Community Activity Feed
              </h2>
              <p className="text-xs text-slate-500">Live feed of citizen reports diagnosed across coordinates</p>
            </div>

            {/* Sorting mechanism */}
            <div className="flex items-center gap-2 bg-white border border-slate-150 p-1.5 rounded-xl text-xs shadow-sm self-start md:self-auto">
              <button
                onClick={() => setSortBy("newest")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  sortBy === "newest" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Chronological
              </button>
              <button
                onClick={() => setSortBy("popular")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1 ${
                  sortBy === "popular" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Most Upvoted
              </button>
            </div>
          </div>

          {/* View Segmented Toggle (Feed vs Map vs Admin vs Insights) */}
          <div className="flex bg-slate-100 p-1 rounded-xl max-w-2xl mx-auto border border-slate-200 shadow-inner flex-wrap gap-1 sm:gap-0">
            <button
              onClick={() => setViewMode("feed")}
              className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-[10px] sm:text-xs transition duration-200 flex items-center justify-center gap-1 sm:gap-1.5 min-w-[75px] ${
                viewMode === "feed"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-550 hover:text-slate-800"
              }`}
              id="toggle_feed_view_btn"
            >
              <Layers className="h-3.5 w-3.5" />
              Feed View
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-[10px] sm:text-xs transition duration-200 flex items-center justify-center gap-1 sm:gap-1.5 min-w-[75px] ${
                viewMode === "map"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-550 hover:text-slate-800"
              }`}
              id="toggle_map_view_btn"
            >
              <Map className="h-3.5 w-3.5" />
              Map View
            </button>
            <button
              onClick={() => setViewMode("admin")}
              className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-[10px] sm:text-xs transition duration-200 flex items-center justify-center gap-1 sm:gap-1.5 min-w-[100px] ${
                viewMode === "admin"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-550 hover:text-slate-800"
              }`}
              id="toggle_admin_view_btn"
            >
              <Shield className="h-3.5 w-3.5" />
              Admin Dashboard
            </button>
            <button
              onClick={() => setViewMode("insights")}
              className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-[10px] sm:text-xs transition duration-200 flex items-center justify-center gap-1 sm:gap-1.5 min-w-[105px] ${
                viewMode === "insights"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-550 hover:text-slate-800"
              }`}
              id="toggle_insights_view_btn"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Hotspot Insights
            </button>
          </div>

          {/* Filtering Drawer - only visible when not in Admin or Insights views to keep consoles clean */}
          {viewMode !== "admin" && viewMode !== "insights" && (
            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs border-b border-slate-50 pb-2">
              <ListFilter className="h-4 w-4 text-indigo-600" />
              Filter Records By Custom Category
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Category selector */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Issue Type</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-slate-50 text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Severity Selector */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Severity Level</label>
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  className="w-full bg-slate-50 text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  {severities.map(sev => (
                    <option key={sev} value={sev}>{sev === "All" ? "All Levels" : sev}</option>
                  ))}
                </select>
              </div>

              {/* Department Option */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Assigned Department</label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full bg-slate-50 text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept === "All" ? "All Bureaus" : `Dept of ${dept}`}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Keyword search bar */}
            <div className="relative pt-2">
              <div className="absolute inset-y-0 left-0 pl-3 pt-2 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search description details, bureaus, categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700"
              />
            </div>
          </div>
          )}

          {/* Feed Content, Map Content, Admin Content, or Hotspot Insights depending on viewMode state */}
          {viewMode === "map" ? (
            <MapView reports={filteredReports} />
          ) : viewMode === "admin" ? (
            <AdminDashboard reports={reports} onUpdateStatus={handleUpdateStatus} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {/* Left Column: Feed content OR Hotspot Insights */}
              <div className="lg:col-span-2 space-y-6">
                {viewMode === "insights" ? (
                  <HotspotInsights reports={reports} />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnimatePresence>
                {sortedReports.length > 0 ? (
                  sortedReports.map((report) => (
                    <motion.div
                      key={report.id}
                      layoutId={report.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="bg-white rounded-2xl border border-slate-150 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col group justify-between"
                    >
                      
                      {/* Upper content part */}
                      <div>
                        {/* Image/Video Frame */}
                        <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
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
                              src={report.photo}
                              alt={report.category}
                              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                            />
                          )}
                          
                          {/* Status absolute badge */}
                          <span className={`absolute top-3 left-3 text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm text-white ${
                            report.status === "Resolved" 
                              ? "bg-emerald-600" 
                              : report.status === "In Progress" 
                                ? "bg-indigo-600" 
                                : "bg-slate-700/90 backdrop-blur-sm"
                          }`}>
                            {report.status}
                          </span>

                          {/* Severity code absolute */}
                          <span className={`absolute top-3 right-3 text-[10.5px] font-bold border px-2.5 py-0.5 rounded-full shadow-sm backdrop-blur p-1.5 ${getSeverityBadgeColor(report.severity)}`}>
                            {report.severity}
                          </span>
                        </div>

                        {/* Details block */}
                        <div className="p-5 space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="font-display font-extrabold text-base text-slate-850">
                                  {report.category}
                                </h3>
                                {myReportIds.includes(report.id) && (
                                  <span className={`text-[9.5px] font-black tracking-tight px-2 py-0.5 rounded-full border shadow-xs flex items-center gap-1 ${getUserTier(userPoints).color}`}>
                                    <span>{getUserTier(userPoints).badge}</span>
                                    <span>Your Report</span>
                                  </span>
                                )}
                                {report.escalated && (
                                  <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-md animate-pulse">
                                    ⚠️ Escalated
                                  </span>
                                )}
                                {report.communityResolved && report.status !== "Resolved" && (
                                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                                    <CheckCircle className="h-3 w-3 text-emerald-600 inline" />
                                    Community Resolved
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                                <Calendar className="h-3 w-3" />
                                {report.timestamp}
                              </span>
                            </div>

                            <div className="text-[10.5px] font-sans font-bold text-indigo-700 bg-indigo-50 border border-indigo-100/50 px-2.5 py-1 rounded-lg">
                              Dept: {report.department}
                            </div>
                          </div>

                          <p className="text-slate-600 text-xs leading-relaxed font-sans line-clamp-3 text-left">
                            "{report.description}"
                          </p>

                          {/* Escalation Warning note */}
                          {report.escalated && report.escalationNote && (
                            <div className="bg-rose-550 bg-rose-50 border border-rose-100 rounded-xl p-3 text-left">
                              <span className="text-[9px] uppercase font-black text-rose-700 tracking-wider block mb-1">Official SLA Escalation Warning</span>
                              <p className="text-[11px] text-rose-800 italic leading-relaxed">
                                "{report.escalationNote}"
                              </p>
                            </div>
                          )}

                          {/* Triage Progress Timeline */}
                          <div className="pt-3 border-t border-slate-100">
                            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-2 text-left">Triage Timeline</span>
                            <div className="grid grid-cols-4 gap-1 relative">
                              {stages.map((stage, idx) => {
                                const ts = getStageTimestamp(report.history, stage);
                                const isReached = !!ts || (
                                  stage === "Reported" ||
                                  (stage === "Acknowledged" && (report.status === "Acknowledged" || report.status === "In Progress" || report.status === "Resolved")) ||
                                  (stage === "In Progress" && (report.status === "In Progress" || report.status === "Resolved")) ||
                                  (stage === "Resolved" && report.status === "Resolved")
                                );
                                const displayTime = ts || (isReached ? (stage === "Reported" ? report.timestamp : "Active") : "");

                                return (
                                  <div key={stage} className="flex flex-col items-center relative text-center">
                                    <div className={`h-5 w-5 rounded-full flex items-center justify-center border-2 z-10 transition ${
                                      isReached 
                                        ? "bg-indigo-600 border-indigo-150 text-white shadow-xs" 
                                        : "bg-white border-slate-200 text-slate-300"
                                    }`}>
                                      <span className="text-[8px] font-bold">{idx + 1}</span>
                                    </div>
                                    <span className={`text-[9px] font-bold mt-1.5 transition ${isReached ? "text-slate-700" : "text-slate-400"}`}>
                                      {stage}
                                    </span>
                                    {displayTime && (
                                      <span className="text-[8px] text-slate-400 font-mono scale-90 whitespace-nowrap mt-0.5">
                                        {displayTime}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Bottom Metadata row */}
                      <div className="border-t border-slate-55 py-3 px-5 bg-slate-50/50 flex items-center justify-between text-xs">
                        
                        {/* Geo display */}
                        <div className="flex items-center gap-1 text-[10.5px] font-mono text-slate-550">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          {report.lat && report.lng ? (
                            <span>{report.lat.toFixed(4)}, {report.lng.toFixed(4)}</span>
                          ) : (
                            <span>Location General</span>
                          )}
                        </div>

                        {/* Toggle active validation and resolution actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* I see this too button */}
                          <button
                            onClick={(e) => handleToggleActiveConfirm(report.id, e)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition duration-155 sm:px-3 sm:gap-1.5 ${
                              report.hasConfirmedActive
                                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                            }`}
                          >
                            <ThumbsUp className={`h-3.5 w-3.5 ${report.hasConfirmedActive ? "fill-indigo-600 text-indigo-600" : "text-slate-400"}`} />
                            {report.hasConfirmedActive && <span className="text-xs" title={`Your stamp: ${getUserTier(userPoints).name}`}>{getUserTier(userPoints).badge}</span>}
                            <span>Active ({report.activeConfirms || 0})</span>
                          </button>

                          {/* This is resolved button */}
                          <button
                            disabled={report.status === "Resolved"}
                            onClick={(e) => handleToggleResolvedConfirm(report.id, e)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition duration-155 sm:px-3 sm:gap-1.5 disabled:opacity-50 ${
                              report.status === "Resolved"
                                ? "bg-emerald-50 border-emerald-150 text-emerald-700 cursor-default"
                                : report.hasConfirmedResolved
                                  ? "bg-rose-50 border-rose-200 text-rose-700"
                                  : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                            }`}
                          >
                            <CheckCircle className={`h-3.5 w-3.5 ${report.status === "Resolved" ? "text-emerald-600 fill-emerald-100" : report.hasConfirmedResolved ? "fill-rose-100 text-rose-600" : "text-slate-400"}`} />
                            {report.hasConfirmedResolved && <span className="text-xs" title={`Your stamp: ${getUserTier(userPoints).name}`}>{getUserTier(userPoints).badge}</span>}
                            <span>Resolved ({report.resolvedConfirms || 0})</span>
                          </button>
                        </div>

                      </div>

                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-1 md:col-span-2 py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white p-6 space-y-3">
                    <div className="inline-flex p-3 bg-slate-50 text-slate-400 rounded-full mx-auto">
                      <Layers className="h-6 w-6" />
                    </div>
                    <h4 className="font-semibold text-slate-700 text-sm">No Reports Found</h4>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      No active civic issue matches your selection filter options. Try adjusting categories, departments or keyword searches.
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}
              </div>

              {/* Right Column: Gamification Leaderboard & SLA Warnings Panel */}
              <div className="space-y-6 lg:sticky lg:top-24">
                <Leaderboard entries={leaderboard} userPoints={userPoints} deviceId={currentUid} />
                
                {/* Compact SLA Escalation Log */}
                <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden">
                  <div className="flex flex-col gap-3 relative z-10">
                    <div className="flex items-center gap-2">
                       <div className="bg-rose-50 p-2 rounded-lg border border-rose-100 text-rose-600">
                         <AlertOctagon className="h-4.5 w-4.5 animate-pulse" />
                       </div>
                       <div className="text-left">
                         <h3 className="font-display font-bold text-xs text-slate-800 flex items-center gap-1.5">
                           SLA Warnings
                           <span className="bg-rose-100 text-rose-700 text-[9px] px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                             <span className="h-1 w-1 bg-rose-600 rounded-full inline-block animate-pulse"></span>
                             Live
                           </span>
                         </h3>
                         <p className="text-[10px] text-slate-500">Escalated action notifications on warning thresholds</p>
                       </div>
                     </div>

                     {/* SLA Violation Debugger (Only shows if URL has ?debug=true) */}
                     {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "true" && (
                       <button
                         onClick={handleCreateBackdatedReport}
                         className="w-full justify-center bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10.5px] px-3 py-1.5 rounded-xl transition duration-150 flex items-center gap-1 shadow-sm font-sans"
                         id="trigger_backdated_sla_btn"
                       >
                         <AlertTriangle className="h-3 w-3" />
                         Inject Backdated Issue (25h)
                       </button>
                     )}
                   </div>

                   <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1 relative z-10 font-sans">
                     {reports.filter(r => r.escalated && r.status !== "Resolved").length > 0 ? (
                       [...reports].filter(r => r.escalated && r.status !== "Resolved").sort((a, b) => {
                         const timeA = a.escalatedAt ? new Date(a.escalatedAt).getTime() : 0;
                         const timeB = b.escalatedAt ? new Date(b.escalatedAt).getTime() : 0;
                         return timeB - timeA;
                       }).map(report => (
                         <div key={`log-${report.id}`} className="bg-rose-50/45 border border-rose-100 rounded-xl p-3 flex items-start gap-2.5 transition hover:bg-rose-50">
                           <div className="bg-white text-rose-600 font-extrabold text-[9px] py-0.5 px-1.5 rounded border border-rose-150 shadow-xs whitespace-nowrap text-center shrink-0">
                             {report.severity}
                           </div>
                           <div className="flex-1 min-w-0 space-y-0.5 text-left">
                             <div className="flex items-center justify-between gap-1 flex-wrap">
                               <span className="font-bold text-xs text-slate-850 truncate">{report.category} Ticket</span>
                               <span className="text-[10px] text-slate-400 font-medium">{report.department}</span>
                             </div>
                             <p className="text-[11px] text-rose-800 italic leading-snug">
                               "{report.escalationNote}"
                             </p>
                           </div>
                         </div>
                       ))
                     ) : (
                       <div className="text-center py-5 text-slate-400 border border-dashed border-slate-100 rounded-xl bg-slate-50/20">
                         <CheckCircle className="h-4.5 w-4.5 text-emerald-500 mx-auto mb-1.5" />
                         <p className="text-[10.5px] font-semibold text-slate-600">All Systems Normal</p>
                         <p className="text-[9px] text-slate-400">All registered reports are within respective resolution frames.</p>
                       </div>
                     )}
                   </div>
                 </section>
              </div>
            </div>
          )}
        </section>

      </main>

      {/* Footer information section */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-4 border-t border-slate-800 text-center">
        <div className="max-w-5xl mx-auto space-y-4">
          <span className="font-display font-black tracking-tight text-white text-sm">
            COMMUNITY<span className="text-indigo-400">HERO</span>
          </span>
          <p className="text-slate-500 text-[11px] max-w-sm mx-auto leading-relaxed">
            Community Hero uses state-of-the-art Gemini 2.5 AI flash triage. All calculations and mappings are stored locally via Secure Storage. Always respect local privacy.
          </p>
          <div className="text-[10px] text-slate-600">
            © 2026 Community Hero Inc. Empowering local neighborhoods with machine intelligence.
          </div>
        </div>
      </footer>

    </div>
  );
}
