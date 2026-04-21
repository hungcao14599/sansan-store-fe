import { getAccentColor, getInitials } from '../lib/utils';

export function ProductAvatar({
  seed,
  label,
  className = '',
}: {
  seed: string;
  label: string;
  className?: string;
}) {
  const [background, foreground] = getAccentColor(seed);

  return (
    <div
      className={`flex items-center justify-center rounded-md border border-white/80 text-xs font-semibold shadow-sm ${className}`}
      style={{ backgroundColor: background, color: foreground }}
      aria-hidden="true"
    >
      {getInitials(label) || label.slice(0, 2).toUpperCase()}
    </div>
  );
}
