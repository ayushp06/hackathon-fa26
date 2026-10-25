#ifndef ADAPTIVE_ML_RUNTIME_H
#define ADAPTIVE_ML_RUNTIME_H
#include "preference.h"
#include <stdint.h>

typedef struct {
    pl_model model;
    float context[PL_FEATURES];
    uint32_t observed_at, hold_started, feedback_sequence;
    unsigned stable, valid, enabled, holding;
} adaptive_runtime;
void adaptive_runtime_init(adaptive_runtime *r);
void adaptive_runtime_observe(adaptive_runtime *r, uint32_t primary, uint32_t reference,
                              uint32_t now, int usable);
/* Return 1 only for a fresh, stable enabled context and an actionable prediction. */
int adaptive_runtime_predict(adaptive_runtime *r, uint32_t now, uint32_t *percent);
/* Explicit committed target; nonzero sequence deduplicates retries, not app setters. */
int adaptive_runtime_correct(adaptive_runtime *r, uint32_t now, uint32_t percent,
                            uint32_t sequence);
void adaptive_runtime_enable(adaptive_runtime *r, int enabled);
void adaptive_runtime_reset(adaptive_runtime *r);
#endif
