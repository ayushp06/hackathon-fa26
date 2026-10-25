import ExpoModulesCore
import AVFAudio

public class HeadphoneRouteModule: Module {
  private var observer: NSObjectProtocol?

  private func hasWiredHeadset() -> Bool {
    AVAudioSession.sharedInstance().currentRoute.outputs.contains { $0.portType == .headphones }
  }

  public func definition() -> ModuleDefinition {
    Name("HeadphoneRoute")
    Events("onRouteChanged")
    Function("isWiredHeadsetConnected") { self.hasWiredHeadset() }
    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] _ in
        guard let self else { return }
        self.sendEvent("onRouteChanged", ["connected": self.hasWiredHeadset()])
      }
    }
    OnStopObserving {
      if let observer = self.observer { NotificationCenter.default.removeObserver(observer) }
      self.observer = nil
    }
  }
}
