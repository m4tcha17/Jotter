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
