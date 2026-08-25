import {
  isoToSlider,
  sliderToIso,
  shutterSpeedNsToSlider,
  sliderToShutterSpeedNs,
  whiteBalanceKelvinToSlider,
  sliderToWhiteBalanceKelvin,
  WHITE_BALANCE_KELVIN_RANGE,
} from '../exposureMapping';

const ISO_RANGE: [number, number] = [50, 6400];
const SHUTTER_RANGE_NS: [number, number] = [30833, 30000000000];

describe('ISO mapping (log scale)', () => {
  it('maps slider position 0 to the range minimum', () => {
    expect(sliderToIso(0, ISO_RANGE)).toBe(50);
  });

  it('maps slider position 1 to the range maximum', () => {
    expect(sliderToIso(1, ISO_RANGE)).toBe(6400);
  });

  it('round-trips a midpoint value', () => {
    const iso = sliderToIso(0.5, ISO_RANGE);
    const position = isoToSlider(iso, ISO_RANGE);
    expect(position).toBeCloseTo(0.5, 1);
  });

  it('clamps out-of-range values when converting back to a slider position', () => {
    expect(isoToSlider(1, ISO_RANGE)).toBe(0);
    expect(isoToSlider(999999, ISO_RANGE)).toBe(1);
  });
});

describe('Shutter speed mapping (log scale)', () => {
  it('maps slider position 0 to the range minimum', () => {
    expect(sliderToShutterSpeedNs(0, SHUTTER_RANGE_NS)).toBe(30833);
  });

  it('maps slider position 1 to the range maximum', () => {
    expect(sliderToShutterSpeedNs(1, SHUTTER_RANGE_NS)).toBe(30000000000);
  });

  it('round-trips a midpoint value', () => {
    const shutterSpeedNs = sliderToShutterSpeedNs(0.5, SHUTTER_RANGE_NS);
    const position = shutterSpeedNsToSlider(shutterSpeedNs, SHUTTER_RANGE_NS);
    expect(position).toBeCloseTo(0.5, 1);
  });

  it('gives roughly equal slider spacing to shutter speeds that are equal photographic stops apart', () => {
    // 1/500s, 1/60s, and 1/8s are each ~3 stops apart from their neighbor.
    // A log-scale mapping spaces them roughly evenly; a linear mapping would
    // crush all three into a sliver near position 0 (the range's max is 30s).
    const posFast = shutterSpeedNsToSlider(2_000_000, SHUTTER_RANGE_NS); // 1/500s
    const posMid = shutterSpeedNsToSlider(16_666_667, SHUTTER_RANGE_NS); // 1/60s
    const posSlow = shutterSpeedNsToSlider(125_000_000, SHUTTER_RANGE_NS); // 1/8s

    const gap1 = posMid - posFast;
    const gap2 = posSlow - posMid;
    expect(gap1).toBeGreaterThan(0.1);
    expect(gap2).toBeGreaterThan(0.1);
    expect(Math.abs(gap1 - gap2)).toBeLessThan(0.05);
  });

  it('clamps out-of-range values when converting back to a slider position', () => {
    expect(shutterSpeedNsToSlider(1, SHUTTER_RANGE_NS)).toBe(0);
    expect(shutterSpeedNsToSlider(999_999_999_999, SHUTTER_RANGE_NS)).toBe(1);
  });
});

describe('White balance mapping (linear scale, fixed range)', () => {
  it('uses a fixed 2000K-10000K range', () => {
    expect(WHITE_BALANCE_KELVIN_RANGE).toEqual([2000, 10000]);
  });

  it('maps slider position 0 to 2000K and position 1 to 10000K', () => {
    expect(sliderToWhiteBalanceKelvin(0)).toBe(2000);
    expect(sliderToWhiteBalanceKelvin(1)).toBe(10000);
  });

  it('round-trips a midpoint value', () => {
    const kelvin = sliderToWhiteBalanceKelvin(0.5);
    expect(whiteBalanceKelvinToSlider(kelvin)).toBeCloseTo(0.5, 2);
  });

  it('clamps out-of-range values when converting back to a slider position', () => {
    expect(whiteBalanceKelvinToSlider(100)).toBe(0);
    expect(whiteBalanceKelvinToSlider(50000)).toBe(1);
  });
});
