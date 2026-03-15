import { useCallback, useEffect, useRef, useState } from "react";

export interface UseVoiceOptions {
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
}

export interface UseVoiceReturn {
  connect: (recipeId: number, language: string) => void;
  disconnect: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  isConnected: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  transcript: string;
  response: string;
}

export function useVoice(options: UseVoiceOptions = {}): UseVoiceReturn {
  const { onTranscript, onResponse } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const reconnectParamsRef = useRef<{ recipeId: number; language: string } | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable callback refs
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onResponseRef = useRef(onResponse);
  onResponseRef.current = onResponse;

  const cleanupWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(
    (recipeId: number, language: string) => {
      cleanupWs();
      reconnectParamsRef.current = { recipeId, language };

      const isProd = import.meta.env.PROD;
      const protocol = isProd ? "wss:" : (window.location.protocol === "https:" ? "wss:" : "ws:");
      const host = isProd ? "rasoi-api.skdev.one" : window.location.host;
      const wsUrl = `${protocol}//${host}/api/voice/stream`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        ws.send(
          JSON.stringify({
            type: "session_start",
            recipe_id: recipeId,
            language,
          })
        );
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string) as Record<string, unknown>;
          const msgType = data.type as string;

          if (msgType === "transcript") {
            const text = data.text as string;
            setTranscript(text);
            onTranscriptRef.current?.(text);
          } else if (msgType === "response") {
            const text = data.text as string;
            const audio = data.audio as string | undefined;
            setResponse(text);
            setIsProcessing(false);
            onResponseRef.current?.(text);

            // Play audio if present
            if (audio) {
              playBase64Audio(audio);
            }
          } else if (msgType === "error") {
            console.error("Voice WS error:", data.message);
            setIsProcessing(false);
          } else if (msgType === "session_ready") {
            // Session initialized
          }
        } catch (e) {
          console.error("Failed to parse WS message:", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt reconnection
        if (reconnectParamsRef.current) {
          const params = reconnectParamsRef.current;
          reconnectTimeoutRef.current = setTimeout(() => {
            if (reconnectParamsRef.current) {
              connect(params.recipeId, params.language);
            }
          }, 3000);
        }
      };

      ws.onerror = (err) => {
        console.error("Voice WS error event:", err);
      };

      wsRef.current = ws;
    },
    [cleanupWs]
  );

  const disconnect = useCallback(() => {
    reconnectParamsRef.current = null;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    cleanupWs();
    setIsConnected(false);
  }, [cleanupWs]);

  const startRecording = useCallback(async () => {
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

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        // Stop mic tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        // Send audio via WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          setIsProcessing(true);
          blob.arrayBuffer().then((buf) => {
            wsRef.current?.send(buf);
          });
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      reconnectParamsRef.current = null;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      cleanupWs();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cleanupWs]);

  return {
    connect,
    disconnect,
    startRecording,
    stopRecording,
    isConnected,
    isRecording,
    isProcessing,
    transcript,
    response,
  };
}

function playBase64Audio(base64Audio: string): void {
  try {
    const binaryStr = atob(base64Audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes.buffer], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play().catch((err) => console.error("Audio playback failed:", err));
  } catch (err) {
    console.error("Failed to play audio:", err);
  }
}
