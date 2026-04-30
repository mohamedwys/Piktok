import * as Haptics from 'expo-haptics';

export async function lightHaptic(): Promise<void> {
  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
}
export async function mediumHaptic(): Promise<void> {
  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
}
