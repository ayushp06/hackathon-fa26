#include "noise_filter.h"
#ifdef AUDIO_NLMS
#include "dsp/filtering_functions.h"
#include <math.h>
#include <string.h>

/* CMSIS calls its desired input pRef. Here that is the VOICE microphone;
 * pSrc is the separate NOISE microphone. Send pErr, never pOut, to playback. */
static arm_lms_norm_instance_f32 nlms;
static float coefficients[NOISE_TAPS], state[NOISE_TAPS + NOISE_BLOCK - 1U];
static float noise[NOISE_BLOCK], desired[NOISE_BLOCK], estimate[NOISE_BLOCK], error[NOISE_BLOCK];
static float primary_delay[NOISE_DELAY];
static uint32_t delay_index, training_blocks;
static float primary_prev, reference_prev, primary_hp, reference_hp;
static float wet, noise_ratio;
static volatile uint32_t enabled, reset_requested;
volatile NoiseStats g_noise_stats;

static void reset_kernel(void)
{
    memset(coefficients, 0, sizeof coefficients);
    arm_lms_norm_init_f32(&nlms, NOISE_TAPS, coefficients, state, 0.08f, NOISE_BLOCK);
    training_blocks = 0;
    noise_ratio = 1.0f;
    wet = 0.0f;
}

void Noise_Init(void)
{
    memset((void *)&g_noise_stats, 0, sizeof g_noise_stats);
    memset(primary_delay, 0, sizeof primary_delay);
    delay_index = 0;
    primary_prev = reference_prev = primary_hp = reference_hp = 0.0f;
    enabled = 1;
    reset_requested = 0;
    reset_kernel();
}
void Noise_SetEnabled(uint32_t value) { enabled = value != 0; }
void Noise_RequestReset(void) { reset_requested = 1; }

void Noise_Process(const int32_t *primary, const int32_t *reference, int32_t *output)
{
    if (reset_requested) { reset_requested = 0; reset_kernel(); }
    float primary_power = 0.0f, reference_power = 0.0f;
    uint32_t input_clipped = 0;
    for (uint32_t i = 0; i < NOISE_BLOCK; ++i) {
        float p = (float)primary[i] / 8388608.0f;
        float r = (float)reference[i] / 8388608.0f;
        if (fabsf(p) > 0.98f || fabsf(r) > 0.98f) { input_clipped = 1; }
        /* Identical DC blockers, approximately 25 Hz corner, avoid adapting
         * to startup bias or pressure drift instead of acoustic background. */
        primary_hp = p - primary_prev + 0.99f * primary_hp;
        reference_hp = r - reference_prev + 0.99f * reference_hp;
        primary_prev = p; reference_prev = r;
        desired[i] = primary_delay[delay_index];
        primary_delay[delay_index] = primary_hp;
        delay_index = (delay_index + 1U) % NOISE_DELAY;
        noise[i] = reference_hp;
        primary_power += desired[i] * desired[i];
        reference_power += noise[i] * noise[i];
    }
    primary_power /= NOISE_BLOCK;
    reference_power /= NOISE_BLOCK;
    uint32_t present = reference_power > 1.0e-10f;
    uint32_t train = training_blocks < 500U; /* First two seconds: noise only. */
    uint32_t speech_guard = !train && primary_power > 1.0e-8f
        && primary_power > 4.0f * noise_ratio * reference_power;
    uint32_t adapt = enabled && present && !input_clipped && !speech_guard;
    if (adapt) {
        float ratio = primary_power / (reference_power + 1.0e-12f);
        ratio = fmaxf(0.01f, fminf(100.0f, ratio));
        noise_ratio += 0.01f * (ratio - noise_ratio);
        ++training_blocks;
    }
    nlms.mu = adapt ? 0.08f : 0.0f;
    /* Recompute sliding-window energy each block to avoid cumulative
     * floating-point subtraction drift over long recordings. */
    float energy = nlms.x0 * nlms.x0;
    for (uint32_t i = 0; i < NOISE_TAPS - 1U; ++i) { energy += state[i] * state[i]; }
    nlms.energy = energy;
    arm_lms_norm_f32(&nlms, noise, desired, estimate, error, NOISE_BLOCK);

    float coefficient_power = 0.0f;
    uint32_t invalid = 0;
    for (uint32_t i = 0; i < NOISE_TAPS; ++i) {
        if (!isfinite(coefficients[i])) { invalid = 1; }
        coefficient_power += coefficients[i] * coefficients[i];
    }
    for (uint32_t i = 0; i < NOISE_BLOCK; ++i) {
        if (!isfinite(error[i]) || !isfinite(estimate[i])) { invalid = 1; }
    }
    if (!isfinite(coefficient_power) || coefficient_power > 64.0f) { invalid = 1; }
    if (invalid) { reset_kernel(); ++g_noise_stats.resets; }
    uint32_t active = enabled && present && !invalid;
    float output_power = 0.0f;
    for (uint32_t i = 0; i < NOISE_BLOCK; ++i) {
        float target = active ? 1.0f : 0.0f;
        if (wet < target) wet = fminf(target, wet + 0.002f);
        if (wet > target) wet = fmaxf(target, wet - 0.002f);
        float value = desired[i] - wet * (invalid ? 0.0f : estimate[i]);
        if (value > 0.99999988f) { value = 0.99999988f; ++g_noise_stats.clips; }
        if (value < -1.0f) { value = -1.0f; ++g_noise_stats.clips; }
        output[i] = (int32_t)(value * 8388608.0f);
        output_power += value * value;
    }
    g_noise_stats.primary_rms = (uint32_t)(sqrtf(primary_power) * 32768.0f);
    g_noise_stats.reference_rms = (uint32_t)(sqrtf(reference_power) * 32768.0f);
    g_noise_stats.output_rms = (uint32_t)(sqrtf(output_power / NOISE_BLOCK) * 32768.0f);
    g_noise_stats.enabled = enabled;
    g_noise_stats.reference_present = present;
    g_noise_stats.adapting = adapt;
    g_noise_stats.active = active;
}
#endif
