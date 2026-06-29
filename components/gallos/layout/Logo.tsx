export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display text-2xl leading-none tracking-wide ${className}`}
    >
      <span className="text-white">ANIMALS</span>
      <span className="text-gold"> DELUXE</span>
    </span>
  );
}
