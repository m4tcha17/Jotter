export const OPEN_CAMERA_PACKAGE = 'net.sourceforge.opencamera';

export function openCameraStoreLinks(): { primary: string; fallback: string } {
  return {
    primary: `market://details?id=${OPEN_CAMERA_PACKAGE}`,
    fallback: `https://f-droid.org/packages/${OPEN_CAMERA_PACKAGE}/`,
  };
}
