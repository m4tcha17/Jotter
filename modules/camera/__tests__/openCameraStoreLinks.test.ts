import { openCameraStoreLinks } from '../openCameraStoreLinks';

describe('openCameraStoreLinks', () => {
  it('returns the Play Store deep link as primary and the F-Droid page as fallback', () => {
    expect(openCameraStoreLinks()).toEqual({
      primary: 'market://details?id=net.sourceforge.opencamera',
      fallback: 'https://f-droid.org/packages/net.sourceforge.opencamera/',
    });
  });
});
