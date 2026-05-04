/**
 * Web app integration constants.
 *
 * Single source of truth for the deployed Pro-upgrade web URL. Phase H
 * splits the client between this React Native app (the marketplace) and
 * a Next.js companion shipping the Pro subscription dashboard +
 * checkout. Until H.6 lands the web codebase + Vercel deploy, the
 * `WEB_BASE_URL` below is a placeholder pointing at a Vercel project
 * slug that will be created with H.6.
 *
 * If the Vercel deploy ends up at a different slug (e.g., the `mony`
 * project name is taken and Vercel assigns `mony-app.vercel.app`),
 * **edit only this constant** — every consumer in `useUpgradeFlow`,
 * the Edge Function's redirect resolution, and any future deep-link
 * surface reads from here. The matching Supabase secret
 * (`WEB_BASE_URL`, set by `supabase secrets set ...`) is the
 * server-side companion for the Edge Function and must be updated in
 * lockstep when this URL changes.
 *
 * Brand-name + final-domain decision: pending the user choice flagged
 * in PRO_AUDIT.md §10. The Vercel default URL works for v1 launch; a
 * custom domain (e.g., `pro.<brand>.com`) is a one-line edit here when
 * DNS is configured.
 */
export const WEB_BASE_URL = 'https://mony-psi.vercel.app';

/**
 * Path on the web app where the upgrade flow lives. Combined with
 * `WEB_BASE_URL` to produce the full redirect target the magic-link
 * lands on. The web codebase (H.6+) implements the
 * `app/(auth)/upgrade/page.tsx` route at this path.
 */
export const WEB_UPGRADE_PATH = '/upgrade';
