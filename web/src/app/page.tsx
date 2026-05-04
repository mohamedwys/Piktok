import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { Pricing } from '@/components/landing/Pricing';
import { FAQ } from '@/components/landing/FAQ';
import { Footer } from '@/components/landing/Footer';

/**
 * Mony public landing — Phase H.7.
 *
 * Replaces the H.6 "Coming soon" placeholder with the real
 * marketing surface. All composition; the section components
 * carry their own internal layout.
 *
 * Server Component — no client-side state at this level. The
 * Button primitive is the only place we cross into client
 * runtime (its forwardRef + interactive attributes hydrate); the
 * sections themselves stream as static HTML for fastest TTFB.
 *
 * Locale: French only for v1 (matches mobile's primary market).
 * EN internationalization is a follow-up (Phase F or H.X).
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <Header />
      <main>
        <Hero />
        <Features />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
