import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class HeadphoneRouteModule extends NativeModule<{ onRouteChanged: (event: { connected: boolean }) => void }> {
  isWiredHeadsetConnected(): boolean;
}

export default requireOptionalNativeModule<HeadphoneRouteModule>('HeadphoneRoute');
