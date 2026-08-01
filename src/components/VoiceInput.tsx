import React, { useState, useRef } from 'react';
import { Mic, MicOff, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '../lib/ToastContext';

interface VoiceInputProps {
  onTranscript: (text: string, emotion?: { emotion: string; confidence: number; tone: string }) => void;
  disabled?: boolean;
  isPremium?: boolean;
}

// Voice dictation — Whisper-grade with a graceful ladder.
// ------------------------------------------------------------------
// While recording, the browser's Web Speech API paints live captions so
// the patient sees their words appear as they talk. The actual audio is
// captured with MediaRecorder and sent to /api/transcribe (Whisper via
// OpenAI/Groq, or Gemini) for an accurate final transcript. If the server
// has no transcription provider, the live captions become the transcript —
// dictation never goes dark, it just gets less precise.

export const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscript, disabled = false, isPremium = true }) => {
  const { error: toastError } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStage, setAnalyzeStage] = useState<'transcribe' | 'emotion'>('transcribe');
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const [waveformLevel, setWaveformLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordStartedAtRef = useRef(0);
  const peakLevelRef = useRef(0);
  const audioChunksRef = useRef<Blob[]>([]);
  const recorderMimeRef = useRef('audio/webm');
  // Live-caption text mirrored in a ref so the async stop handler always
  // reads the freshest words, not a stale closure.
  const liveTranscriptRef = useRef('');

  const authHeaders = (): HeadersInit => {
    const token = localStorage.getItem('yadira_token');
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };

  // Web Speech = live captions while talking (best-effort; some browsers lack it)
  const initRecognition = () => {
    if (recognitionRef.current) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return; // server transcription carries dictation alone

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';
    recognition.onstart = () => {
      finalTranscript = '';
    };
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += text + ' ';
        else interim += text;
      }
      const full = (finalTranscript + interim).trim();
      liveTranscriptRef.current = full;
      setTranscript(full);
    };
    recognition.onerror = () => { /* captions are optional — audio still records */ };
    recognitionRef.current = recognition;
  };

  const startRecording = async () => {
    setError('');
    setTranscript('');
    liveTranscriptRef.current = '';

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      const msg = `Microphone access denied: ${err.message}`;
      setError(msg);
      toastError('Microphone Permission', 'Please allow microphone access to use voice input');
      return;
    }
    mediaStreamRef.current = stream;
    setIsRecording(true);

    // Live captions (best-effort)
    initRecognition();
    try { recognitionRef.current?.start(); } catch { /* already running */ }

    // The real recording, for Whisper-grade transcription
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      .find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || '';
    recorderMimeRef.current = (mime.split(';')[0]) || 'audio/webm';
    try {
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start();
      recordStartedAtRef.current = Date.now();
      peakLevelRef.current = 0;
      mediaRecorderRef.current = recorder;
    } catch {
      mediaRecorderRef.current = null; // captions-only mode
    }

    // Waveform visualization
    try {
      const audioContext = new (window as any).AudioContext();
      audioContextRef.current = audioContext;
      const analyzer = audioContext.createAnalyser();
      analyzerRef.current = analyzer;
      audioContext.createMediaStreamSource(stream).connect(analyzer);
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      dataArrayRef.current = dataArray;
      const updateWaveform = () => {
        if (analyzerRef.current && dataArrayRef.current && mediaStreamRef.current) {
          analyzerRef.current.getByteFrequencyData(dataArrayRef.current);
          const average = dataArrayRef.current.reduce((a, b) => a + b) / dataArrayRef.current.length;
          const level = average / 255;
          // The waveform already measures this; remembering the peak is what
          // tells us afterwards whether anybody actually spoke. Silence sent to
          // a transcription model comes back as confident invented text.
          if (level > peakLevelRef.current) peakLevelRef.current = level;
          setWaveformLevel(level);
          requestAnimationFrame(updateWaveform);
        }
      };
      updateWaveform();
    } catch { /* visualization is decorative */ }
  };

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const stopRecording = async () => {
    setIsRecording(false);
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }

    // Collect the recorded audio (recorder needs a beat to flush)
    const recorder = mediaRecorderRef.current;
    const recorded = await new Promise<Blob | null>((resolve) => {
      if (!recorder || recorder.state === 'inactive') return resolve(null);
      recorder.onstop = () =>
        resolve(audioChunksRef.current.length ? new Blob(audioChunksRef.current, { type: recorderMimeRef.current }) : null);
      try { recorder.stop(); } catch { resolve(null); }
    });
    mediaRecorderRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;

    setIsAnalyzing(true);
    setAnalyzeStage('transcribe');
    let finalText = liveTranscriptRef.current.trim();
    try {
      // Whisper-grade pass — server picks the best configured provider.
      //
      // The old floor here was 200 bytes, which a container header clears on
      // its own: a fumbled tap sent silence to the model and got invented words
      // back. Duration and peak level are sent too, so the server can refuse on
      // evidence rather than on file size alone.
      const durationMs = recordStartedAtRef.current ? Date.now() - recordStartedAtRef.current : undefined;
      const peakLevel = peakLevelRef.current;
      if (recorded && recorded.size > 1200) {
        const audio = await blobToBase64(recorded);
        const r = await fetch('/api/transcribe', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ audio, mimeType: recorderMimeRef.current, durationMs, peakLevel }),
        });
        if (r.ok) {
          const data = await r.json();
          if (typeof data.text === 'string' && data.text.trim()) {
            finalText = data.text.trim();
            setTranscript(finalText);
          }
        }
        // 501/502 → keep the live-caption text; dictation still works.
      }
    } catch { /* network hiccup — live captions carry it */ }

    if (!finalText) {
      setIsAnalyzing(false);
      setError('No speech captured. Try again, a little closer to the microphone.');
      return;
    }

    if (!isPremium) {
      setIsAnalyzing(false);
      onTranscript(finalText);
      setTranscript('');
      return;
    }

    setAnalyzeStage('emotion');
    try {
      const response = await fetch('/api/analyze-emotion', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ text: finalText }),
      });
      if (!response.ok) throw new Error(`Emotion analysis failed: ${response.statusText}`);
      const emotion = await response.json();
      onTranscript(finalText, emotion);
      setTranscript('');
    } catch (err) {
      const msg = `Emotion analysis error: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setError(msg);
      toastError('Emotion Analysis Failed', 'Could not analyze emotion. Sending message without emotion context.', {
        label: 'Send Anyway',
        onClick: () => onTranscript(finalText),
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {isRecording ? (
          <motion.button
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            onClick={stopRecording}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            <MicOff size={20} />
            Stop ({Math.round(waveformLevel * 100)}%)
          </motion.button>
        ) : (
          <button
            onClick={startRecording}
            disabled={disabled || isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            <Mic size={20} />
            Voice
          </button>
        )}

        {isAnalyzing && (
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }} className="text-sm text-gray-500">
            {analyzeStage === 'transcribe' ? 'Transcribing...' : 'Analyzing emotion...'}
          </motion.div>
        )}
      </div>

      {transcript && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900">{transcript}</p>
          {isRecording && <p className="text-xs text-blue-600 mt-1">🎤 Recording... (click Stop to send)</p>}
        </motion.div>
      )}

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-red-50 rounded-lg border border-red-200 flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-900">{error}</p>
        </motion.div>
      )}
    </div>
  );
};
