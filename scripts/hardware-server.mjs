import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { randomInt } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const controls = ['volume', 'noiseReduction', 'speechAmplification', 'bass', 'mid', 'treble', 'eq250', 'eq500', 'eq2000', 'eq4000'];
const extendedControls = { reduceLoudSounds: 12, spatialFocus: 13 };
const supportsControls = (data) => data.protocol === 3 || data.protocol === 4;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function replaceFile(temporary, target) {
  // Windows can briefly deny replacement while another process reads a file.
  for (let attempt = 0; ; ++attempt) {
    try { await rename(temporary, target); return; }
    catch (failure) {
      if (attempt >= 10 || !['EPERM', 'EACCES'].includes(failure.code)) throw failure;
      await sleep(10);
    }
  }
}

export function createHardwareServer({ directory, commandTimeout = 2200 } = {}) {
  let connected = false;
  let calibrationStatus = 'idle';
  let sequence = randomInt(1, 1_000_000_000);
  let queue = Promise.resolve();
  let latestStatus = null;
  const statusPath = path.join(directory, 'hardware-status.json');
  const commandPath = path.join(directory, 'hardware-command.txt');
  const error = (message, status = 503) => Object.assign(new Error(message), { status });

  async function snapshot() {
    let data;
    try { data = JSON.parse(await readFile(statusPath, 'utf8')); latestStatus = data; }
    catch {
      // Atomic replacement can briefly race a reader on Windows. Keep the
      // last good snapshot; its original timestamp still expires normally.
      data = latestStatus || { error: 'Start the USB audio bridge first.' };
    }
    const age = Date.now() - Number(data.timestampMs);
    const live = data.streaming === true && Number.isFinite(age) && age >= -1000 && age < 1500;
    if (!live) connected = false;
    const compatible = supportsControls(data);
    return {
      ...data,
      simulated: false,
      streaming: live,
      connected: live && compatible && connected,
      calibrationStatus,
      capabilities: { controls: data.protocol === 4 ? [...controls, ...Object.keys(extendedControls)] : controls,
        spatialFocus: data.protocol === 4, transport: 'USB serial', output: 'PC AUX' },
      error: !live ? (data.error?.startsWith('Dual receiver fault')
        ? 'Audio clocks lost synchronization. Choose Restart audio; check the clock jumpers if it repeats.'
        : data.error || 'Audio stream stopped. Reset the board and restart playback.')
        : !compatible ? 'Flash the app-control firmware to enable acknowledged controls.' : null,
    };
  }

  async function command(id, value) {
    const job = queue.catch(() => {}).then(async () => {
      const initial = await snapshot();
      if (!initial.connected) throw error(initial.error || 'Connect the STM32 first.');
      const requestedSequence = ++sequence;
      const temporary = `${commandPath}.${requestedSequence}.tmp`;
      await writeFile(temporary, `${id} ${value} ${requestedSequence}`, 'utf8');
      await replaceFile(temporary, commandPath);
      const deadline = Date.now() + commandTimeout;
      while (Date.now() < deadline) {
        const current = await snapshot();
        if (!current.connected) throw error(current.error || 'Audio stream disconnected.');
        if (current.commandSequence === requestedSequence) {
          if (current.commandStatus !== 0) throw error('The STM32 rejected this command.', 422);
          return { accepted: true, simulated: false, sequence: requestedSequence, values: current.values };
        }
        await sleep(25);
      }
      throw error('The STM32 did not acknowledge the command. Check playback and reset the board if needed.', 504);
    });
    queue = job;
    return job;
  }

  async function body(request) {
    let text = '';
    for await (const chunk of request) {
      text += chunk;
      if (text.length > 2048) throw error('Request too large.', 413);
    }
    try { return JSON.parse(text || '{}'); }
    catch { throw error('Invalid JSON.', 400); }
  }

  const server = http.createServer(async (request, response) => {
    const origin = request.headers.origin;
    const allowed = new Set(['http://localhost:8081', 'http://127.0.0.1:8081']);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json');
    const reply = (status, data) => { response.writeHead(status); response.end(JSON.stringify(data)); };
    if (origin && !allowed.has(origin)) { reply(403, { error: 'Origin is not allowed.' }); return; }
    const host = (request.headers.host || '').split(':')[0];
    if (host !== '127.0.0.1' && host !== 'localhost') { reply(403, { error: 'Loopback host required.' }); return; }
    if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    try {
      const route = new URL(request.url, 'http://localhost').pathname;
      if (request.method === 'GET' && route === '/api/status') { reply(200, await snapshot()); return; }
      if (request.method === 'GET' && route === '/api/devices') {
        const status = await snapshot();
        reply(200, status.streaming && supportsControls(status)
          ? [{ id: 'stm32-usb', name: `Wavelength STM32 (${status.port})` }] : []);
        return;
      }
      if (request.method !== 'POST') throw error('Not found.', 404);
      const data = await body(request);
      if (route === '/api/connect') {
        if (data.id !== 'stm32-usb') throw error('Unknown device.', 404);
        const status = await snapshot();
        if (!status.streaming || !supportsControls(status)) throw error(status.error || 'USB audio is unavailable.');
        connected = true;
        reply(200, { id: 'stm32-usb', name: `Wavelength STM32 (${status.port})` });
      } else if (route === '/api/disconnect') {
        if ((await snapshot()).connected) await command(0, 0);
        connected = false;
        reply(200, { connected: false });
      } else if (route === '/api/control') {
        const extended = Object.hasOwn(extendedControls, data.control);
        const id = extended ? extendedControls[data.control] : controls.indexOf(data.control);
        if (id < 0) throw error('This control is not supported by the current hardware.', 422);
        if (extended && (await snapshot()).protocol !== 4) throw error('Flash MIC4 firmware for this control.', 422);
        const percent = id < 3 || extended;
        const min = percent ? 0 : -12, max = percent ? 100 : 12;
        if (id === 13 && data.value > 0 && !(await snapshot()).referenceClock) {
          throw error('Spatial Focus requires both microphone receivers.', 422);
        }
        if (!Number.isInteger(data.value) || data.value < min || data.value > max) throw error('Control value is outside its allowed range.', 400);
        reply(200, await command(id, data.value));
      } else if (route === '/api/restart') {
        const restart = queue.catch(() => {}).then(async () => {
          const before = await snapshot();
          if (!supportsControls(before) || Date.now() - before.timestampMs > 1500) {
            throw error('The serial bridge is unavailable. Restart scripts/start-hardware-app.ps1.');
          }
          connected = false;
          const start = Date.now();
          const temporary = `${commandPath}.restart.tmp`;
          await writeFile(temporary, `11 0 ${++sequence}`);
          await replaceFile(temporary, commandPath);
          while (Date.now() - start < 5000) {
            const current = await snapshot();
            if (current.streaming && current.timestampMs > start && current.commandSequence === 0) return { restarted: true };
            await sleep(50);
          }
          throw error('Board restart did not restore audio. Check the clock jumpers and press RESET.', 504);
        });
        queue = restart;
        reply(200, await restart);
      } else if (route === '/api/relearn') {
        if (calibrationStatus === 'loading') throw error('Noise learning is already in progress.', 409);
        calibrationStatus = 'loading';
        try {
          const before = await snapshot();
          if (!(before.values?.noiseReduction > 0)) throw error('Turn up Background Noise Reduction before relearning.', 422);
          await command(10, 0);
          let referencePeak = 0;
          const end = Date.now() + 2200;
          while (Date.now() < end) {
            const current = await snapshot();
            if (!current.connected) throw error(current.error || 'USB audio disconnected during noise learning.');
            referencePeak = Math.max(referencePeak, Number(current.referenceRms) || 0);
            await sleep(100);
          }
          if (!referencePeak) throw error('The reference microphone has no signal. Check its wiring.');
          calibrationStatus = 'complete';
          const status = await snapshot();
          reply(200, { simulated: false, completedAt: new Date().toISOString(), volumePercent: status.values.volume });
        } catch (failure) { calibrationStatus = 'error'; throw failure; }
      } else throw error('Not found.', 404);
    } catch (failure) { reply(failure.status || 500, { error: failure.message || 'Hardware bridge failed.' }); }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5000;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../build');
  await mkdir(directory, { recursive: true });
  const server = createHardwareServer({ directory });
  server.listen(8765, '127.0.0.1', () => console.log('Wavelength hardware API: http://127.0.0.1:8765'));
  server.on('error', (failure) => { console.error(failure.message); process.exitCode = 1; });
}
