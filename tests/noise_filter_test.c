#include "../audio_passthrough/Core/Inc/noise_filter.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>

static unsigned rng = 0x12345678;
static float random_noise(void)
{
    rng ^= rng << 13; rng ^= rng >> 17; rng ^= rng << 5;
    return ((float)(rng & 0xffffU) / 32768.0f - 1.0f) * 0.15f;
}

int main(void)
{
    int32_t primary[NOISE_BLOCK], reference[NOISE_BLOCK], output[NOISE_BLOCK];
    float history[8] = {0}, voice_delay[NOISE_DELAY] = {0}, truth[NOISE_BLOCK];
    unsigned history_index = 0, voice_index = 0, index = 0;
    float voice_prev = 0, voice_hp = 0;
    double raw_noise_energy = 0, clean_noise_energy = 0;
    double voice_error_energy = 0, voice_energy = 0;
    Noise_Init();
    for (unsigned block = 0; block < 1200; ++block) {
        for (unsigned i = 0; i < NOISE_BLOCK; ++i, ++index) {
            float n = random_noise();
            float old = history[(history_index + 1U) % 8U];
            history[history_index] = n;
            history_index = (history_index + 1U) % 8U;
            float voice = block >= 600 ? 0.2f * sinf(2.0f * 3.14159265f * 500.0f * index / 16000.0f) : 0.0f;
            voice_hp = voice - voice_prev + 0.99f * voice_hp;
            voice_prev = voice;
            truth[i] = voice_delay[voice_index];
            voice_delay[voice_index] = voice_hp;
            voice_index = (voice_index + 1U) % NOISE_DELAY;
            float p = 0.6f * n + 0.25f * old + voice;
            reference[i] = (int32_t)(n * 8388608.0f);
            primary[i] = (int32_t)(p * 8388608.0f);
        }
        Noise_Process(primary, reference, output);
        for (unsigned i = 0; i < NOISE_BLOCK; ++i) {
            assert(output[i] >= -8388608 && output[i] <= 8388607);
            double out = output[i] / 8388608.0;
            if (block >= 500 && block < 600) {
                double p = primary[i] / 8388608.0;
                raw_noise_energy += p * p;
                clean_noise_energy += out * out;
            }
            if (block >= 800) {
                double e = out - truth[i];
                voice_error_energy += e * e;
                voice_energy += truth[i] * truth[i];
            }
        }
    }
    double reduction = 10.0 * log10(raw_noise_energy / clean_noise_energy);
    double voice_snr = 10.0 * log10(voice_energy / voice_error_energy);
    printf("Synthetic correlated-noise attenuation: %.1f dB\n", reduction);
    printf("Independent speech-like tone output SNR: %.1f dB\n", voice_snr);
    assert(reduction > 25.0);
    assert(voice_snr > 25.0);
    assert(g_noise_stats.resets == 0);

    /* No reference must cause bypass, not an unstable normalized division. */
    for (unsigned block = 0; block < 200; ++block) {
        for (unsigned i = 0; i < NOISE_BLOCK; ++i, ++index) {
            reference[i] = 0;
            primary[i] = (int32_t)(0.1f * sinf(index * 0.1f) * 8388608.0f);
        }
        Noise_Process(primary, reference, output);
    }
    assert(g_noise_stats.reference_present == 0);
    assert(g_noise_stats.active == 0);
    assert(g_noise_stats.resets == 0);
    Noise_SetEnabled(0);
    Noise_Process(primary, reference, output);
    assert(g_noise_stats.enabled == 0);
    Noise_RequestReset();
    Noise_Process(primary, reference, output);
    assert(g_noise_stats.resets == 0);
    /* Runtime mix must produce bypass, full cancellation and a half mix,
     * rather than treating every nonzero percentage as an on/off switch. */
    Noise_Init();
    double mixes[3]={0};
    const unsigned strengths[3]={0,100,50};
    for (unsigned stage=0;stage<3;++stage) {
        Noise_SetStrength(strengths[stage]);
        double input_energy=0,output_energy=0;
        for (unsigned block=0;block<700;++block) {
            for (unsigned i=0;i<NOISE_BLOCK;++i) {
                float n=random_noise();
                reference[i]=(int32_t)(n*8388608.0f);
                primary[i]=(int32_t)(n*0.6f*8388608.0f);
            }
            Noise_Process(primary,reference,output);
            if (block>600) {
                input_energy+=(double)g_noise_stats.primary_rms*g_noise_stats.primary_rms;
                output_energy+=(double)g_noise_stats.output_rms*g_noise_stats.output_rms;
            }
        }
        mixes[stage]=sqrt(output_energy/input_energy);
    }
    assert(mixes[0]>0.99 && mixes[0]<1.01);
    assert(mixes[1]<0.05);
    assert(mixes[2]>0.45 && mixes[2]<0.55);
    puts("PASS: convergence, desired-signal preservation, missing-reference bypass and control");
    return 0;
}
