import { type CSSProperties } from "react";
import { useVoice } from "../hooks/useVoice.ts";

interface VoiceButtonProps {
  sessionId: number | null;
  language?: string;
  compact?: boolean;
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
  onError?: (error: string) => void;
}

export default function VoiceButton({
  sessionId,
  language = "hi",
  compact = false,
  onTranscript,
  onResponse,
  onError,
}: VoiceButtonProps) {
  const voice = useVoice({ sessionId, language, onTranscript, onResponse, onError });

  const handlePointerDown = () => {
    if (voice.isProcessing) return;
    voice.startRecording();
  };

  const handlePointerUp = () => {
    if (voice.isRecording) {
      voice.stopRecording();
    }
  };

  const size = compact ? 40 : 56;
  let btnStyle: CSSProperties;
  let label: string;

  if (voice.isRecording) {
    btnStyle = { ...baseBtn, ...recordingBtn, width: size, height: size };
    label = "Release to send...";
  } else if (voice.isProcessing) {
    btnStyle = { ...baseBtn, ...processingBtn, width: size, height: size };
    label = "Processing...";
  } else {
    btnStyle = { ...baseBtn, ...idleBtn, width: size, height: size };
    label = "Hold to speak";
  }

  if (compact) {
    return (
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        disabled={voice.isProcessing || !sessionId}
        style={btnStyle}
        aria-label={label}
        title={label}
      >
        <span style={{ fontSize: "1rem" }}>
          {voice.isRecording ? "\u{1F534}" : voice.isProcessing ? "\u23F3" : "\u{1F3A4}"}
        </span>
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        disabled={voice.isProcessing || !sessionId}
        style={btnStyle}
        aria-label={label}
      >
        <span style={{ fontSize: "1.5rem" }}>
          {voice.isRecording ? "\u{1F534}" : voice.isProcessing ? "\u23F3" : "\u{1F3A4}"}
        </span>
      </button>
      <span style={{ fontSize: "0.7rem", color: voice.isRecording ? "#dc2626" : "#888", fontWeight: voice.isRecording ? 600 : 400 }}>
        {label}
      </span>
    </div>
  );
}

const baseBtn: CSSProperties = {
  borderRadius: "50%",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "transform 0.15s, box-shadow 0.15s",
  flexShrink: 0,
};

const idleBtn: CSSProperties = {
  background: "#e85d04",
  boxShadow: "0 4px 14px rgba(232, 93, 4, 0.35)",
};

const recordingBtn: CSSProperties = {
  background: "#dc2626",
  boxShadow: "0 0 0 6px rgba(220, 38, 38, 0.25)",
  transform: "scale(1.15)",
};

const processingBtn: CSSProperties = {
  background: "#9ca3af",
  cursor: "wait",
};
