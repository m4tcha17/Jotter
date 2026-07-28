import { NativeModule, requireNativeModule } from 'expo';

declare class JotterCameraModule extends NativeModule<{}> {}

export default requireNativeModule<JotterCameraModule>('JotterCamera');
