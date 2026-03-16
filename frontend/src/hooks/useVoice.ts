import { useCallback, useRef, useState } from "react";
import { sendVoice } from "../services/api";

export interface UseVoiceOptions {
  sessionId: number | null;
  language: string;
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
  onError?: (error: string) => void;
}

export interface UseVoiceReturn {
  startRecording: () => void;
  stopRecording: () => void;
  isRecording: boolean;
  isProcessing: boolean;
}

export function useVoice(options: UseVoiceOptions): UseVoiceReturn {
  const { sessionId, language, onTranscript, onResponse, onError } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    if (isProcessing || !sessionId) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        // Stop mic
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        if (blob.size < 1000) {
          onError?.("Recording too short. Hold the mic button and speak.");
          return;
        }

        // Send to REST endpoint
        setIsProcessing(true);
        try {
          const result = await sendVoice(sessionId, blob, language);
          if (result.transcript) {
            onTranscript?.(result.transcript);
          }
          if (result.reply) {
            onResponse?.(result.reply);
          }
        } catch (err) {
          console.error("Voice request failed:", err);
          onError?.("Voice processing failed. Try typing instead.");
        } finally {
          setIsProcessing(false);
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access failed:", err);
      onError?.("Could not access microphone. Please allow mic permission.");
    }
  }, [sessionId, language, isProcessing, onTranscript, onResponse, onError]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setIsRecording(false);
  }, []);

  return {
    startRecording,
    stopRecording,
    isRecording,
    isProcessing,
  };
}
