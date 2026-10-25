#include "dsp_demo.h"
#include "arm_math.h"

#define SAMPLE_COUNT 256U
#define TAP_COUNT 8U
#define SAMPLE_RATE_HZ 8000.0f
#define TONE_HZ 1000.0f

static float32_t input[SAMPLE_COUNT];
static float32_t filtered[SAMPLE_COUNT];
static float32_t fft_output[SAMPLE_COUNT];
static float32_t magnitudes[SAMPLE_COUNT / 2U];
static float32_t fir_state[SAMPLE_COUNT + TAP_COUNT - 1U];
/* CMSIS FIR coefficients are stored in reverse time order.
 * This symmetric moving-average example has identical coefficients. */
static const float32_t fir_coeffs[TAP_COUNT] = {
    0.125f, 0.125f, 0.125f, 0.125f,
    0.125f, 0.125f, 0.125f, 0.125f
};

volatile dsp_results_t g_dsp_results;

void dsp_demo_run(void)
{
    arm_fir_instance_f32 fir;
    arm_rfft_fast_instance_f32 fft;
    float32_t input_rms, filtered_rms, peak;
    uint32_t peak_index;

    for (uint32_t i = 0; i < SAMPLE_COUNT; ++i) {
        input[i] = arm_sin_f32(2.0f * PI * TONE_HZ * (float32_t)i / SAMPLE_RATE_HZ);
    }

    arm_rms_f32(input, SAMPLE_COUNT, &input_rms);
    arm_fir_init_f32(&fir, TAP_COUNT, fir_coeffs, fir_state, SAMPLE_COUNT);
    arm_fir_f32(&fir, input, filtered, SAMPLE_COUNT);
    arm_rms_f32(filtered, SAMPLE_COUNT, &filtered_rms);

    arm_status status = arm_rfft_fast_init_f32(&fft, SAMPLE_COUNT);
    g_dsp_results.status = status;
    if (status != ARM_MATH_SUCCESS) {
        return;
    }
    /* RFFT modifies its input. Compute RMS and filtering first.
     * Output packs DC and Nyquist into elements 0 and 1; skip that pair. */
    arm_rfft_fast_f32(&fft, input, fft_output, 0);
    magnitudes[0] = 0.0f;
    arm_cmplx_mag_f32(&fft_output[2], &magnitudes[1], SAMPLE_COUNT / 2U - 1U);
    arm_max_f32(magnitudes, SAMPLE_COUNT / 2U, &peak, &peak_index);

    g_dsp_results.input_rms = input_rms;
    g_dsp_results.filtered_rms = filtered_rms;
    g_dsp_results.peak_bin = peak_index;
    g_dsp_results.peak_frequency_hz = (float32_t)peak_index * SAMPLE_RATE_HZ / SAMPLE_COUNT;
}
