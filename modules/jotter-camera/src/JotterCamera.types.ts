import type { StyleProp, ViewStyle } from 'react-native';

export type CameraCapabilities = {
  isoRange: [number, number];
  exposureTimeRangeNs: [number, number];
  availableResolutions: { width: number; height: number }[];
};

export type ManualExposureOptions = {
  iso: number;
  shutterSpeedNs: number;
  whiteBalanceKelvin: number;
};

export type TakePictureResult = {
  uri: string;
};

export type JotterCameraViewProps = {
  style?: StyleProp<ViewStyle>;
  onCameraReady?: () => void;
};

export type JotterCameraViewHandle = {
  getCapabilities: () => Promise<CameraCapabilities>;
  setManualExposure: (options: ManualExposureOptions) => Promise<void>;
  takePicture: () => Promise<TakePictureResult>;
};
