/**
 * Re-mounts on every navigation, so each page's content fades in (180ms,
 * disabled under prefers-reduced-motion via the global rule in globals.css).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in flex flex-1 flex-col min-w-0">{children}</div>;
}
