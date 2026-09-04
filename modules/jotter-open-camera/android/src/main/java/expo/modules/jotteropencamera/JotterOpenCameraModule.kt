package expo.modules.jotteropencamera

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.MediaStore
import androidx.core.content.FileProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

private const val OPEN_CAMERA_PACKAGE = "net.sourceforge.opencamera"
private const val CAPTURE_REQUEST_CODE = 0x0C4A

class JotterOpenCameraModule : Module() {
  private var pendingPromise: Promise? = null
  private var pendingFile: File? = null

  override fun definition() = ModuleDefinition {
    Name("JotterOpenCamera")

    Function("isOpenCameraInstalled") {
      val pm = appContext.reactContext?.packageManager ?: return@Function false
      try {
        pm.getPackageInfo(OPEN_CAMERA_PACKAGE, 0)
        true
      } catch (e: PackageManager.NameNotFoundException) {
        false
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != CAPTURE_REQUEST_CODE) return@OnActivityResult
      val promise = pendingPromise ?: return@OnActivityResult
      val file = pendingFile
      pendingPromise = null
      pendingFile = null

      if (payload.resultCode == Activity.RESULT_OK) {
        if (file != null && file.exists() && file.length() > 0L) {
          promise.resolve(mapOf("uri" to file.toURI().toString()))
        } else {
          promise.reject(CodedException("ERR_CAPTURE_EMPTY", "Open Camera returned no image", null))
        }
      } else {
        file?.delete()
        promise.resolve(mapOf("cancelled" to true))
      }
    }

    AsyncFunction("capture") { promise: Promise ->
      val context = appContext.reactContext
        ?: return@AsyncFunction promise.reject(Exceptions.ReactContextLost())
      val activity = appContext.currentActivity
        ?: return@AsyncFunction promise.reject(Exceptions.MissingActivity())

      if (pendingPromise != null) {
        return@AsyncFunction promise.reject(
          CodedException("ERR_CAPTURE_IN_PROGRESS", "A capture is already in progress", null)
        )
      }

      val file = File(context.cacheDir, "oc-capture-${System.currentTimeMillis()}.jpg")
      val uri = FileProvider.getUriForFile(
        context,
        "${context.packageName}.jotteropencamera.fileprovider",
        file
      )

      val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
        setPackage(OPEN_CAMERA_PACKAGE)
        putExtra(MediaStore.EXTRA_OUTPUT, uri)
        addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
      }

      if (intent.resolveActivity(context.packageManager) == null) {
        return@AsyncFunction promise.reject(
          CodedException("ERR_OPEN_CAMERA_MISSING", "Open Camera is not installed", null)
        )
      }

      pendingPromise = promise
      pendingFile = file
      activity.startActivityForResult(intent, CAPTURE_REQUEST_CODE)
    }
  }
}
