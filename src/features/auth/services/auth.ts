import { supabase } from '@/lib/supabase';

/**
 * Triggers Supabase's email-change confirmation flow. The change does NOT
 * take effect until the user clicks the verification link sent to the new
 * address (and, depending on project settings, also confirms from the old
 * address). The auth session keeps the old email until then.
 */
export async function changeEmail(newEmail: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;
}

export class IncorrectCurrentPasswordError extends Error {
  constructor() {
    super('IncorrectCurrentPassword');
    this.name = 'IncorrectCurrentPasswordError';
  }
}

/**
 * Re-authenticates with the current password (Supabase's `updateUser` does
 * not validate it on its own), then updates to the new password. Throws
 * `IncorrectCurrentPasswordError` when the re-auth fails so the caller can
 * surface the error inline on the "current password" field.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const email = u.user?.email;
  if (!email) throw new Error('Not authenticated');

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (signInError) throw new IncorrectCurrentPasswordError();

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) throw updateError;
}

/**
 * Calls the SECURITY DEFINER `delete_my_account` RPC and then signs out
 * locally. The sign-out step is best-effort because the user has already
 * been deleted server-side; a failed sign-out at this point is a
 * client-side cleanup blip, not a data integrity issue.
 *
 * The `as never` cast on the function name is a temporary shim: the RPC
 * exists in B.4's migration but the generated `Database['public']['Functions']`
 * type in [src/types/supabase.ts](src/types/supabase.ts) won't include it
 * until `npm run gen:types` is run after the migration is applied.
 * Re-generation removes the need for this cast (the call will still type
 * cleanly against the regenerated `'delete_my_account'` literal).
 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account' as never);
  if (error) throw error;
  try {
    await supabase.auth.signOut();
  } catch {
    // The user is already gone server-side; swallow.
  }
}
