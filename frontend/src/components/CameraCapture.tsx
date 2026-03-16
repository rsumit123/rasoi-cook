import { useRef, useState } from "react";
import { askAboutPhoto } from "../services/api";

interface CameraCaptureProps {
  sessionId: number | null;
  language: string;
  onPhotoSent?: (question: string, photoUrl: string) => void;
  onReply?: (reply: string) => void;
  onError?: (error: string) => void;
}

export default function CameraCapture({
  sessionId,
  language,
  onPhotoSent,
  onReply,
  onError,
}: CameraCaptureProps) {
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setQuestion("");
  };

  const handleSend = async () => {
    if (!capturedFile || !question.trim() || !sessionId || loading) return;

    const q = question.trim();
    const url = previewUrl || "";
    onPhotoSent?.(q, url);

    setLoading(true);
    setCapturedFile(null);
    setPreviewUrl(null);
    setQuestion("");

    try {
      const result = await askAboutPhoto(capturedFile, q, sessionId, language);
      onReply?.(result.reply);
    } catch {
      onError?.("Couldn't analyze the photo. Try again or type your question.");
    } finally {
      setLoading(false);
      // Reset file input so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCancel = () => {
    setCapturedFile(null);
    setPreviewUrl(null);
    setQuestion("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleCapture}
      />

      {/* Camera button (when no photo captured) */}
      {!capturedFile && (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          style={{
            padding: "0.5rem",
            background: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: "50%",
            fontSize: "1.1rem",
            cursor: "pointer",
            lineHeight: 1,
            flexShrink: 0,
            width: "38px",
            height: "38px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Take a photo and ask about it"
        >
          {loading ? "\u23F3" : "\uD83D\uDCF7"}
        </button>
      )}

      {/* Photo preview + question input (when photo captured) */}
      {capturedFile && previewUrl && (
        <div
          style={{
            position: "fixed",
            bottom: "4.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            width: "calc(100% - 1.5rem)",
            maxWidth: "620px",
            background: "white",
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "0.7rem",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.12)",
            zIndex: 200,
          }}
        >
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
            <img
              src={previewUrl}
              alt="Captured"
              style={{
                width: "70px",
                height: "70px",
                borderRadius: "8px",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                placeholder="Ask about this photo..."
                autoFocus
                style={{
                  width: "100%",
                  padding: "0.5rem 0.7rem",
                  fontSize: "0.88rem",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem" }}>
                <button onClick={handleCancel} style={cancelBtn}>
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={!question.trim()}
                  style={{
                    ...sendPhotoBtn,
                    opacity: question.trim() ? 1 : 0.5,
                  }}
                >
                  Ask Rasoi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const cancelBtn: React.CSSProperties = {
  padding: "0.35rem 0.7rem",
  background: "#f0f0f0",
  border: "none",
  borderRadius: "6px",
  fontSize: "0.8rem",
  cursor: "pointer",
  color: "#666",
};

const sendPhotoBtn: React.CSSProperties = {
  padding: "0.35rem 0.7rem",
  background: "#e85d04",
  color: "white",
  border: "none",
  borderRadius: "6px",
  fontSize: "0.8rem",
  cursor: "pointer",
  fontWeight: 600,
};
