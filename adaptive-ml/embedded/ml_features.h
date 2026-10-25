#ifndef ADAPTIVE_ML_FEATURES_H
#define ADAPTIVE_ML_FEATURES_H
#include <stdint.h>
#include "preference.h"

/* Inputs are mean per-block digital RMS in Q15 amplitude units, not SPL. */
void adaptive_features(uint32_t primary_rms, uint32_t reference_rms,
                       float context[PL_FEATURES]);
#endif
