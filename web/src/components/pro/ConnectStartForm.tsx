'use client';

import { useState } from 'react';
import {
  ConnectCountryPicker,
  type ConnectCountry,
} from './ConnectCountryPicker';
import { ConnectOnboardButton } from './ConnectOnboardButton';

/**
 * Client wrapper that binds the country picker to the onboard button
 * for the /pro/payouts not_started state (Track F.C.2). Owns the
 * selected-country state so the button can read it at click time
 * without React context.
 *
 * Default country is the caller's choice (page passes 'FR' — primary
 * market). The picker is constrained to the F.C.1 14-country allow-list.
 */
export function ConnectStartForm({
  defaultCountry,
}: {
  defaultCountry: ConnectCountry;
}) {
  const [country, setCountry] = useState<ConnectCountry>(defaultCountry);
  return (
    <div className="space-y-4">
      <ConnectCountryPicker value={country} onChange={setCountry} />
      <ConnectOnboardButton country={country} isResume={false} />
    </div>
  );
}
