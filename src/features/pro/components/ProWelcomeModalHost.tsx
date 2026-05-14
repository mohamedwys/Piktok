import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useProWelcome } from '@/stores/useProWelcome';
import { ProWelcomeModal } from './ProWelcomeModal';

const CAP_MODAL_CLOSE_ANIMATION_MS = 150;

/**
 * Mount-once host for the post-IAP welcome modal. Sits inside the
 * protected route layout so a single instance survives navigation
 * across the tab bar and detail screens.
 *
 * Reads the `useProWelcome` flag set by `useUpgradeFlow` immediately
 * after the subscription cache invalidation. Opens the modal with a
 * 150 ms delay (G10) so any in-flight cap-modal close animation
 * finishes before the welcome modal mounts — otherwise the two
 * modals briefly stack on top of each other and look like a flicker.
 *
 * The delay also covers the rare case where the user is on a screen
 * that has its own modal open at IAP-success time; the host always
 * waits one animation frame's worth before presenting.
 */
export function ProWelcomeModalHost(): React.ReactElement {
  const router = useRouter();
  const flag = useProWelcome((s) => s.visible);
  const hide = useProWelcome((s) => s.hide);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!flag) {
      setModalVisible(false);
      return;
    }
    const timer = setTimeout(() => {
      setModalVisible(true);
    }, CAP_MODAL_CLOSE_ANIMATION_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [flag]);

  const handleClose = (): void => {
    setModalVisible(false);
    hide();
  };

  const handlePrimary = (): void => {
    setModalVisible(false);
    hide();
    router.push('/(protected)/edit-seller-profile');
  };

  return (
    <ProWelcomeModal
      visible={modalVisible}
      onClose={handleClose}
      onPrimaryCta={handlePrimary}
    />
  );
}

export default ProWelcomeModalHost;
