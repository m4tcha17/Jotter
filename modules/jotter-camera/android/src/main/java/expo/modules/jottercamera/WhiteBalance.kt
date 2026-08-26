package expo.modules.jottercamera

import android.hardware.camera2.CaptureRequest

// Maps a user-facing preset name to the Camera2 CONTROL_AWB_MODE constant that drives the
// device's own AWB algorithm for that lighting condition. This is the same color pipeline a
// stock camera app uses for that preset — captured photos need no separate app-computed color
// correction, which matters here since these photos feed a model trained on ordinary-camera
// images. CONTROL_AWB_MODE_OFF/AUTO are deliberately excluded: OFF disables AWB's own color
// science entirely, and AUTO isn't a fixed, repeatable setting across a capture session.
object WhiteBalance {
  private val PRESETS: Map<String, Int> = mapOf(
    "incandescent" to CaptureRequest.CONTROL_AWB_MODE_INCANDESCENT,
    "warm_fluorescent" to CaptureRequest.CONTROL_AWB_MODE_WARM_FLUORESCENT,
    "fluorescent" to CaptureRequest.CONTROL_AWB_MODE_FLUORESCENT,
    "daylight" to CaptureRequest.CONTROL_AWB_MODE_DAYLIGHT,
    "cloudy_daylight" to CaptureRequest.CONTROL_AWB_MODE_CLOUDY_DAYLIGHT,
    "twilight" to CaptureRequest.CONTROL_AWB_MODE_TWILIGHT,
    "shade" to CaptureRequest.CONTROL_AWB_MODE_SHADE,
  )

  fun awbModeFor(preset: String): Int =
    PRESETS[preset] ?: throw IllegalArgumentException("Unknown white balance preset: $preset")

  // CONTROL_AWB_AVAILABLE_MODES is advisory, not a hard gate: some devices under-report it (omit
  // these long-standing fixed presets even though the HAL honors them fine when requested), and
  // Camera2 doesn't reject a capture request for asking anyway. Prefer the device's real list when
  // it actually names any of our presets; otherwise assume they all work rather than leaving the
  // picker empty.
  fun availablePresets(supportedModes: IntArray): List<String> {
    val supported = supportedModes.toSet()
    val matched = PRESETS.filterValues { it in supported }.keys.toList()
    return matched.ifEmpty { PRESETS.keys.toList() }
  }
}
