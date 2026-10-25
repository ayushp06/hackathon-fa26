package expo.modules.headphoneroute

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class HeadphoneRouteModule : Module() {
  private val context get() = appContext.reactContext
  private val audioManager get() = context?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
  private var deviceCallback: AudioDeviceCallback? = null
  private var noisyReceiver: BroadcastReceiver? = null

  // shortcut: Android reports connected wired outputs, not this player's selected route; inspect the player route when Expo Audio exposes it.
  private fun hasWiredHeadset(): Boolean = audioManager?.getDevices(AudioManager.GET_DEVICES_OUTPUTS)?.any {
    it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
      it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
      it.type == AudioDeviceInfo.TYPE_USB_HEADSET
  } == true

  override fun definition() = ModuleDefinition {
    Name("HeadphoneRoute")
    Events("onRouteChanged")
    Function("isWiredHeadsetConnected") { hasWiredHeadset() }
    OnStartObserving {
      val manager = audioManager
      if (manager != null) {
        deviceCallback = object : AudioDeviceCallback() {
          override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>) {
            sendEvent("onRouteChanged", mapOf("connected" to hasWiredHeadset()))
          }
          override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>) {
            sendEvent("onRouteChanged", mapOf("connected" to hasWiredHeadset()))
          }
        }.also { manager.registerAudioDeviceCallback(it, Handler(Looper.getMainLooper())) }
        noisyReceiver = object : BroadcastReceiver() {
          override fun onReceive(context: Context, intent: Intent) {
            sendEvent("onRouteChanged", mapOf("connected" to false))
          }
        }.also { context?.registerReceiver(it, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)) }
      }
    }
    OnStopObserving {
      deviceCallback?.let { audioManager?.unregisterAudioDeviceCallback(it) }
      noisyReceiver?.let { context?.unregisterReceiver(it) }
      deviceCallback = null
      noisyReceiver = null
    }
  }
}
