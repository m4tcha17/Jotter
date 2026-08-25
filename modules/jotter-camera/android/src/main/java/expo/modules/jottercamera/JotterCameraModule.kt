package expo.modules.jottercamera

import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class JotterCameraModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("JotterCamera")

    View(JotterCameraView::class) {
      Events("onCameraReady")

      AsyncFunction("getCapabilities") { view: JotterCameraView, promise: Promise ->
        val capabilities = view.getCapabilities()
        if (capabilities != null) {
          promise.resolve(capabilities)
        } else {
          promise.reject(CodedException("ERR_CAMERA_NOT_READY", "Camera has not finished binding yet", null))
        }
      }

      AsyncFunction(
        "setManualExposure"
      ) { view: JotterCameraView, iso: Int, shutterSpeedNs: Long, whiteBalanceKelvin: Int, promise: Promise ->
        view.setManualExposure(iso, shutterSpeedNs, whiteBalanceKelvin)
        promise.resolve(null)
      }

      AsyncFunction("takePicture") { view: JotterCameraView, promise: Promise ->
        view.takePicture(
          onResult = { uri -> promise.resolve(mapOf("uri" to uri)) },
          onError = { error ->
            promise.reject(CodedException("ERR_CAPTURE_FAILED", error.message ?: "Capture failed", error))
          }
        )
      }
    }
  }
}
