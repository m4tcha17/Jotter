import { requireNativeViewManager } from 'expo-modules-core';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { ComponentType, Ref } from 'react';

import type {
  CameraCapabilities,
  JotterCameraViewHandle,
  JotterCameraViewProps,
  ManualExposureOptions,
  TakePictureResult,
} from './JotterCamera.types';

type NativeViewInstance = {
  getCapabilities: () => Promise<CameraCapabilities>;
  setManualExposure: (iso: number, shutterSpeedNs: number, whiteBalancePreset: string) => Promise<void>;
  takePicture: () => Promise<TakePictureResult>;
};

const NativeJotterCameraView: ComponentType<
  JotterCameraViewProps & { ref?: Ref<NativeViewInstance> }
> = requireNativeViewManager('JotterCamera');

function JotterCameraViewImpl(props: JotterCameraViewProps, ref: Ref<JotterCameraViewHandle>) {
  const nativeRef = useRef<NativeViewInstance>(null);

  useImperativeHandle(ref, () => ({
    getCapabilities: async () => {
      if (!nativeRef.current) throw new Error('JotterCameraView is not mounted');
      return nativeRef.current.getCapabilities();
    },
    setManualExposure: async (options: ManualExposureOptions) => {
      if (!nativeRef.current) throw new Error('JotterCameraView is not mounted');
      await nativeRef.current.setManualExposure(options.iso, options.shutterSpeedNs, options.whiteBalancePreset);
    },
    takePicture: async () => {
      if (!nativeRef.current) throw new Error('JotterCameraView is not mounted');
      return nativeRef.current.takePicture();
    },
  }));

  return <NativeJotterCameraView {...props} ref={nativeRef} />;
}

export default forwardRef(JotterCameraViewImpl);
