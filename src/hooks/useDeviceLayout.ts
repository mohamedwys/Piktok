import { useWindowDimensions } from 'react-native';

const TABLET_BREAKPOINT = 600;
const CONTENT_MAX_WIDTH_TABLET = 480;

export type DeviceLayout = {
  screenWidth: number;
  screenHeight: number;
  isPhone: boolean;
  isTablet: boolean;
  isLandscape: boolean;
  contentMaxWidth: number;
};

export function useDeviceLayout(): DeviceLayout {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  return {
    screenWidth: width,
    screenHeight: height,
    isPhone: !isTablet,
    isTablet,
    isLandscape: width > height,
    contentMaxWidth: isTablet ? CONTENT_MAX_WIDTH_TABLET : width,
  };
}
