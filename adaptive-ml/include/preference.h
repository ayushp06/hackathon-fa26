#ifndef PREFERENCE_H
#define PREFERENCE_H

#include <stddef.h>

/* Change together across all translation units; no DSP semantics implied. */
#define PL_FEATURES 3
#define PL_OUTPUTS 2
#define PL_CAPACITY 16

typedef struct {
    float lower[PL_OUTPUTS], upper[PL_OUTPUTS];
    /* RMS feature distance cutoff, in (0,1]. */
    float radius;
} pl_config;
typedef struct {
    float context[PL_FEATURES], target[PL_OUTPUTS];
} pl_example;
typedef struct {
    pl_config config;
    float baseline[PL_OUTPUTS];
    pl_example examples[PL_CAPACITY];
    size_t count, next;
} pl_model;
typedef struct {
    float value[PL_OUTPUTS], adjustment[PL_OUTPUTS], familiarity;
} pl_prediction;

/* Return 1 on success, 0 on invalid input; failure leaves destination unchanged.
 * After successful init, callers must not mutate public inspection fields.
 * Pointers must reference distinct storage. Caller serializes all access.
 */
int pl_init(pl_model *model, const pl_config *config, const float *baseline);
int pl_set_baseline(pl_model *model, const float *baseline); /* clears memory */
void pl_reset(pl_model *model); /* preserves baseline/config */
int pl_correct(pl_model *model, const float *context, const float *target);
int pl_predict(const pl_model *model, const float *context, pl_prediction *out);

#endif
