import { useRef, useState } from "react";
import { identifyIngredient, type VisionResult } from "../services/api";
import { Link } from "react-router-dom";

interface CameraCaptureProps {
  onIngredientIdentified?: (result: VisionResult) => void;
}

export default function CameraCapture({ onIngredientIdentified }: CameraCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const resetState = () => {
    setPreview(null);
    setResult(null);
    setError(null);
    stopCamera();
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleToggle = () => {
    if (showPanel) {
      resetState();
      setShowPanel(false);
    } else {
      setShowPanel(true);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    await sendImage(file);
  };

  const openCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraActive(true);
      // Wait for ref to be attached after render
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch {
      setError("Could not access camera. Please use file upload instead.");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    stopCamera();
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      setPreview(URL.createObjectURL(blob));
      await sendImage(file);
    }, "image/jpeg");
  };

  const sendImage = async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await identifyIngredient(file);
      setResult(res);
      onIngredientIdentified?.(res);
    } catch {
      setError("Failed to identify ingredient. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onClick={handleToggle} style={cameraBtnStyle} title="Identify ingredient from photo">
        {showPanel ? "\u2715" : "\uD83D\uDCF7"}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {showPanel && (
        <div style={panelStyle}>
          {!preview && !cameraActive && (
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <button onClick={openCamera} style={actionBtn}>
                Use Camera
              </button>
              <button onClick={() => fileInputRef.current?.click()} style={actionBtn}>
                Upload Photo
              </button>
            </div>
          )}

          {cameraActive && (
            <div>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", borderRadius: "8px", maxHeight: "200px", objectFit: "cover" }}
              />
              <button onClick={capturePhoto} style={{ ...actionBtn, marginTop: "0.5rem", width: "100%" }}>
                Capture
              </button>
            </div>
          )}

          {preview && (
            <img
              src={preview}
              alt="Preview"
              style={{ width: "100%", borderRadius: "8px", maxHeight: "150px", objectFit: "cover", marginBottom: "0.5rem" }}
            />
          )}

          {loading && <div style={{ color: "#888", fontSize: "0.85rem" }}>Identifying ingredient...</div>}

          {error && <div style={{ color: "#d00", fontSize: "0.85rem" }}>{error}</div>}

          {result && result.ingredient && (
            <div style={resultStyle}>
              <div style={{ fontWeight: "bold", fontSize: "1rem" }}>
                {result.ingredient}
                {result.ingredient_hi && (
                  <span style={{ color: "#888", marginLeft: "0.4rem" }}>{result.ingredient_hi}</span>
                )}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#888" }}>
                Confidence: {Math.round(result.confidence * 100)}%
              </div>
              {result.matching_recipes.length > 0 && (
                <div style={{ marginTop: "0.4rem" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: "bold" }}>Matching recipes:</div>
                  {result.matching_recipes.map((r) => (
                    <Link
                      key={r.id}
                      to={`/recipes/${r.id}`}
                      style={{ display: "block", fontSize: "0.85rem", color: "#e85d04", textDecoration: "none" }}
                    >
                      {r.name}
                    </Link>
                  ))}
                </div>
              )}
              <button
                onClick={resetState}
                style={{ ...actionBtn, marginTop: "0.5rem", width: "100%", fontSize: "0.8rem" }}
              >
                Scan Another
              </button>
            </div>
          )}

          {result && !result.ingredient && (
            <div style={{ color: "#888", fontSize: "0.85rem" }}>
              Could not identify an ingredient. Try a clearer photo.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const cameraBtnStyle: React.CSSProperties = {
  padding: "0.7rem",
  background: "#f0f0f0",
  border: "1px solid #ccc",
  borderRadius: "8px",
  fontSize: "1.1rem",
  cursor: "pointer",
  lineHeight: 1,
};

const panelStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "calc(100% + 8px)",
  right: 0,
  width: "280px",
  background: "white",
  border: "1px solid #ddd",
  borderRadius: "10px",
  padding: "0.8rem",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  zIndex: 100,
};

const actionBtn: React.CSSProperties = {
  flex: 1,
  padding: "0.5rem",
  background: "#e85d04",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.85rem",
};

const resultStyle: React.CSSProperties = {
  padding: "0.5rem",
  background: "#f9f9f9",
  borderRadius: "6px",
};
