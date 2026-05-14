# App Store Connect — App Privacy Questionnaire Copy

Use this document when completing ASC → My Apps → Mony → App Privacy.
Apple groups data types into categories; each row below maps to one
ASC checkbox + dropdown set.

This document mirrors the iOS Privacy Manifest at app.json
`ios.privacyManifests`. The answers MUST match — Apple compares them
during review.

Last updated: pending v1.0.0 submission.

## Global declarations

- **Tracking**: Mony does NOT track users across apps or websites owned
  by other companies. The App Tracking Transparency prompt is NOT
  required. Declare "No tracking" for every data type below.
- **Data Sharing with Third Parties**: see [docs/store/play-data-safety.md](play-data-safety.md)
  for the sharing list. Apple's question is per-data-type, declared inline.

## Contact Info

### Name
- Collected: Yes
- Linked to user: Yes
- Used for tracking: No
- Purposes: App Functionality

### Email Address
- Collected: Yes
- Linked to user: Yes
- Used for tracking: No
- Purposes: App Functionality, Customer Support

### Phone Number
- Collected: Yes (only when a buyer completes a Buy-Now purchase; Stripe
  collects + forwards via the stripe-webhook for order fulfilment)
- Linked to user: Yes
- Used for tracking: No
- Purposes: App Functionality

### Physical Address
- Collected: Yes (only when a buyer completes a Buy-Now purchase)
- Linked to user: Yes
- Used for tracking: No
- Purposes: App Functionality

### Other User Contact Info
- Collected: No

## Health and Fitness
- Collected: No

## Financial Info
- Payment Info: No (Stripe / Apple / Google process; Mony never sees
  raw card data)
- Credit Info: No
- Other Financial Info: No

## Location

### Precise Location
- Collected: No

### Coarse Location
- Collected: Yes
- Linked to user: Yes
- Used for tracking: No
- Purposes: App Functionality (nearby listings, distance-sorted feed)

## Sensitive Info
- Sensitive Info: No

## Contacts
- Contacts: No

## User Content

### Photos or Videos
- Collected: Yes
- Linked to user: Yes
- Used for tracking: No
- Purposes: App Functionality (listing media, avatars)

### Audio Data
- Collected: No

### Gameplay Content
- Collected: No

### Customer Support
- Collected: Yes (when a user files a Report via the in-app Report
  action; the report body is text the user submits)
- Linked to user: Yes
- Used for tracking: No
- Purposes: Customer Support

### Other User Content
- Collected: Yes (listing titles, descriptions, comments, chat messages)
- Linked to user: Yes
- Used for tracking: No
- Purposes: App Functionality

## Browsing History
- Collected: No

## Search History
- Collected: No

## Identifiers

### User ID
- Collected: Yes
- Linked to user: Yes
- Used for tracking: No
- Purposes: App Functionality

### Device ID
- Collected: Yes (Expo push token, only when the user opts into
  notifications)
- Linked to user: Yes
- Used for tracking: No
- Purposes: App Functionality

## Purchases

### Purchase History
- Collected: Yes (orders for marketplace purchases; subscription
  history for Pro)
- Linked to user: Yes
- Used for tracking: No
- Purposes: App Functionality

## Usage Data
- Product Interaction: No (no analytics SDK in v1)
- Advertising Data: No
- Other Usage Data: No

## Diagnostics

### Crash Data
- Collected: No (Sentry deferred to Phase 9)

### Performance Data
- Collected: No

### Other Diagnostic Data
- Collected: No

## Other Data
- Other Data Types: No
