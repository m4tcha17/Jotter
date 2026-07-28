package expo.modules.jottercamera

import android.content.Context
import android.util.Log
import android.util.Range
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.CameraState
import androidx.camera.core.ImageCapture
import androidx.camera.core.Preview
import androidx.camera.core.UseCaseGroup
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.lifecycle.awaitInstance
import androidx.camera.view.PreviewView
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

data class CameraCapabilities(
  val isoRange: Range<Int>,
  val exposureTimeRangeNs: Range<Long>,
  val availableResolutions: List<Pair<Int, Int>>
)

data class ManualExposureSettings(
  val iso: Int,
  val shutterSpeedNs: Long,
  val whiteBalanceKelvin: Int
)

class CameraController(
  private val context: Context,
  private val previewView: PreviewView,
  private val scope: CoroutineScope
) {
  private var cameraProvider: ProcessCameraProvider? = null
  internal var camera: Camera? = null
  internal var imageCapture: ImageCapture? = null
  private var manualExposure: ManualExposureSettings? = null

  var onCameraReady: (() -> Unit)? = null

  fun start(lifecycleOwner: LifecycleOwner) {
    scope.launch {
      val provider = ProcessCameraProvider.awaitInstance(context)
      cameraProvider = provider
      bind(provider, lifecycleOwner)
    }
  }

  internal fun bind(provider: ProcessCameraProvider, lifecycleOwner: LifecycleOwner) {
    val previewBuilder = Preview.Builder()
    val captureBuilder = ImageCapture.Builder().setJpegQuality(92)

    val preview = previewBuilder.build().also { it.surfaceProvider = previewView.surfaceProvider }
    val capture = captureBuilder.build()
    imageCapture = capture

    val selector = CameraSelector.Builder().requireLensFacing(CameraSelector.LENS_FACING_BACK).build()
    val useCases = UseCaseGroup.Builder().addUseCase(preview).addUseCase(capture).build()

    try {
      provider.unbindAll()
      camera = provider.bindToLifecycle(lifecycleOwner, selector, useCases)
      camera?.cameraInfo?.cameraState?.observe(lifecycleOwner) { state ->
        if (state.type == CameraState.Type.OPEN) {
          onCameraReady?.invoke()
        }
      }
    } catch (e: Exception) {
      Log.e(TAG, "Failed to bind camera use cases", e)
    }
  }

  fun stop() {
    cameraProvider?.unbindAll()
  }

  companion object {
    private const val TAG = "JotterCameraController"
  }
}
