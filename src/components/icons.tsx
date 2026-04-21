import type { SVGProps } from 'react';
import { cn } from '../lib/cn';

export type IconName =
  | 'search'
  | 'plus'
  | 'close'
  | 'trash'
  | 'more'
  | 'menu'
  | 'filter'
  | 'sliders'
  | 'image'
  | 'grid'
  | 'list'
  | 'bag'
  | 'undo'
  | 'refresh'
  | 'printer'
  | 'phone'
  | 'help'
  | 'lightning'
  | 'clock'
  | 'truck'
  | 'chart'
  | 'tag'
  | 'receipt'
  | 'bookmark'
  | 'star'
  | 'settings'
  | 'upload'
  | 'download'
  | 'calendar'
  | 'user'
  | 'logout'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'chevronsLeft'
  | 'chevronsRight'
  | 'arrowRight'
  | 'swapHorizontal'
  | 'check'
  | 'edit'
  | 'circle';

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  strokeWidth?: number;
};

export function Icon({ name, className, strokeWidth = 1.9, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-5 w-5 shrink-0', className)}
      aria-hidden="true"
      {...props}
    >
      {iconPaths[name]}
    </svg>
  );
}

const iconPaths: Record<IconName, JSX.Element> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="m9 7 1-2h4l1 2" />
      <path d="M7 7v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  more: (
    <>
      <circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6h16" />
      <path d="m7 6 5 6v6l2-1.2V12l5-6" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <circle cx="16" cy="7" r="2" />
      <path d="M4 17h4" />
      <path d="M12 17h8" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  image: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m20 16-4.5-4.5L8 19" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </>
  ),
  list: (
    <>
      <path d="M9 7h11M9 12h11M9 17h11" />
      <circle cx="5" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  bag: (
    <>
      <path d="M6 8h12l-1 11H7L6 8Z" />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" />
    </>
  ),
  undo: <path d="M9 7 4 12l5 5M20 7v5a5 5 0 0 1-5 5H4" />,
  refresh: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M6.5 9A7 7 0 0 1 18 7" />
      <path d="M17.5 15A7 7 0 0 1 6 17" />
    </>
  ),
  printer: (
    <>
      <path d="M7 9V5h10v4" />
      <rect x="6" y="14" width="12" height="5" rx="1" />
      <rect x="4" y="9" width="16" height="7" rx="2" />
    </>
  ),
  phone: (
    <>
      <path d="M5 4h4l1 4-2 1.5a14 14 0 0 0 6.5 6.5L16 14l4 1v4c0 .6-.4 1-1 1C10.7 20 4 13.3 4 5c0-.6.4-1 1-1Z" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.6 2.6 0 1 1 4.6 1.7c-.7.8-1.5 1.2-1.8 2.3" />
      <circle cx="12" cy="16.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  lightning: <path d="M13 2 6 13h5l-1 9 8-12h-5l0-8Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3 2" />
    </>
  ),
  truck: (
    <>
      <path d="M3 7h10v8H3z" />
      <path d="M13 10h4l3 3v2h-7z" />
      <circle cx="7" cy="18" r="1.7" />
      <circle cx="17" cy="18" r="1.7" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19h16" />
      <path d="M7 16V9" />
      <path d="M12 16V5" />
      <path d="M17 16v-7" />
    </>
  ),
  tag: (
    <>
      <path d="M11 4H5v6l8 8 6-6-8-8Z" />
      <circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  receipt: (
    <>
      <path d="M7 4h10v16l-2-1.5L13 20l-2-1.5L9 20l-2-1.5L5 20V4Z" />
      <path d="M9 9h6M9 13h6" />
    </>
  ),
  bookmark: <path d="M7 4h10v16l-5-3-5 3V4Z" />,
  star: <path d="m12 4 2.2 4.5 5 .7-3.6 3.5.9 4.9L12 15.3 7.5 17.6l.9-4.9L4.8 9.2l5-.7L12 4Z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="m19 12 1.4-2.1-1.8-3.1-2.5.2-1.4-1.8h-3.4L9.9 7 7.4 6.8 5.6 9.9 7 12l-1.4 2.1 1.8 3.1 2.5-.2 1.4 1.8h3.4l1.4-1.8 2.5.2 1.8-3.1L19 12Z" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V6" />
      <path d="m8 10 4-4 4 4" />
      <path d="M5 19h14" />
    </>
  ),
  download: (
    <>
      <path d="M12 5v10" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 19h14" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M8 4v4M16 4v4M4 10h16" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  logout: (
    <>
      <path d="M14 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
      <path d="M10 12h10" />
      <path d="m17 8 4 4-4 4" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronsLeft: (
    <>
      <path d="m17 6-6 6 6 6" />
      <path d="m11 6-6 6 6 6" />
    </>
  ),
  chevronsRight: (
    <>
      <path d="m7 6 6 6-6 6" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  arrowRight: <path d="M5 12h14m-5-5 5 5-5 5" />,
  swapHorizontal: (
    <>
      <path d="M6 8h10" />
      <path d="m13 5 3 3-3 3" />
      <path d="M18 16H8" />
      <path d="m11 13-3 3 3 3" />
    </>
  ),
  check: <path d="m5 12 4.2 4.2L19 6.5" />,
  edit: (
    <>
      <path d="m4 20 4.5-1 9.2-9.2-3.5-3.5L5 15.5 4 20Z" />
      <path d="m13.7 4.3 3.5 3.5" />
    </>
  ),
  circle: <circle cx="12" cy="12" r="8.5" />,
};
