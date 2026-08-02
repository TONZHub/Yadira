import React from 'react';

interface EmotionBadgeProps {
  emotion?: string;
  confidence?: number;
  /** 'voice' was heard in the delivery — pace, tremor, breath, crying.
      'text' was inferred from the wording, which reads a flat "I'm fine" and
      a bright one identically. The distinction is shown rather than hidden:
      a caregiver deciding whether to walk down the hall deserves to know
      which of the two they are looking at. */
  source?: 'voice' | 'text';
  /** The model's phrase for how it sounded, e.g. "quiet and a little shaky".
      Surfaced as a tooltip — it is often worth more than the label. */
  tone?: string;
}

const emotionConfig: Record<string, { emoji: string; color: string; textColor: string }> = {
  happy: { emoji: '😊', color: 'bg-yellow-100', textColor: 'text-yellow-800' },
  sad: { emoji: '😢', color: 'bg-blue-100', textColor: 'text-blue-800' },
  anxious: { emoji: '😰', color: 'bg-orange-100', textColor: 'text-orange-800' },
  confused: { emoji: '😕', color: 'bg-purple-100', textColor: 'text-purple-800' },
  peaceful: { emoji: '😌', color: 'bg-green-100', textColor: 'text-green-800' },
  angry: { emoji: '😠', color: 'bg-red-100', textColor: 'text-red-800' },
  excited: { emoji: '🤩', color: 'bg-pink-100', textColor: 'text-pink-800' },
  neutral: { emoji: '😐', color: 'bg-gray-100', textColor: 'text-gray-800' },
};

export const EmotionBadge: React.FC<EmotionBadgeProps> = ({ emotion, confidence = 1, source, tone }) => {
  if (!emotion || !(emotion in emotionConfig)) return null;

  const config = emotionConfig[emotion];
  const heard = source === 'voice';
  // Read aloud by screen readers, and hovered by everyone else. "Heard" and
  // "read from their words" are different claims and are worded as such —
  // neither is presented as a measurement.
  const label = heard
    ? `Heard in their voice: ${emotion}${tone ? ` — ${tone}` : ''}`
    : `Read from their words: ${emotion}`;

  return (
    <div
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${config.color} ${config.textColor} text-xs font-medium`}
    >
      <span aria-hidden="true">{config.emoji}</span>
      <span className="capitalize">{emotion}</span>
      {heard && (
        <span className="opacity-70" aria-hidden="true" title={label}>
          · heard
        </span>
      )}
      {confidence && <span className="ml-1 opacity-70">({Math.round(confidence * 100)}%)</span>}
    </div>
  );
};
