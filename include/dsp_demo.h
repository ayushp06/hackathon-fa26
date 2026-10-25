#ifndef DSP_DEMO_H
#define DSP_DEMO_H

#include <stdint.h>

typedef struct {
    float input_rms;
    float filtered_rms;
    float peak_frequency_hz;
    uint32_t peak_bin;
    int32_t status;
} dsp_results_t;

extern volatile dsp_results_t g_dsp_results;
void dsp_demo_run(void);

#endif
