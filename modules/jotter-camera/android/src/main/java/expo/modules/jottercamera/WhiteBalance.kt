package expo.modules.jottercamera

import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min

/**
 * Approximate correlated-color-temperature -> RGB -> COLOR_CORRECTION_GAINS conversion.
 * Uses the Tanner Helland algorithm (public domain) for Kelvin -> RGB, then derives
 * per-channel gains as the inverse of each channel's relative strength so that a
 * warm (low-K) light gets its red channel pulled down / blue pulled up, and vice
 * versa for a cool (high-K) light. Clamped to [1.0, 4.0], a conservative range
 * that covers typical device-reported COLOR_CORRECTION_GAINS maximums; Camera2
 * does not expose a queryable legal range for this key the way it does for ISO
 * or exposure time.
 */
object WhiteBalance {
  private const val MIN_GAIN = 1.0f
  private const val MAX_GAIN = 4.0f

  fun kelvinToRggbGains(kelvin: Int): FloatArray {
    val temp = kelvin.coerceIn(1000, 40000) / 100.0

    val red = if (temp <= 66.0) {
      255.0
    } else {
      (329.698727446 * Math.pow(temp - 60.0, -0.1332047592)).coerceIn(0.0, 255.0)
    }

    val green = if (temp <= 66.0) {
      (99.4708025861 * ln(temp) - 161.1195681661).coerceIn(0.0, 255.0)
    } else {
      (288.1221695283 * Math.pow(temp - 60.0, -0.0755148492)).coerceIn(0.0, 255.0)
    }

    val blue = when {
      temp >= 66.0 -> 255.0
      temp <= 19.0 -> 0.0
      else -> (138.5177312231 * ln(temp - 10.0) - 305.0447927307).coerceIn(0.0, 255.0)
    }

    val rGain = clampGain(if (red > 0.0) green / red else MAX_GAIN.toDouble())
    val bGain = clampGain(if (blue > 0.0) green / blue else MAX_GAIN.toDouble())

    // RggbChannelVector order: red, green (even row), green (odd row), blue.
    return floatArrayOf(rGain, 1.0f, 1.0f, bGain)
  }

  private fun clampGain(value: Double): Float =
    max(MIN_GAIN.toDouble(), min(MAX_GAIN.toDouble(), value)).toFloat()
}
