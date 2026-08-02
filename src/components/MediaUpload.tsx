import React, { useState, useRef } from 'react';
import { Upload, AlertTriangle, X, Loader, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '../lib/ToastContext';

interface MediaUploadProps {
  /**
   * Called with the AI's insight plus a gallery-sized copy of the photo
   * (JPEG data URL, ~640px longest side) so callers can save it to the
   * family's photo album instead of discarding it after analysis.
   */
  onMediaAnalyzed: (
    insight: { description: string; emotion: string; suggestions: string[]; caption?: string },
    photoDataUrl?: string
  ) => void;
  disabled?: boolean;
  isPremium?: boolean;
  /** Button label — defaults to "Media". */
  label?: string;
  /**
   * Show the server's actual reason when analysis fails.
   *
   * On by default nowhere: this component sits in the patient's chat as well
   * as the caregiver's album, and "models/gemini-3.5-pro is not found for API
   * version v1beta" put in front of someone with dementia is frightening
   * noise about a thing they cannot act on. The caregiver, who is the only
   * person who can fix a misconfigured model, gets the sentence instead.
   */
  showTechnicalErrors?: boolean;
}

// Downscale an already-loaded data URL to a small gallery thumbnail. Falls
// back to the original if canvas work fails (e.g. decode error) — better a
// bigger photo in the album than none.
const GALLERY_MAX_DIMENSION = 640;
const GALLERY_JPEG_QUALITY = 0.7;
function makeGalleryPhoto(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const largestSide = Math.max(image.naturalWidth || 1, image.naturalHeight || 1);
        const scale = Math.min(1, GALLERY_MAX_DIMENSION / largestSide);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
        canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', GALLERY_JPEG_QUALITY));
      } catch {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

export const MediaUpload: React.FC<MediaUploadProps> = ({ onMediaAnalyzed, disabled = false, isPremium = true, label = 'Media', showTechnicalErrors = false }) => {
  const { error: toastError } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_UPLOAD_DIMENSION = 1600;
  const JPEG_QUALITY = 0.78;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      const msg = 'File too large (max 10MB)';
      setError(msg);
      toastError('File Too Large', msg);
      return;
    }

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'].includes(file.type)) {
      const msg = 'Unsupported file type. Use JPEG, PNG, GIF, MP4, or WebM';
      setError(msg);
      toastError('Invalid File Type', msg);
      return;
    }

    setError('');
    setFileName(file.name);

    // Create preview
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setPreview(dataUrl);

      // If video, extract first frame
      if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.onloadedmetadata = () => {
          const largestSide = Math.max(video.videoWidth || 1, video.videoHeight || 1);
          const scale = Math.min(1, MAX_UPLOAD_DIMENSION / largestSide);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
          canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            analyzeMedia(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
          }
        };
        video.src = dataUrl;
      } else {
        const image = new Image();
        image.onload = () => {
          const largestSide = Math.max(image.naturalWidth || 1, image.naturalHeight || 1);
          const scale = Math.min(1, MAX_UPLOAD_DIMENSION / largestSide);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
          canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            analyzeMedia(dataUrl);
            return;
          }
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          analyzeMedia(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        };
        image.onerror = () => analyzeMedia(dataUrl);
        image.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
  };

  const analyzeMedia = async (base64Data: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('yadira_token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/analyze-media', {
        method: 'POST',
        headers,
        body: JSON.stringify({ media: base64Data, mediaType: 'image' }),
      });

      if (!response.ok) {
        let serverError = `Analysis failed (${response.status})`;
        try {
          const errBody = await response.json();
          if (typeof errBody?.error === 'string' && errBody.error.length > 0) {
            serverError = errBody.error;
          }
        } catch {
          // Ignore non-JSON error bodies.
        }
        throw new Error(serverError);
      }

      const insight = await response.json();
      const photoDataUrl = await makeGalleryPhoto(base64Data);
      onMediaAnalyzed(insight, photoDataUrl);
      clearPreview();
    } catch (err) {
      // "Could not analyze media" is the same sentence whether the photo was
      // corrupt, the key was missing, or the configured model does not exist —
      // and only one of those is worth retrying. So the caregiver gets what
      // the server actually said. The patient gets a calm sentence about a
      // photo, because the technical one names something they cannot act on.
      const reason = err instanceof Error ? err.message : 'Unknown error';
      const shown = showTechnicalErrors
        ? reason
        : "That photo didn't come through just now. It's nothing you did — try again in a moment.";
      setError(shown);
      toastError(
        showTechnicalErrors ? 'Photo analysis failed' : "Couldn't look at that photo",
        shown,
        { label: 'Retry', onClick: () => analyzeMedia(base64Data) }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (!isPremium) {
              toastError('Premium Feature', 'Photo sharing and analysis is gated behind Yadira Premium. Unlock Premium in the Caregiver Hub.');
              return;
            }
            fileInputRef.current?.click();
          }}
          disabled={disabled || isLoading}
          className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-all ${
            !isPremium
              ? 'bg-[#A6A27B] hover:bg-[#8F8B68] hover:scale-[1.01]'
              : 'bg-green-500 hover:bg-green-600 active:scale-[0.98]'
          } disabled:opacity-50`}
        >
          {isLoading ? <Loader size={20} className="animate-spin" /> : (!isPremium ? <Lock size={18} /> : <Upload size={20} />)}
          {label}
        </button>

        {isLoading && <span className="text-sm text-gray-500">Analyzing...</span>}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {preview && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-lg overflow-hidden bg-gray-100 p-2"
        >
          <button
            onClick={clearPreview}
            className="absolute top-2 right-2 p-1 bg-white rounded-full shadow hover:bg-gray-100"
          >
            <X size={16} />
          </button>
          <img src={preview} alt="Preview" className="w-full h-auto max-h-64 rounded" />
          <p className="text-xs text-gray-500 mt-2 truncate">{fileName}</p>
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-red-50 rounded-lg border border-red-200 flex items-start gap-2"
        >
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-900">{error}</p>
        </motion.div>
      )}
    </div>
  );
};
