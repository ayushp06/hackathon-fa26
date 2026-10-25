using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.IO.Ports;
using System.Runtime.InteropServices;
using System.Threading;

public static class MicSpeakerBridge
{
    [StructLayout(LayoutKind.Sequential, Pack = 2)]
    struct Format {
        public ushort Tag, Channels;
        public uint Rate, BytesPerSecond;
        public ushort Align, Bits, Extra;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct Header {
        public IntPtr Data;
        public uint Length, Recorded;
        public UIntPtr User;
        public uint Flags, Loops;
        public IntPtr Next;
        public UIntPtr Reserved;
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct Caps {
        public ushort Manufacturer, Product;
        public uint Version;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string Name;
        public uint Formats;
        public ushort Channels, Reserved;
        public uint Support;
    }
    [DllImport("winmm.dll")] static extern uint waveOutGetNumDevs();
    [DllImport("winmm.dll", CharSet = CharSet.Unicode)]
    static extern uint waveOutGetDevCapsW(UIntPtr id, out Caps caps, uint size);
    [DllImport("winmm.dll")] static extern uint waveOutOpen(out IntPtr handle, uint id, ref Format format, IntPtr callback, IntPtr instance, uint flags);
    [DllImport("winmm.dll")] static extern uint waveOutPrepareHeader(IntPtr handle, IntPtr header, uint size);
    [DllImport("winmm.dll")] static extern uint waveOutUnprepareHeader(IntPtr handle, IntPtr header, uint size);
    [DllImport("winmm.dll")] static extern uint waveOutWrite(IntPtr handle, IntPtr header, uint size);
    [DllImport("winmm.dll")] static extern uint waveOutPause(IntPtr handle);
    [DllImport("winmm.dll")] static extern uint waveOutRestart(IntPtr handle);
    [DllImport("winmm.dll")] static extern uint waveOutReset(IntPtr handle);
    [DllImport("winmm.dll")] static extern uint waveOutClose(IntPtr handle);

    static volatile bool stop;
    static void Check(uint result, string operation) {
        if (result != 0) throw new IOException(operation + " failed, Windows audio error " + result);
    }
    static Header GetHeader(IntPtr ptr) {
        return (Header)Marshal.PtrToStructure(ptr, typeof(Header));
    }

    sealed class Output : IDisposable
    {
        const int Slots = 24;
        const int TargetFrames = 384; // 24 ms at 16 kHz, before Windows device latency.
        readonly IntPtr[] headers = new IntPtr[Slots];
        readonly IntPtr[] buffers = new IntPtr[Slots];
        readonly bool[] submitted = new bool[Slots];
        readonly bool[] prepared = new bool[Slots];
        readonly uint headerSize = (uint)Marshal.SizeOf(typeof(Header));
        IntPtr device;
        int next;
        bool playing;
        public long Underruns, OverflowResets;

        public Output(int index) {
            Format format = new Format { Tag = 1, Channels = 1, Rate = 16000,
                BytesPerSecond = 32000, Align = 2, Bits = 16, Extra = 0 };
            Check(waveOutOpen(out device, index < 0 ? uint.MaxValue : (uint)index,
                ref format, IntPtr.Zero, IntPtr.Zero, 0), "Open output");
            try {
                Check(waveOutPause(device), "Pause output");
                for (int i = 0; i < Slots; ++i) {
                    buffers[i] = Marshal.AllocHGlobal(256);
                    headers[i] = Marshal.AllocHGlobal((int)headerSize);
                    Header h = new Header { Data = buffers[i], Length = 256 };
                    Marshal.StructureToPtr(h, headers[i], false);
                    Check(waveOutPrepareHeader(device, headers[i], headerSize), "Prepare audio buffer");
                    prepared[i] = true;
                }
            } catch { Dispose(); throw; }
        }
        public int QueuedFrames {
            get {
                int frames = 0;
                for (int i = 0; i < Slots; ++i) {
                    if (submitted[i]) {
                        Header h = GetHeader(headers[i]);
                        if ((h.Flags & 1) == 0) frames += (int)h.Length / 2; // WHDR_DONE = 1
                    }
                }
                return frames;
            }
        }
        public void Warmup() {
            // Initialize the Windows audio engine before accepting live serial
            // packets, so its first-start delay does not fill the live queue.
            byte[] silence = new byte[128];
            for (int i = 0; i < 6; ++i) Write(silence, silence.Length);
            Stopwatch warmup = Stopwatch.StartNew();
            while (QueuedFrames > 0 && warmup.ElapsedMilliseconds < 3000) Thread.Sleep(5);
            if (QueuedFrames > 0) throw new IOException("Windows audio output did not start within three seconds.");
            Check(waveOutPause(device), "Finish output warmup");
            playing = false;
            Underruns = 0;
        }
        public void Write(byte[] pcm, int size) {
            int queued = QueuedFrames;
            if (playing && queued == 0) {
                ++Underruns;
                Check(waveOutPause(device), "Rebuffer output");
                playing = false;
            }
            Header h = GetHeader(headers[next]);
            if (submitted[next] && (h.Flags & 1) == 0) {
                // Bound latency instead of accumulating stale speech indefinitely.
                ++OverflowResets;
                Check(waveOutReset(device), "Reset backed-up output");
                Check(waveOutPause(device), "Pause backed-up output");
                for (int i = 0; i < Slots; ++i) submitted[i] = false;
                queued = 0;
                playing = false;
                h = GetHeader(headers[next]);
            }
            Marshal.Copy(pcm, 0, buffers[next], size);
            h.Length = (uint)size;
            Marshal.StructureToPtr(h, headers[next], false);
            Check(waveOutWrite(device, headers[next], headerSize), "Queue audio");
            submitted[next] = true;
            next = (next + 1) % Slots;
            if (!playing && queued + size / 2 >= TargetFrames) {
                Check(waveOutRestart(device), "Start playback");
                playing = true;
            }
        }
        public void Dispose() {
            if (device == IntPtr.Zero) return;
            waveOutReset(device);
            for (int i = 0; i < Slots; ++i) {
                if (prepared[i]) waveOutUnprepareHeader(device, headers[i], headerSize);
                if (headers[i] != IntPtr.Zero) Marshal.FreeHGlobal(headers[i]);
                if (buffers[i] != IntPtr.Zero) Marshal.FreeHGlobal(buffers[i]);
            }
            waveOutClose(device);
            device = IntPtr.Zero;
        }
    }

    // A slight adaptive rate correction keeps the independent HSI and PC audio
    // clocks from gradually filling or draining the playback queue. Linear
    // interpolation preserves continuity, rather than dropping periodic blocks.
    sealed class Resampler
    {
        long inputIndex = -1;
        double nextOutput, previous, step = 1.0;
        public double Step { get { return step; } }
        public int Process(byte[] input, int start, byte[] output, int queuedFrames, double gain) {
            double desired = 1.0 + (queuedFrames - 384) / 32000.0;
            desired = Math.Max(0.97, Math.Min(1.03, desired));
            step += 0.01 * (desired - step);
            int count = 0;
            for (int i = start; i < start + 128; i += 2) {
                double sample = (short)(input[i] | input[i + 1] << 8);
                ++inputIndex;
                if (inputIndex == 0) previous = sample;
                while (nextOutput <= inputIndex) {
                    double fraction = inputIndex == 0 ? 1.0 : nextOutput - (inputIndex - 1);
                    double value = (previous + (sample - previous) * fraction) * gain;
                    int scaled = (int)Math.Round(Math.Max(-32768, Math.Min(32767, value)));
                    output[count++] = (byte)scaled;
                    output[count++] = (byte)(scaled >> 8);
                    nextOutput += step;
                }
                previous = sample;
            }
            return count;
        }
    }

    static ushort Crc(byte[] p, int length) {
        ushort crc = 0xffff;
        for (int i = 0; i < length; ++i) {
            crc ^= (ushort)(p[i] << 8);
            for (int bit = 0; bit < 8; ++bit)
                crc = (ushort)((crc << 1) ^ ((crc & 0x8000) != 0 ? 0x1021 : 0));
        }
        return crc;
    }
    static uint U32(byte[] p, int i) {
        return (uint)(p[i] | p[i + 1] << 8 | p[i + 2] << 16 | p[i + 3] << 24);
    }
    static int ReadPacket(SerialPort port, byte[] p) {
        byte[] magic = { 77, 73, 67 };
        int matched = 0;
        int version;
        for (;;) {
            int value = port.ReadByte();
            if (value == magic[matched]) ++matched;
            else matched = value == magic[0] ? 1 : 0;
            if (matched != magic.Length) continue;
            version = port.ReadByte();
            if (version == 49 || version == 50) break;
            matched = version == magic[0] ? 1 : 0;
        }
        Array.Copy(magic, p, magic.Length);
        p[3] = (byte)version;
        int length = (version == 50 ? 32 : 16) + 128 + 2;
        int offset = 4;
        while (offset < length) offset += port.Read(p, offset, length - offset);
        return length;
    }
    static string DeviceName(int index) {
        Caps caps;
        uint id = index < 0 ? uint.MaxValue : (uint)index;
        return waveOutGetDevCapsW(new UIntPtr(id), out caps, (uint)Marshal.SizeOf(typeof(Caps))) == 0
            ? caps.Name : "Windows default playback device";
    }

    public static int Main(string[] args)
    {
        string portName = "COM8", recordPath = null;
        int deviceIndex = -1, duration = 0;
        double gain = 1;
        bool list = false;
        try {
            for (int i = 0; i < args.Length; ++i) {
                switch (args[i]) {
                    case "--list": list = true; break;
                    case "--port": portName = args[++i]; break;
                    case "--device": deviceIndex = int.Parse(args[++i], CultureInfo.InvariantCulture); break;
                    case "--duration": duration = int.Parse(args[++i], CultureInfo.InvariantCulture); break;
                    case "--gain": gain = double.Parse(args[++i], CultureInfo.InvariantCulture); break;
                    case "--record": recordPath = args[++i]; break;
                    default: throw new ArgumentException("Unknown argument: " + args[i]);
                }
            }
            if (list) {
                Console.WriteLine("-1: " + DeviceName(-1) + " (Windows default)");
                for (int i = 0; i < waveOutGetNumDevs(); ++i) Console.WriteLine(i + ": " + DeviceName(i));
                return 0;
            }
            if (gain < 0 || gain > 8 || double.IsNaN(gain) || double.IsInfinity(gain))
                throw new ArgumentException("Gain must be between 0 and 8.");
            if (waveOutGetNumDevs() == 0) throw new IOException("Windows has no available playback devices.");
            Console.CancelKeyPress += delegate(object sender, ConsoleCancelEventArgs e) { e.Cancel = true; stop = true; };
            using (SerialPort port = new SerialPort(portName, 921600, Parity.None, 8, StopBits.One))
            using (Output output = new Output(deviceIndex)) {
                output.Warmup();
                port.Handshake = Handshake.None;
                port.DtrEnable = false;
                port.RtsEnable = false;
                port.ReadTimeout = 1000;
                port.ReadBufferSize = 65536;
                port.Open();
                port.DiscardInBuffer();
                Console.WriteLine("Microphone -> " + DeviceName(deviceIndex));
                Console.WriteLine(portName + " at 921600 baud; 16 kHz mono PCM16; gain " + gain);
                Console.WriteLine("Start with low speaker volume to avoid acoustic feedback. Ctrl+C stops playback.");
                byte[] packet = new byte[162], rendered = new byte[256];
                Resampler resampler = new Resampler();
                long packets = 0, missing = 0, bad = 0, timeouts = 0, firmwareDrops = 0;
                uint expected = 0;
                bool seen = false;
                int peak = 0;
                Stopwatch clock = Stopwatch.StartNew();
                double lastReport = 0;
                double lastControl = 0;
                string controlPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "pc-audio-command.txt");
                FileStream record = null;
                try {
                    if (recordPath != null) {
                        record = new FileStream(recordPath, FileMode.Create, FileAccess.Write);
                        record.Write(new byte[44], 0, 44);
                    }
                    while (!stop && (duration <= 0 || clock.Elapsed.TotalSeconds < duration)) {
                        int packetLength;
                        try { packetLength = ReadPacket(port, packet); }
                        catch (TimeoutException) {
                            ++timeouts;
                            Console.WriteLine("No complete PCM packet. Check PC-stream firmware, COM port and baud rate.");
                            if (timeouts >= 5) throw new IOException("No reliable microphone stream after five serial timeouts.");
                            continue;
                        }
                        if (U32(packet, 8) != 16000 || packet[12] != 64 || packet[13] != 0 ||
                            Crc(packet, packetLength - 2) != (ushort)(packet[packetLength - 2] | packet[packetLength - 1] << 8)) { ++bad; continue; }
                        bool nlms = packet[3] == 50;
                        int pcmStart = nlms ? 32 : 16;
                        int firmwareFault = packet[15];
                        if (firmwareFault != 0) {
                            if (nlms && (packet[14] & 128) != 0) {
                                uint positions = U32(packet, 16), diag = U32(packet, 20), events = U32(packet, 24);
                                throw new IOException(string.Format("Dual receiver fault {0}: primaryNDTR={1} referenceNDTR={2} txNDTR={3} clocks=0x{4:X} stage={5} callbacks={6}/{7} SPI3=0x{8:X8}",
                                    firmwareFault, positions & 65535, positions >> 16, diag & 65535,
                                    (diag >> 16) & 255, diag >> 24, events & 65535, events >> 16, U32(packet, 28)));
                            }
                            throw new IOException("Firmware fault " + firmwareFault +
                                (nlms ? string.Format(" (sync={0}, overrun={1}, framing={2}, HAL=0x{3:X})",
                                    U32(packet, 16), U32(packet, 20), U32(packet, 24), U32(packet, 28)) : ""));
                        }
                        uint seq = U32(packet, 4);
                        if (seen && seq != expected) {
                            uint gap = unchecked(seq - expected);
                            if (gap < 1000000) missing += gap;
                        }
                        expected = unchecked(seq + 1);
                        seen = true;
                        ++packets;
                        if ((packet[14] & 1) != 0) firmwareDrops = 1;
                        for (int i = pcmStart; i < pcmStart + 128; i += 2)
                            peak = Math.Max(peak, Math.Abs((int)(short)(packet[i] | packet[i + 1] << 8)));
                        int size = resampler.Process(packet, pcmStart, rendered, output.QueuedFrames, gain);
                        output.Write(rendered, size);
                        if (record != null) record.Write(rendered, 0, size);
                        if (clock.Elapsed.TotalSeconds - lastControl >= 0.1) {
                            lastControl = clock.Elapsed.TotalSeconds;
                            try {
                                if (File.Exists(controlPath)) {
                                    string command = File.ReadAllText(controlPath).Trim();
                                    File.Delete(controlPath);
                                    if (command == "b" || command == "n" || command == "r") {
                                        port.Write(command);
                                        Console.WriteLine("Filter command sent: " + command);
                                    }
                                }
                            } catch (IOException) { /* A command file may still be getting written; retry. */ }
                        }
                        if (clock.Elapsed.TotalSeconds - lastReport >= 1.0) {
                            lastReport = clock.Elapsed.TotalSeconds;
                            Console.WriteLine("packets={0} peak={1} queue={2:F0}ms rate={3:F4} missing={4} crc={5} fwDrop={6} underrun={7} overflow={8}",
                                packets, peak, output.QueuedFrames / 16.0, resampler.Step, missing, bad,
                                firmwareDrops, output.Underruns, output.OverflowResets);
                            if (nlms) {
                                int flags = packet[14] | packet[15] << 8;
                                string mode = (flags & 32) != 0 ? "bypass" :
                                    (flags & 4) != 0 ? "no-reference" :
                                    (flags & 8) != 0 ? "hold" : "nlms";
                                Console.WriteLine("filter={0} primaryRms={1} referenceRms={2} outputRms={3} maxCycles={4} reset={5} clipped={6}",
                                    mode, U32(packet, 16), U32(packet, 20), U32(packet, 24), U32(packet, 28),
                                    (flags & 16) != 0 ? 1 : 0, (flags & 64) != 0 ? 1 : 0);
                            }
                            peak = 0;
                        }
                    }
                    Console.WriteLine("Stopped: packets={0} missing={1} crc={2} fwDrop={3} underrun={4} overflow={5}",
                        packets, missing, bad, firmwareDrops, output.Underruns, output.OverflowResets);
                } finally {
                    if (record != null) {
                        long bytes = record.Length - 44;
                        record.Position = 0;
                        using (BinaryWriter writer = new BinaryWriter(record)) {
                            writer.Write(System.Text.Encoding.ASCII.GetBytes("RIFF")); writer.Write((uint)(bytes + 36));
                            writer.Write(System.Text.Encoding.ASCII.GetBytes("WAVEfmt ")); writer.Write(16);
                            writer.Write((ushort)1); writer.Write((ushort)1); writer.Write(16000); writer.Write(32000);
                            writer.Write((ushort)2); writer.Write((ushort)16);
                            writer.Write(System.Text.Encoding.ASCII.GetBytes("data")); writer.Write((uint)bytes);
                        }
                    }
                }
            }
            return 0;
        } catch (Exception e) {
            Console.Error.WriteLine("Audio bridge: " + e.Message);
            Console.Error.WriteLine("Close monitor-mic.ps1 and other COM8 applications before running playback.");
            return 1;
        }
    }
}
