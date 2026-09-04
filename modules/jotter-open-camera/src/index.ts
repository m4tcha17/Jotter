import { requireNativeModule } from 'expo-modules-core';

export const OPEN_CAMERA_PACKAGE = 'net.sourceforge.opencamera';

export type CaptureResult = { uri: string } | { cancelled: true };

type JotterOpenCameraNativeModule = {
  isOpenCameraInstalled(): boolean;
  capture(): Promise<CaptureResult>;
};

const native = requireNativeModule<JotterOpenCameraNativeModule>('JotterOpenCamera');

export function isOpenCameraInstalled(): boolean {
  return native.isOpenCameraInstalled();
}

export function capture(): Promise<CaptureResult> {
  return native.capture();
}
