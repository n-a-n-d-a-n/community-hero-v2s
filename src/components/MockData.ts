import { CivicReport } from "../types";

export const STARTER_REPORTS: CivicReport[] = [
  {
    id: "rep_001",
    photo: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=600",
    lat: 37.7749,
    lng: -122.4194,
    category: "Pothole",
    severity: "High",
    description: "Deep, jagged pothole in the middle of the active right-hand lane forming a severe tire risk.",
    department: "Roads",
    status: "In Progress",
    timestamp: "2 hours ago",
    upvotes: 18,
    createdAt: "2026-06-22T01:40:00-07:00",
    history: [
      {
        status: "Reported",
        timestamp: "2 hours ago",
        note: "Auto-routed to Roads at 2 hours ago"
      },
      {
        status: "In Progress",
        timestamp: "1 hour ago",
        note: "Work crew dispatched to grade and fill potholes with asphalt patch."
      }
    ]
  },
  {
    id: "rep_002",
    photo: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=600",
    lat: 37.7833,
    lng: -122.4167,
    category: "Garbage",
    severity: "Medium",
    description: "Large bag of uncollected municipal trash leaking and overflowing onto the pedestrian walkway.",
    department: "Sanitation",
    status: "Reported",
    timestamp: "8 days ago",
    upvotes: 8,
    createdAt: "2026-06-14T03:40:00-07:00",
    history: [
      {
        status: "Reported",
        timestamp: "8 days ago",
        note: "Auto-routed to Sanitation at 8 days ago"
      }
    ]
  },
  {
    id: "rep_003",
    photo: "https://images.unsplash.com/photo-1509395062183-67c5ad6faff9?auto=format&fit=crop&q=80&w=600",
    lat: 37.7599,
    lng: -122.4368,
    category: "Streetlight",
    severity: "Low",
    description: "Broken electrical fixture head making the street hazardous and extremely pitch-black at night.",
    department: "Electricity",
    status: "Resolved",
    timestamp: "1 day ago",
    upvotes: 4,
    createdAt: "2026-06-21T03:40:00-07:00",
    history: [
      {
        status: "Reported",
        timestamp: "1 day ago",
        note: "Auto-routed to Electricity at 1 day ago"
      },
      {
        status: "Resolved",
        timestamp: "12 hours ago",
        note: "Faulty wiring head replaced and main junction fuse restored."
      }
    ]
  },
  {
    id: "rep_004",
    photo: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=600",
    lat: 37.7650,
    lng: -122.4200,
    category: "Water Main Leak",
    severity: "Critical",
    description: "High-pressure water spewing from cracked pavement, flooding adjacent sidewalk and basement.",
    department: "Water",
    status: "Reported",
    timestamp: "2 days ago",
    upvotes: 35,
    createdAt: "2026-06-20T03:40:00-07:00",
    history: [
      {
        status: "Reported",
        timestamp: "2 days ago",
        note: "Auto-routed to Water at 2 days ago"
      }
    ]
  }
];
