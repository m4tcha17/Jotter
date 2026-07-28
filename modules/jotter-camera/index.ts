// Re-export the native module. On web, it will be resolved to JotterCameraModule.web.ts
// and on native platforms to JotterCameraModule.ts
export { default } from './src/JotterCameraModule';
export * from './src/JotterCamera.types';
