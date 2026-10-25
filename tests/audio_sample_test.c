#include "../audio_passthrough/Core/Inc/audio_sample.h"
#include <assert.h>
#include <stdio.h>

int main(void)
{
    const int32_t samples[] = {0, 1, -1, 100, -100, 8388607, -8388608};
    for (unsigned i = 0; i < sizeof samples / sizeof samples[0]; ++i) {
        uint16_t frame[4];
        Audio_PackStereo24(frame, samples[i]);
        assert(Audio_Unpack24(frame) == samples[i]);
        assert(Audio_Unpack24(frame + 2) == samples[i]);
        assert(frame[0] == frame[2] && frame[1] == frame[3]);
        assert((frame[1] & 255U) == 0);
        frame[1] |= 255U; /* Tri-stated padding must not affect decoded sample. */
        assert(Audio_Unpack24(frame) == samples[i]);
        assert(Audio_Scale24(samples[i], 1, 1) == samples[i]);
    }
    const uint16_t raw[] = {0x8000, 0x00ff, 0x7fff, 0xffff};
    assert(Audio_Unpack24(raw) == -8388608);
    assert(Audio_Unpack24(raw + 2) == 8388607);
    assert(Audio_Scale24(8388607, 4, 1) == 8388607);
    assert(Audio_Scale24(-8388608, 4, 1) == -8388608);
    assert(Audio_Scale24(100, 1, 4) == 25);
    assert(Audio_Scale24(-100, 1, 4) == -25);
    puts("PASS: 24-bit sign extension, padding, stereo packing, gain and saturation");
    return 0;
}
