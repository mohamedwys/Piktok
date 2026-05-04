/**
 * Centered max-width content container — the marketing surface's
 * horizontal rhythm. Caps at 1152px (Tailwind `max-w-6xl`); padding
 * widens at lg breakpoint for desktop breathing room while staying
 * snug on phone widths.
 *
 * Composed inside Section (which handles vertical rhythm) for
 * symmetric inner / outer spacing across the landing.
 */
export function Container({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
