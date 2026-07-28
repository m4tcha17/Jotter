import { registerWebModule, NativeModule } from 'expo';

// JotterCameraModule is not available on the web platform.
class JotterCameraModule extends NativeModule<{}> {}

export default registerWebModule(JotterCameraModule, 'JotterCameraModule');
