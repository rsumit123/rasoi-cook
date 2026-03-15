import { useEffect, type CSSProperties } from "react";
import { useVoice } from "../hooks/useVoice.ts";

interface VoiceButtonProps {
  recipeId: number;
  language?: string;
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
}

export default function VoiceButton({
  recipeId,
  language = "en",
  onTranscript,
  onResponse,
}: VoiceButtonProps) {
  const voice = useVoice({ onTranscript, onResponse });

  useEffect(() => {
    voice.connect(recipeId, language);
    return () => voice.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId, language]);

  const handlePointerDown = () => {
    if (!voice.isConnected || voice.isProcessing) return;
    voice.startRecording();
  };

  const handlePointerUp = () => {
    if (voice.isRecording) {
      voice.stopRecording();
    }
  };

  // Determine visual state
  let btnStyle: CSSProperties;
  let label: string;

  if (voice.isRecording) {
    btnStyle = { ...baseBtn, ...recordingBtn };
    label = "Recording...";
  } else if (voice.isProcessing) {
    btnStyle = { ...baseBtn, ...processingBtn };
    label = "Processing...";
  } else if (!voice.isConnected) {
    btnStyle = { ...baseBtn, ...disabledBtn };
    label = "Connecting...";
  } else {
    btnStyle = { ...baseBtn, ...idleBtn };
    label = "Hold to speak";
  }

  return (
    <div style={wrapper}>
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        disabled={!voice.isConnected || voice.isProcessing}
        style={btnStyle}
        aria-label={label}
      >
        <span style={iconStyle}>
          {voice.isRecording ? "\u{1F534}" : voice.isProcessing ? "\u23F3" : "\u{1F3A4}"}
        </span>
      </button>
      <span style={labelStyle}>{label}</span>
    </div>
  );
}

const wrapper: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.3rem",
  padding: "0.3rem 0",
};

const baseBtn: CSSProperties = {
  width: "52px",
  height: "52px",
  borderRadius: "50%",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "transform 0.15s, box-shadow 0.15s",
};

const idleBtn: CSSProperties = {
  background: "#e85d04",
  boxShadow: "0 2px 8px rgba(232, 93, 4, 0.3)",
};

const recordingBtn: CSSProperties = {
  background: "#dc2626",
  boxShadow: "0 0 0 4px rgba(220, 38, 38, 0.3)",
  transform: "scale(1.1)",
  animation: "pulse 1s infinite",
};

const processingBtn: CSSProperties = {
  background: "#9ca3af",
  cursor: "wait",
};

const disabledBtn: CSSProperties = {
  background: "#d1d5db",
  cursor: "not-allowed",
};

const iconStyle: CSSProperties = {
  fontSize: "1.3rem",
};

const labelStyle: CSSProperties = {
  fontSize: "0.7rem",
  color: "#888",
};
