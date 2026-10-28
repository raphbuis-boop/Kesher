/** Small inline spinner for buttons while an action runs. */
export function Spinner({ size = 12, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={`inline-block shrink-0 animate-spin rounded-full border-[1.5px] border-current border-r-transparent opacity-80 motion-reduce:animate-[spin_1.5s_linear_infinite] ${className}`}
    />
  );
}
