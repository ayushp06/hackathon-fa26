import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import HeadphoneRouteModule from '../../modules/headphone-route/src/HeadphoneRouteModule';

const readConnected = () => {
  try { return HeadphoneRouteModule?.isWiredHeadsetConnected() ?? false; }
  catch { return false; }
};

export function useWiredHeadphones() {
  const [connected, setConnected] = useState(readConnected);

  useEffect(() => {
    if (!HeadphoneRouteModule) return;
    let active = true;
    const route = HeadphoneRouteModule.addListener('onRouteChanged', ({ connected: next }) => setConnected(next));
    void Promise.resolve().then(() => { if (active) setConnected(readConnected()); });
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') setConnected(readConnected());
      else setConnected(false);
    });
    return () => { active = false; route.remove(); app.remove(); };
  }, []);

  return { connected, available: !!HeadphoneRouteModule, refresh: readConnected };
}
