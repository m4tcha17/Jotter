package expo.modules.jottercamera

import android.content.Context
import android.graphics.ImageFormat
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CaptureRequest
import android.util.Log
import android.util.Range
import androidx.camera.camera2.interop.Camera2CameraInfo
import androidx.camera.camera2.interop.Camera2Interop
import androidx.camera.camera2.interop.ExperimentalCamera2Interop
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.CameraState
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.core.UseCaseGroup
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.lifecycle.awaitInstance
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import java.io.File

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

  @OptIn(ExperimentalCamera2Interop::class)
  internal fun bind(provider: ProcessCameraProvider, lifecycleOwner: LifecycleOwner) {
    val previewBuilder = Preview.Builder()
    val captureBuilder = ImageCapture.Builder().setJpegQuality(92)

    manualExposure?.let { settings ->
      applyManualExposure(Camera2Interop.Extender(previewBuilder), settings)
      applyManualExposure(Camera2Interop.Extender(captureBuilder), settings)
    }

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

  @OptIn(ExperimentalCamera2Interop::class)
  private fun <T> applyManualExposure(extender: Camera2Interop.Extender<T>, settings: ManualExposureSettings) {
    val gains = WhiteBalance.kelvinToRggbGains(settings.whiteBalanceKelvin)
    extender
      .setCaptureRequestOption(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_OFF)
      .setCaptureRequestOption(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_OFF)
      .setCaptureRequestOption(CaptureRequest.CONTROL_AWB_MODE, CaptureRequest.CONTROL_AWB_MODE_OFF)
      .setCaptureRequestOption(CaptureRequest.SENSOR_SENSITIVITY, settings.iso)
      .setCaptureRequestOption(CaptureRequest.SENSOR_EXPOSURE_TIME, settings.shutterSpeedNs)
      .setCaptureRequestOption(CaptureRequest.COLOR_CORRECTION_MODE, CaptureRequest.COLOR_CORRECTION_MODE_TRANSFORM_MATRIX)
      .setCaptureRequestOption(
        CaptureRequest.COLOR_CORRECTION_GAINS,
        android.hardware.camera2.params.RggbChannelVector(gains[0], gains[1], gains[2], gains[3])
      )
  }

  @OptIn(ExperimentalCamera2Interop::class)
  fun queryCapabilities(): CameraCapabilities? {
    val cameraInfo = camera?.cameraInfo ?: return null
    val characteristics = Camera2CameraInfo.from(cameraInfo)
    val isoRange = characteristics.getCameraCharacteristic(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE) ?: return null
    val exposureRange = characteristics.getCameraCharacteristic(CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE) ?: return null
    val map = characteristics.getCameraCharacteristic(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP) ?: return null
    val resolutions = map.getOutputSizes(ImageFormat.JPEG)?.map { it.width to it.height } ?: emptyList()
    return CameraCapabilities(isoRange, exposureRange, resolutions)
  }

  fun setManualExposure(settings: ManualExposureSettings, lifecycleOwner: LifecycleOwner) {
    manualExposure = settings
    cameraProvider?.let { bind(it, lifecycleOwner) }
  }

  fun takePicture(onResult: (String) -> Unit, onError: (Exception) -> Unit) {
    val capture = imageCapture ?: return onError(IllegalStateException("Camera not ready"))
    val file = File(context.cacheDir, "jotter-capture-${System.currentTimeMillis()}.jpg")
    val options = ImageCapture.OutputFileOptions.Builder(file).build()
    capture.takePicture(
      options,
      ContextCompat.getMainExecutor(context),
      object : ImageCapture.OnImageSavedCallback {
        override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
          onResult(file.toURI().toString())
        }
        override fun onError(exception: ImageCaptureException) {
          onError(exception)
        }
      }
    )
  }

  fun stop() {
    cameraProvider?.unbindAll()
  }

  companion object {
    private const val TAG = "JotterCameraController"
  }
}
