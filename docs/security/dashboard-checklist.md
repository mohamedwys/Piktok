# Supabase Dashboard Security Checklist

Phase 6 leaves three items for manual execution in the Supabase Web
Dashboard. Run before the next EAS production build.

## 1. Enable Bot & Abuse Protection (hCaptcha)

Dashboard → Authentication → Settings → Bot and Abuse Protection
  - Enable hCaptcha (free tier is sufficient for v1).
  - Copy the site key — Phase 8 wires it into the register screen.

## 2. Raise Password Minimum

Dashboard → Authentication → Policies → Password Strength
  - Minimum length: 10
  - Required characters: lowercase letter, digit
  - (Optional) Reject leaked passwords

## 3. Verify Redirect URL Allowlist

Dashboard → Authentication → URL Configuration → Additional Redirect URLs
  - client://auth/callback        (mobile email confirmation)
  - https://mony-psi.vercel.app/auth/callback
  - https://mony.app/auth/callback        (when production domain lands)

Remove any other entries that don't match these three patterns.

## 4. (Optional) Enable Email Rate Limit

Dashboard → Authentication → Rate Limits → Emails per hour
  - Default 3/hour is too restrictive for active testing; 30/hour is
    typical for early-stage production.

## 5. (Required for EAS Build) Lockfile clean

Outside the dashboard but reminded here per the project's standing
carry-forward note:

    rm package-lock.json
    rm -rf node_modules
    npm install --legacy-peer-deps=false

Global ~/.npmrc has legacy-peer-deps=true, which corrupts the lockfile
in a way that breaks EAS `npm ci`.
