export interface HistoryEvent {
  status: string;
  timestamp: string;
  note: string;
}

export interface CivicReport {
  id: string;
  photo: string; // base64 or URL
  lat?: number;
  lng?: number;
  category: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  description: string;
  department: string;
  status: "Reported" | "Acknowledged" | "In Progress" | "Resolved";
  timestamp: string;
  upvotes: number;
  activeConfirms?: number; // "I see this too" counter
  resolvedConfirms?: number; // "This is resolved" citizen feedback counter
  hasConfirmedActive?: boolean; // Toggle helper for current user
  hasConfirmedResolved?: boolean; // Toggle helper for current user
  communityResolved?: boolean; // Flagged when 3+ citizens report resolved
  createdAt: string;
  history: HistoryEvent[];
  escalated?: boolean;
  escalationNote?: string;
  escalatedAt?: string;
}

export interface ClassificationResponse {
  category: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  description: string;
  department: string;
  confidence: number;
}

export const isVideoMedia = (urlOrBase64: string | undefined | null): boolean => {
  if (!urlOrBase64) return false;
  return urlOrBase64.startsWith("data:video/") || 
    urlOrBase64.includes(".mp4") || 
    urlOrBase64.includes(".webm") || 
    urlOrBase64.includes(".ogg") || 
    urlOrBase64.includes("video");
};
