# Google Play — Data Safety Form Copy

Use this document when completing Play Console → App content → Data
safety for Mony. Each section maps to a question category in the form.

Last updated: pending v1.0.0 submission.

## Data collection and security

### Is all of the user data collected by your app encrypted in transit?
**Yes.** All Supabase API calls and Edge Functions are HTTPS-only.
Stripe checkout uses HTTPS. Apple StoreKit and Google Play Billing
traffic is encrypted by the platform.

### Do you provide a way for users to request that their data be deleted?
**Yes.** Users can delete their account in-app via Settings → Account
→ Delete Account. The action invokes the `delete_my_account` RPC which
cascades-deletes all rows owned by the user (listings, messages,
comments, follows, push tokens, subscriptions, IAP receipts).

## Data types collected

### Personal info
| Data type        | Collected | Shared | Required | Purpose            |
|------------------|-----------|--------|----------|--------------------|
| Name             | Yes       | No     | Yes      | Account management |
| Email address    | Yes       | No     | Yes      | Account management, customer support |
| User IDs         | Yes       | No     | Yes      | Account management, app functionality |
| Address          | Yes       | No     | No (only buy-now) | Order shipping |
| Phone number     | Yes       | No     | No (only buy-now) | Order shipping |

### Financial info
| Data type        | Collected | Shared | Required | Purpose            |
|------------------|-----------|--------|----------|--------------------|
| Purchase history | Yes       | No     | Yes (subscribers only) | Subscription management, order management |

Note: Payment card details are collected and processed exclusively by
Stripe, Apple, or Google. Mony's backend never sees raw card data.

### Location
| Data type            | Collected | Shared | Required | Purpose      |
|----------------------|-----------|--------|----------|--------------|
| Approximate location | Yes       | No     | No       | Nearby listings, distance-sorted feed |

Mony does NOT collect precise location.

### Photos and videos
| Data type | Collected | Shared | Required | Purpose            |
|-----------|-----------|--------|----------|--------------------|
| Photos    | Yes       | No     | No       | Listings, avatars  |
| Videos    | Yes       | No     | No       | Listings           |

### Messages
| Data type    | Collected | Shared | Required | Purpose         |
|--------------|-----------|--------|----------|-----------------|
| Other in-app messages | Yes | No | Yes (when used) | Buyer-seller chat |

### Audio
Not collected.

### App activity
| Data type        | Collected | Shared | Required | Purpose            |
|------------------|-----------|--------|----------|--------------------|
| App interactions | Yes       | No     | Yes      | App functionality (likes, follows, views) and feed personalization |
| Other user-generated content | Yes | No | Yes (when posted) | Marketplace listings, comments |

Mony does NOT collect in-app search history, web browsing history, or
installed apps.

### Web browsing
Not collected.

### App info and performance
Not collected (Sentry deferred to Phase 9).

### Device or other IDs
| Data type | Collected | Shared | Required | Purpose            |
|-----------|-----------|--------|----------|--------------------|
| Device or other IDs | Yes | Yes (Expo Push Service) | No (only if user opts into notifications) | Push notification delivery |

## Data sharing

Mony shares no user data with third parties beyond what is required for
the service to function:

- **Supabase Inc.** — hosting provider for database, storage, auth,
  realtime, and edge functions. Data processing agreement in place.
- **Stripe, Inc.** — payment processing for physical-goods checkout
  and web Pro subscription. Buyer name, email, shipping address, and
  phone number are passed at checkout for order fulfilment.
- **Apple Inc.** — payment processing for iOS Pro subscription (only
  purchase token transmitted; no personal data).
- **Google LLC** — payment processing for Android Pro subscription
  (only purchase token transmitted; no personal data).
- **Expo Push Service (650 Industries, Inc.)** — push notification
  delivery; only the device push token and the notification payload
  title/body are transmitted.

Mony does NOT share user data for:
- Advertising or marketing
- Analytics (none implemented in v1)
- Fraud prevention by third parties (Stripe handles this internally)
- Compliance with legal obligations to non-required disclosure

## Security practices

- All data is encrypted in transit (HTTPS / TLS).
- All data is encrypted at rest by Supabase's default storage encryption.
- Users can request that their data be deleted via in-app account
  deletion.
- Mony follows the **Independent Security Review** option in Play's
  self-attestation. (If a third-party review is later performed, update
  this section.)

## Notes for the form

- When asked "Is this data collection optional?" — yes for: photos,
  videos, address, phone, location, push token. No for: name, email,
  user ID, purchases.
- When asked "Is this data shared?" — no for everything except the
  Device IDs row (push token shared with Expo).
