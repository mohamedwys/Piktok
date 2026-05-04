/**
 * Vertical-rhythm section primitive — pairs with Container to give
 * landing-page blocks consistent breathing room. The 20/28
 * responsive py values match the BRAND.md "generous, never dense"
 * principle without becoming cavernous on small screens.
 *
 * Optional `id` lets header anchors scroll-link to specific
 * sections (#features, #pricing, #faq).
 */
export function Section({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`py-20 md:py-28 ${className}`}>
      {children}
    </section>
  );
}
