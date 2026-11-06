// Tiny custom icon set (<= 12), 1.5px stroke, always paired with a text label.
const paths = {
  home: "M3 11l9-7 9 7M5 10v10h14V10",
  plus: "M12 5v14M5 12h14",
  folder: "M3 6h6l2 2h10v11H3z",
  list: "M4 6h16M4 12h16M4 18h16",
  chat: "M4 5h16v11H9l-5 4z",
  check: "M5 12l5 5 9-10",
  camera: "M4 8h4l2-3h4l2 3h4v11H4zM12 11a3 3 0 100 6 3 3 0 000-6z",
  alert: "M12 4l9 16H3zM12 10v4M12 17v.5",
  doc: "M6 3h9l4 4v14H6zM14 3v5h5",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
} as const;
export type IconName = keyof typeof paths;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={paths[name]} />
    </svg>
  );
}
