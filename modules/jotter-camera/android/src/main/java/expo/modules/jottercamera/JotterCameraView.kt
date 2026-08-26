package expo.modules.jottercamera

import android.content.Context
import android.widget.FrameLayout
import androidx.camera.view.PreviewView
import androidx.lifecycle.ViewTreeLifecycleOwner
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers

class JotterCameraView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  // SurfaceView (the PERFORMANCE default) punches a hole in the window and doesn't reliably
  // get a surface when embedded in React Native's animated/transformed Fabric view tree (e.g.
  // a bottom-tab screen) — only worked when this view was the sole content of a Modal's own
  // dedicated window. TextureView (COMPATIBLE) composites as a normal view and works in both.
  private val previewView = PreviewView(context).apply {
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
  }
  private val scope = CoroutineScope(Dispatchers.Main)
  private val controller = CameraController(context, previewView, scope)

  // Must be an EventDispatcher, not a plain closure — the module definition declares this
  // view's "onCameraReady" via Events(), which wires the JS prop through the dispatcher, not
  // through a directly-assigned callback property.
  private val onCameraReady by EventDispatcher()

  init {
    addView(
      previewView,
      FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
    )
    controller.onCameraReady = { onCameraReady(mapOf()) }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    val owner = ViewTreeLifecycleOwner.get(this) ?: return
    controller.start(owner)
  }

  override fun onDetachedFromWindow() {
    controller.stop()
    super.onDetachedFromWindow()
  }

  fun getCapabilities(): Map<String, Any?>? = controller.queryCapabilities()?.toResultMap()

  fun setManualExposure(iso: Int, shutterSpeedNs: Long, whiteBalancePreset: String) {
    controller.setManualExposure(ManualExposureSettings(iso, shutterSpeedNs, whiteBalancePreset))
  }

  fun takePicture(onResult: (String) -> Unit, onError: (Exception) -> Unit) {
    controller.takePicture(onResult, onError)
  }
}

private fun CameraCapabilities.toResultMap(): Map<String, Any?> = mapOf(
  "isoRange" to listOf(isoRange.lower, isoRange.upper),
  "exposureTimeRangeNs" to listOf(exposureTimeRangeNs.lower, exposureTimeRangeNs.upper),
  "availableResolutions" to availableResolutions.map { (w, h) -> mapOf("width" to w, "height" to h) },
  "availableWhiteBalancePresets" to availableWhiteBalancePresets
)
