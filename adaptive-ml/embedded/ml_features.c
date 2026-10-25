#include "ml_features.h"
#include <math.h>

static float level(uint32_t rms)
{
    /* -100 dBFS floor through 0 dBFS, computed only in foreground. */
    float amplitude = fminf((float)rms / 32768.0f, 1.0f);
    return fmaxf(0.0f, fminf(1.0f, (log10f(fmaxf(amplitude, 0.00001f)) + 5.0f) / 5.0f));
}
void adaptive_features(uint32_t primary_rms, uint32_t reference_rms,
                       float context[PL_FEATURES])
{
    context[0] = level(primary_rms);
    context[1] = level(reference_rms);
    context[2] = 0.5f; /* Explicitly unused compatibility input, not a measurement. */
}
