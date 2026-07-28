package expo.modules.jottercamera

import android.content.Context
import android.widget.FrameLayout
import androidx.camera.view.PreviewView
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ViewTreeLifecycleOwner
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers

class JotterCameraView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val previewView = PreviewView(context)
  private val scope = CoroutineScope(Dispatchers.Main)
  private val controller = CameraController(context, previewView, scope)
  private var lifecycleOwner: LifecycleOwner? = null

  var onCameraReady: (() -> Unit)? = null

  init {
    addView(
      previewView,
      FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
    )
    controller.onCameraReady = { onCameraReady?.invoke() }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    val owner = ViewTreeLifecycleOwner.get(this) ?: return
    lifecycleOwner = owner
    controller.start(owner)
  }

  override fun onDetachedFromWindow() {
    controller.stop()
    super.onDetachedFromWindow()
  }

  fun getCapabilities(): Map<String, Any?>? = controller.queryCapabilities()?.toResultMap()

  fun setManualExposure(iso: Int, shutterSpeedNs: Long, whiteBalanceKelvin: Int) {
    val owner = lifecycleOwner ?: return
    controller.setManualExposure(ManualExposureSettings(iso, shutterSpeedNs, whiteBalanceKelvin), owner)
  }

  fun takePicture(onResult: (String) -> Unit, onError: (Exception) -> Unit) {
    controller.takePicture(onResult, onError)
  }
}

private fun CameraCapabilities.toResultMap(): Map<String, Any?> = mapOf(
  "isoRange" to listOf(isoRange.lower, isoRange.upper),
  "exposureTimeRangeNs" to listOf(exposureTimeRangeNs.lower, exposureTimeRangeNs.upper),
  "availableResolutions" to availableResolutions.map { (w, h) -> mapOf("width" to w, "height" to h) }
)
