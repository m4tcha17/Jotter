function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function logSliderToValue(position: number, min: number, max: number): number {
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return Math.exp(logMin + position * (logMax - logMin));
}

function valueToLogSlider(value: number, min: number, max: number): number {
  const clamped = clamp(value, min, max);
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return (Math.log(clamped) - logMin) / (logMax - logMin);
}

export function sliderToIso(position: number, isoRange: [number, number]): number {
  return Math.round(logSliderToValue(position, isoRange[0], isoRange[1]));
}

export function isoToSlider(iso: number, isoRange: [number, number]): number {
  return valueToLogSlider(iso, isoRange[0], isoRange[1]);
}

export function sliderToShutterSpeedNs(position: number, exposureTimeRangeNs: [number, number]): number {
  return Math.round(logSliderToValue(position, exposureTimeRangeNs[0], exposureTimeRangeNs[1]));
}

export function shutterSpeedNsToSlider(shutterSpeedNs: number, exposureTimeRangeNs: [number, number]): number {
  return valueToLogSlider(shutterSpeedNs, exposureTimeRangeNs[0], exposureTimeRangeNs[1]);
}

export const WHITE_BALANCE_KELVIN_RANGE: [number, number] = [2000, 10000];

export function sliderToWhiteBalanceKelvin(position: number): number {
  const [min, max] = WHITE_BALANCE_KELVIN_RANGE;
  return Math.round(min + position * (max - min));
}

export function whiteBalanceKelvinToSlider(kelvin: number): number {
  const [min, max] = WHITE_BALANCE_KELVIN_RANGE;
  const clamped = clamp(kelvin, min, max);
  return (clamped - min) / (max - min);
}
