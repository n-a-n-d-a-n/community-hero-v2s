import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Camera, 
  MapPin, 
  Loader2, 
  UploadCloud, 
  Sparkles, 
  X, 
  Zap, 
  Trash2, 
  Droplet, 
  Building,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  TrafficCone,
  RefreshCw,
  Users
} from "lucide-react";
import { CivicReport, ClassificationResponse } from "../types";

interface ReportFormProps {
  onReportSubmit: (report: Omit<CivicReport, "id" | "status" | "timestamp" | "upvotes" | "createdAt" | "history" | "escalated" | "escalationNote" | "escalatedAt">) => void;
  reports: CivicReport[];
  onIncrementUpvote: (reportId: string) => void;
}

// Haversine distance in meters
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of Earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Convert first frame of video into a compressed high-quality JPEG cover image
const extractVideoThumbnail = (videoFile: File): Promise<string> => {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.autoplay = false;
    video.muted = true;
    video.playsInline = true;
    
    const fileUrl = URL.createObjectURL(videoFile);
    video.src = fileUrl;
    
    // Safety timeout to resolve even if metadata loading hangs
    const timeoutId = setTimeout(() => {
      resolve("");
    }, 2500);
    
    video.onloadeddata = () => {
      video.currentTime = 0.1; // Seek slightly forward to avoid blank black frames
    };
    
    video.onseeked = () => {
      try {
        clearTimeout(timeoutId);
        const canvas = document.createElement("canvas");
        const maxDim = 800; // Maximum visual resolution for thumbnails
        let w = video.videoWidth || 640;
        let h = video.videoHeight || 360;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const thumbnailUrl = canvas.toDataURL("image/jpeg", 0.75); // Highly compressed, beautiful Jpeg
          resolve(thumbnailUrl);
        } else {
          resolve("");
        }
      } catch (e) {
        resolve("");
      } finally {
        URL.revokeObjectURL(fileUrl);
      }
    };
    
    video.onerror = () => {
      clearTimeout(timeoutId);
      resolve("");
      URL.revokeObjectURL(fileUrl);
    };
  });
};

const mapCategoryToDepartment = (cat: string): string => {
  switch (cat) {
    case "Pothole":
    case "Signage":
      return "Roads";
    case "Garbage":
      return "Sanitation";
    case "Streetlight":
      return "Electricity";
    case "Waterlogging":
      return "Water";
    default:
      return "Municipal General";
  }
};

export default function ReportForm({ onReportSubmit, reports, onIncrementUpvote }: ReportFormProps) {
  // State variables for report drafting
  const [image, setImage] = useState<string | null>(null); // Base64 string without prefix
  const [mimeType, setMimeType] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string | null>(null); // Data URL for preview
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  
  // Geolocation states
  const [geoStatus, setGeoStatus] = useState<"idle" | "acquiring" | "success" | "failed">("idle");
  const [geoErrorMsg, setGeoErrorMsg] = useState<string>("");

  // AI Classification states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [classifiedData, setClassifiedData] = useState<ClassificationResponse | null>(null);

  // Editable fields states (allows correcting AI or filling in manually)
  const [editCategory, setEditCategory] = useState<string>("");
  const [editSeverity, setEditSeverity] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editDepartment, setEditDepartment] = useState<string>("");

  // Deduplication states
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [duplicateDetected, setDuplicateDetected] = useState<{ report: CivicReport, reasoning: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // Staggered loading messages to make the AI analyzer feel responsive and elegant
  const loadingSteps = [
    "Uploading raw pixels to processing server...",
    "Running Gemini 2.5 Multimodal classification...",
    "Segmenting damaged structures and waste patterns...",
    "Triage engine calculating severity and mapping optimal state agency...",
    "Finalizing response payload structure..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzing) {
      setAnalysisStep(0);
      interval = setInterval(() => {
        setAnalysisStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev));
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // Handle auto-capturing coordinates on component mount
  useEffect(() => {
    acquireLocation();
  }, []);

  const acquireLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus("failed");
      setGeoErrorMsg("Geolocation is not supported by your browser");
      setLat(37.7749);
      setLng(-122.4194);
      return;
    }

    setGeoStatus("acquiring");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        setGeoStatus("success");
      },
      (err) => {
        console.log("High accuracy geolocation timed out/failed. Attempting cached low-accuracy location query...");
        
        navigator.geolocation.getCurrentPosition(
          (lowResPos) => {
            setLat(lowResPos.coords.latitude);
            setLng(lowResPos.coords.longitude);
            setGeoStatus("success");
          },
          (lowResErr) => {
            console.log("Low accuracy geolocation fallback timed out/failed. Using default community center coordinates.", { code: lowResErr.code, message: lowResErr.message });
            setGeoStatus("failed");
            setGeoErrorMsg(
              lowResErr.code === 1 ? "Location access denied. Please allow GPS permission." : "GPS acquisition timed out"
            );
            // Default robust fallback values
            setLat(37.7749);
            setLng(-122.4194);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
        );
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  // Convert File to base64 and compress/resize images using HTML5 Canvas
  const handleFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      alert("Invalid file: Please upload an image or video file.");
      return;
    }

    setMimeType(file.type);
    setOriginalFile(file);
    
    // For video files, enforce a 15 MB limit to enable high-quality video submissions
    if (file.type.startsWith("video/")) {
      if (file.size > 15 * 1024 * 1024) { // 15 MB limit
        alert("Video file size is too large. Please select an optimized video under 15 MB.");
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setImagePreview(dataUrl);
        const base64Data = dataUrl.split(",")[1];
        setImage(base64Data);
        if (geoStatus !== "success") {
          acquireLocation();
        }
      };
      reader.onerror = () => {
        alert("Could not load video. Please try a different photo or short video clip.");
      };
      reader.readAsDataURL(file);
      return;
    }

    // For image files, perform Canvas-based image resizing and compression
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      
      img.onload = () => {
        // Target dimensions: limit max side to 1024px to reduce memory & file size significantly
        const MAX_DIMENSION = 1024;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Export as JPEG with a balanced quality of 0.7 for high visual detail and light file footprint (~100KB)
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
          setImagePreview(compressedDataUrl);
          
          const base64Data = compressedDataUrl.split(",")[1];
          setImage(base64Data);
          setMimeType("image/jpeg"); // Update mimeType to match the compressed JPEG output format
        } else {
          // Direct fallback if 2D context is unavailable
          setImagePreview(dataUrl);
          setImage(dataUrl.split(",")[1]);
        }

        if (geoStatus !== "success") {
          acquireLocation();
        }
      };

      img.onerror = () => {
        // Direct fallback if loading the image fails
        setImagePreview(dataUrl);
        setImage(dataUrl.split(",")[1]);
        if (geoStatus !== "success") {
          acquireLocation();
        }
      };

      img.src = dataUrl;
    };

    reader.onerror = () => {
      alert("Could not load image. Please try a different photo.");
    };

    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const removeSelectedImage = () => {
    setImage(null);
    setImagePreview(null);
    setOriginalFile(null);
    setMimeType("");
    setClassifiedData(null);
    setAnalysisError(null);
    setDuplicateDetected(null);
  };

  const startAITriage = async () => {
    if (!image || !mimeType) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setClassifiedData(null);
    setDuplicateDetected(null);

    try {
      const requestPayload: { mimeType: string; image?: string; video?: string } = { mimeType };
      if (mimeType.startsWith("video/")) {
        requestPayload.video = image;
      } else {
        requestPayload.image = image;
      }

      const response = await fetch("/api/classify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status code ${response.status}`);
      }

      const data = await response.json();
      setClassifiedData(data.result);
      if (data.result) {
        setEditCategory(data.result.category || "");
        setEditSeverity(data.result.severity || "Medium");
        setEditDescription(data.result.description || "");
        setEditDepartment(data.result.department || "");
      }
    } catch (err: any) {
      console.error(err);
      setAnalysisError("AI analysis temporarily unavailable");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const confirmAndSubmit = async () => {
    if (!classifiedData || !imagePreview) return;

    // Check existing reports within 100 meters, and specifically within 50 meters
    if (lat !== undefined && lng !== undefined && reports && reports.length > 0) {
      setIsCheckingDuplicates(true);
      try {
        const candidates = reports.filter(r => {
          if (r.lat === undefined || r.lng === undefined) return false;
          // Haversine formula within 100 meters
          const distance = getHaversineDistance(lat, lng, r.lat, r.lng);
          return distance <= 100;
        });

        // "If a same-category report exists within 50 meters, send both descriptions to Gemini"
        const duplicateCandidate = candidates.find(r => {
          if (r.lat === undefined || r.lng === undefined) return false;
          if (r.category !== editCategory) return false;
          const distance = getHaversineDistance(lat, lng, r.lat, r.lng);
          return distance <= 50;
        });

        if (duplicateCandidate) {
          // Send both descriptions to Gemini to confirm duplicate status
          const response = await fetch("/api/deduplicate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              newDescription: editDescription,
              existingDescription: duplicateCandidate.description,
              category: editCategory
            })
          });

          if (response.ok) {
            const data = await response.json();
            if (data.result && data.result.is_duplicate) {
              setDuplicateDetected({
                report: duplicateCandidate,
                reasoning: data.result.reasoning || "Duplicate issue matching nearby active ticket."
              });
              
              // Increment upvote count
              onIncrementUpvote(duplicateCandidate.id);
              setIsCheckingDuplicates(false);
              return; // Stop report creation flow
            }
          }
        }
      } catch (err: any) {
        console.warn("Deduplication logic failed or timed out: continuing direct submission:", err);
      } finally {
        setIsCheckingDuplicates(false);
      }
    }

    // Normal report creation path if no duplicates confirmed
    let finalPhoto = imagePreview || "";
    
    // If it's a video file, extract a lightweight preview cover frame to guarantee Firestore synchronization within the 1MB limits
    if (mimeType.startsWith("video/") && originalFile) {
      try {
        const thumbnail = await extractVideoThumbnail(originalFile);
        if (thumbnail) {
          finalPhoto = thumbnail;
        }
      } catch (err) {
        console.warn("Could not extract video thumbnail cover frame:", err);
      }
    }

    onReportSubmit({
      photo: finalPhoto,
      lat: lat ?? 37.7749,
      lng: lng ?? -122.4194,
      category: editCategory,
      severity: editSeverity,
      description: editDescription,
      department: editDepartment,
    });

    // Reset components states
    removeSelectedImage();
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "Critical":
        return {
          bg: "bg-red-50 text-red-700 border-red-200",
          accentColor: "bg-red-600",
          iconColor: "text-red-500",
          label: "Critical Danger"
        };
      case "High":
        return {
          bg: "bg-orange-50 text-orange-700 border-orange-200",
          accentColor: "bg-orange-500",
          iconColor: "text-orange-500",
          label: "High Urgency"
        };
      case "Medium":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200",
          accentColor: "bg-amber-500",
          iconColor: "text-amber-500",
          label: "Medium Issue"
        };
      default:
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          accentColor: "bg-emerald-500",
          iconColor: "text-emerald-500",
          label: "Low Severity"
        };
    }
  };

  const getDeptIcon = (dept: string) => {
    switch (dept) {
      case "Roads":
        return <TrafficCone className="h-5 w-5" />;
      case "Sanitation":
        return <Trash2 className="h-5 w-5" />;
      case "Electricity":
        return <Zap className="h-5 w-5" fill="currentColor" />;
      case "Water":
        return <Droplet className="h-5 w-5" fill="currentColor" />;
      default:
        return <Building className="h-5 w-5" />;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto" id="report_form_container">
      {/* Container Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-6 overflow-hidden">
        
        {/* Step Header */}
        <div className="mb-6 flex items-center justify-between border-b border-slate-50 pb-4">
          <div>
            <h3 className="font-display font-semibold text-lg text-slate-800 flex items-center gap-2">
              <Camera className="h-5 w-5 text-indigo-600" />
              File a New Report
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Upload a clear photo to auto-diagnose and route it using Gemini AI
            </p>
          </div>
          
          {/* GPS status tracking */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full text-slate-600">
            <MapPin className={`h-3 w-3 ${geoStatus === "acquiring" ? "animate-bounce text-indigo-500" : geoStatus === "success" ? "text-emerald-500" : "text-amber-500"}`} />
            <span className="text-[10px] font-mono font-semibold">
              {geoStatus === "acquiring" && "Acquiring Coordinates..."}
              {geoStatus === "success" && `${lat?.toFixed(4)}, ${lng?.toFixed(4)}`}
              {geoStatus === "failed" && "Coordinates Offline"}
            </span>
            {geoStatus === "failed" && (
              <button 
                onClick={acquireLocation}
                className="p-0.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                title="Retry GPS search"
              >
                <RefreshCw className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          
          {/* STATE 1: UPLOAD ZONE (If no image uploaded yet) */}
          {!imagePreview && (
            <motion.div
              key="uploader"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative group border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[220px] ${
                  isDragActive
                    ? "border-indigo-500 bg-indigo-50/50 scale-[1.01]"
                    : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50"
                }`}
                id="file_drop_zone"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,video/*"
                  className="hidden"
                />

                <div className="p-3.5 bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 rounded-2xl mb-4 transition-colors duration-200">
                  <UploadCloud className="h-6 w-6 stroke-[2.5]" />
                </div>

                <p className="font-medium text-slate-700 text-sm mb-1">
                  Drag and drop your photo or custom video clip here
                </p>
                <p className="text-xs text-slate-400 group-hover:text-indigo-400 transition-colors">
                  or search documents to upload image / video (Max 15MB)
                </p>

                {/* Info Pills */}
                <div className="mt-5 flex flex-wrap justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition duration-200">
                  <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-medium">Potholes</span>
                  <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-medium">Illegal Waste</span>
                  <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-medium">Streetlight Fault</span>
                  <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-medium">Waterlogging</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* STATE 2: IMAGE PREVIEWED & WAITING ANALYSIS OR READY */}
          {imagePreview && !classifiedData && !isAnalyzing && (
            <motion.div
              key="image_viewer"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-4"
            >
              <div className="relative rounded-xl border border-slate-100 bg-slate-50 p-2 overflow-hidden aspect-video max-h-[300px] flex items-center justify-center">
                {mimeType.startsWith("video/") ? (
                  <video
                    src={imagePreview}
                    controls
                    className="h-full w-auto object-contain rounded-lg max-h-[280px]"
                  />
                ) : (
                  <img
                    src={imagePreview}
                    alt="Civic Issue Preview"
                    className="h-full w-auto object-contain rounded-lg"
                  />
                )}
                
                <button
                  type="button"
                  onClick={removeSelectedImage}
                  className="absolute top-4 right-4 bg-slate-900/70 hover:bg-slate-900 text-white p-1.5 rounded-full transition"
                  title="Remove Image"
                  id="trash_image_p"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {geoStatus === "failed" && (
                <div className="space-y-3 p-3.5 rounded-lg bg-amber-50/70 text-amber-900 border border-amber-200/50 text-xs text-left">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <span className="font-semibold block">GPS Location Acquisition Offline</span>
                      We couldn't locate your physical device ({geoErrorMsg || "Access Restricted"}). Feel free to manually customize coordinates below or pick a preset location.
                    </div>
                  </div>
                  
                  <div className="border-t border-amber-200/40 pt-2.5 mt-2 space-y-2">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest block">Manual Location Coordination</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-medium text-amber-850 block mb-0.5">Latitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={lat !== undefined ? lat : ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? undefined : parseFloat(e.target.value);
                            setLat(val);
                            if (val !== undefined && lng !== undefined) setGeoStatus("success");
                          }}
                          placeholder="Latitude (e.g. 37.7749)"
                          className="w-full bg-white border border-amber-200/80 text-slate-800 rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-medium text-amber-850 block mb-0.5">Longitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={lng !== undefined ? lng : ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? undefined : parseFloat(e.target.value);
                            setLng(val);
                            if (val !== undefined && lat !== undefined) setGeoStatus("success");
                          }}
                          placeholder="Longitude (e.g. -122.4194)"
                          className="w-full bg-white border border-amber-200/80 text-slate-800 rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLat(37.7749);
                          setLng(-122.4194);
                          setGeoStatus("success");
                        }}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-2.5 py-1 rounded text-[10px] font-medium transition"
                      >
                        📍 San Francisco (Default)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLat(47.6062);
                          setLng(-122.3321);
                          setGeoStatus("success");
                        }}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-2.5 py-1 rounded text-[10px] font-medium transition"
                      >
                        📍 Seattle Civic
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLat(40.7128);
                          setLng(-74.0060);
                          setGeoStatus("success");
                        }}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-2.5 py-1 rounded text-[10px] font-medium transition"
                      >
                        📍 NYC Center
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={removeSelectedImage}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition text-sm flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                  Discard Photo
                </button>
                <button
                  type="button"
                  onClick={startAITriage}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md hover:shadow-indigo-100 transition text-sm flex items-center justify-center gap-2 font-display"
                  id="submit_ai_triage"
                >
                  <Sparkles className="h-4 w-4" />
                  Analyze with Gemini AI
                </button>
              </div>
            </motion.div>
          )}

          {/* STATE 3: GEMINI INTERACTIVE WAITING / ANALYZING SCREEN */}
          {isAnalyzing && (
            <motion.div
              key="analyzing_screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 px-4 flex flex-col items-center justify-center text-center space-y-4"
            >
              <div className="relative">
                <div className="p-5 bg-indigo-50 text-indigo-600 rounded-full animate-pulse">
                  <Sparkles className="h-10 w-10 animate-spin text-indigo-500" style={{ animationDuration: "3s" }} />
                </div>
                <div className="absolute inset-0 border-2 border-indigo-200 rounded-full animate-ping opacity-25"></div>
              </div>

              <div className="space-y-1.5 max-w-sm">
                <h4 className="font-display font-semibold text-slate-800 text-sm">
                  Gemini Triage Model Active
                </h4>
                
                {/* Dynamically steps through the loading items */}
                <div className="h-10 flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={analysisStep}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="text-xs text-indigo-600 font-medium font-sans px-2"
                    >
                      {loadingSteps[analysisStep]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
              
              <div className="w-48 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${((analysisStep + 1) / loadingSteps.length) * 100}%` }}
                ></div>
              </div>
            </motion.div>
          )}

          {/* STATE 3.5: DEDUPLICATION CHECKING LOADER */}
          {isCheckingDuplicates && (
            <motion.div
              key="deduplication_checking_loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 px-4 flex flex-col items-center justify-center text-center space-y-4"
            >
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
              <div className="space-y-1">
                <h4 className="font-display font-bold text-slate-800 text-sm">Checking Duplication Status...</h4>
                <p className="text-xs text-slate-400">Verifying and comparing descriptions against adjacent reports with Gemini AI</p>
              </div>
            </motion.div>
          )}

          {/* STATE 3.6: DUPLICATE DETECTED CONFIRMATION SCREEN */}
          {duplicateDetected && (
            <motion.div
              key="duplicate_detected_screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-5 text-left"
            >
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-4">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs">
                  <Users className="h-4.5 w-4.5" />
                  Nearby Match Identified
                </div>

                <div className="bg-white p-5 rounded-lg text-center border border-indigo-100/50 shadow-sm">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Current Issue Support</span>
                  <span className="text-2xl font-display font-black text-indigo-600 block mt-1">
                    {duplicateDetected.report.upvotes} people nearby reported this issue
                  </span>
                  <p className="text-[11.5px] text-slate-500 mt-2 leading-relaxed">
                    A highly match-correlated <strong>{duplicateDetected.report.category}</strong> report exists within 50 meters of your coordinates. We've automatically counted your submission as an upvote to escalate attention.
                  </p>
                </div>

                <div className="bg-white/80 border border-slate-100 rounded-lg p-3 text-xs space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Gemini Reasoning:</span>
                  <p className="text-slate-700 font-medium italic">"{duplicateDetected.reasoning}"</p>
                </div>
              </div>

              <button
                type="button"
                onClick={removeSelectedImage}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold font-display rounded-xl text-xs transition duration-200 shadow-md"
              >
                Acknowledge & Finish
              </button>
            </motion.div>
          )}

          {/* ERROR STATUS DURING ANALYZING */}
          {analysisError && (
            <motion.div
              key="analysis_error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-5 bg-red-50 border border-red-100 rounded-xl space-y-4 text-left"
            >
              <div className="flex gap-3">
                <AlertOctagon className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-800 text-sm">Gemini Neural Connection Failed</h4>
                  <p className="text-xs text-red-700/80 mt-1">
                    {analysisError}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={removeSelectedImage}
                  className="px-4 py-1.5 bg-white border border-red-200 text-red-700 hover:bg-red-100/50 transition rounded-lg text-xs font-semibold"
                >
                  Start Over
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const fallbackData = {
                      category: "Other",
                      severity: "Medium",
                      description: "",
                      department: "Municipal General",
                      confidence: null
                    };
                    setClassifiedData(fallbackData as any);
                    setEditCategory("Other");
                    setEditSeverity("Medium");
                    setEditDescription("");
                    setEditDepartment("Municipal General");
                    setAnalysisError(null);
                  }}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white transition rounded-lg text-xs font-semibold"
                >
                  Skip AI & Enter Details
                </button>
                <button
                  type="button"
                  onClick={startAITriage}
                  className="px-4 py-1.5 bg-red-600 text-white hover:bg-red-700 transition rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry Connection
                </button>
              </div>
            </motion.div>
          )}

          {/* STATE 4: GEMINI CONFIRMATION CARD DIALOG */}
          {classifiedData && !duplicateDetected && !isCheckingDuplicates && (
            <motion.div
              key="confirmation_card"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-5"
            >
              {/* Main classification card */}
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 space-y-4 text-left">
                
                {/* AI diagnosis header badge */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                    <Sparkles className="h-3.5 w-3.5 animate-pulse text-indigo-500" />
                    {classifiedData.confidence != null ? "Gemini AI Real-time Diagnosis" : "Manual Civic Report Setup"}
                  </span>
                  {classifiedData.confidence != null && (
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-medium">Confidence Level</span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {(classifiedData.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                  
                  {/* Photo / Video overview */}
                  <div className="sm:col-span-2 relative rounded-lg border border-slate-200 aspect-video sm:aspect-square overflow-hidden bg-slate-900 flex items-center justify-center">
                    {mimeType.startsWith("video/") ? (
                      <video
                        src={imagePreview!}
                        controls
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <img
                        src={imagePreview!}
                        alt="Uploaded Civil Fault"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>

                  {/* Diagnosed details list */}
                  <div className="sm:col-span-3 space-y-3.5 mr-auto text-left w-full">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Identified Civic Issue</label>
                        <select
                          className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2 text-xs py-1.5 font-semibold focus:border-indigo-500 focus:outline-none"
                          value={editCategory}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditCategory(val);
                            setEditDepartment(mapCategoryToDepartment(val));
                          }}
                        >
                          <option value="Pothole">🚧 Pothole Repair</option>
                          <option value="Garbage">🧹 Garbage & Litter</option>
                          <option value="Streetlight">💡 Streetlight Issue</option>
                          <option value="Waterlogging">🌧️ Waterlogging / Flood</option>
                          <option value="Signage">🛑 Signage Damage</option>
                          <option value="Other">❓ Other Civil Issue</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Issue Severity</label>
                        <select
                          className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2 text-xs py-1.5 font-semibold focus:border-indigo-500 focus:outline-none"
                          value={editSeverity}
                          onChange={(e) => setEditSeverity(e.target.value)}
                        >
                          <option value="Low">🟢 Low Severity</option>
                          <option value="Medium">🟡 Medium Issue</option>
                          <option value="High">🟠 High Urgency</option>
                          <option value="Critical">🔴 Critical Danger</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Factual Description</label>
                      <textarea
                        className="w-full bg-white border border-slate-200 text-slate-700 text-xs font-sans rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none leading-relaxed resize-none"
                        rows={2}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Describe the physical public hazard so municipal workers can find it..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Assigned Bureau</label>
                        <select
                          className="w-full bg-white border border-slate-200 text-slate-850 rounded-lg px-2 text-xs py-1.5 focus:border-indigo-500 focus:outline-none font-medium"
                          value={editDepartment}
                          onChange={(e) => setEditDepartment(e.target.value)}
                        >
                          <option value="Roads">🚧 Roads Department</option>
                          <option value="Sanitation">🧹 Sanitation Bureau</option>
                          <option value="Electricity">💡 Electricity & Power</option>
                          <option value="Water">🌧️ Water/SLA Division</option>
                          <option value="Municipal General">🏛️ Municipal General Bureau</option>
                        </select>
                      </div>

                      {lat && lng && (
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Lock Position</span>
                          <div className="flex items-center gap-1.5 text-slate-500 font-mono text-xs mt-1 bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-2">
                            <MapPin className="h-3.5 w-3.5 text-indigo-500" />
                            {lat.toFixed(4)}, {lng.toFixed(4)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Board */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={removeSelectedImage}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition text-sm flex items-center justify-center gap-1.5"
                >
                  <X className="h-4 w-4" />
                  Discard & Retry
                </button>
                <button
                  type="button"
                  onClick={confirmAndSubmit}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md inline-flex items-center justify-center gap-1 text-sm font-display"
                  id="confirm_submit_report"
                >
                  <CheckCircle className="h-4 w-4" />
                  Confirm & Submit Issue
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
