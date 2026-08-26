import type { StyleProp, ViewStyle } from 'react-native';

// Named Camera2 CONTROL_AWB_MODE presets — using the device's own AWB routine for white balance
// (rather than an app-computed gain/matrix approximation) so captured photos match what a normal
// camera produces under that lighting, which matters for a model trained on ordinary-camera images.
export type WhiteBalancePreset =
  | 'incandescent'
  | 'warm_fluorescent'
  | 'fluorescent'
  | 'daylight'
  | 'cloudy_daylight'
  | 'twilight'
  | 'shade';

export type CameraCapabilities = {
  isoRange: [number, number];
  exposureTimeRangeNs: [number, number];
  availableResolutions: { width: number; height: number }[];
  availableWhiteBalancePresets: WhiteBalancePreset[];
};

export type ManualExposureOptions = {
  iso: number;
  shutterSpeedNs: number;
  whiteBalancePreset: WhiteBalancePreset;
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
