'use client';

const COLORS = [
  '#fb7185', '#fb923c', '#f59e0b', '#10b981',
  '#14b8a6', '#0ea5e9', '#6366f1', '#8b5cf6', '#f472b6',
];

function colorFromName(name: string) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const SIZE_CLASSES = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-20 h-20 text-2xl',
};

type Props = {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
};

export default function PlayerAvatar({ name, avatarUrl, size = 'sm', className = '' }: Props) {
  const sizeClass = SIZE_CLASSES[size];

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover shrink-0 border border-black/40 ${className}`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${className}`}
      style={{ backgroundColor: colorFromName(name) }}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
