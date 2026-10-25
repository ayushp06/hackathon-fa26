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
    unsigned char corrected[PL_OUTPUTS]; /* 1 only for explicitly supervised outputs */
} pl_example;
typedef struct {
    pl_config config;
    float baseline[PL_OUTPUTS];
    pl_example examples[PL_CAPACITY];
    size_t count, next;
} pl_model;
typedef struct {
    /* familiarity is the maximum across outputs, not confirmation of all outputs. */
    float value[PL_OUTPUTS], adjustment[PL_OUTPUTS], familiarity;
} pl_prediction;

/* Return 1 on success, 0 on invalid input; failure leaves destination unchanged.
 * After successful init, callers must not mutate public inspection fields.
 * Pointers must reference distinct storage. Caller serializes all access.
 */
int pl_init(pl_model *model, const pl_config *config, const float *baseline);
int pl_set_baseline(pl_model *model, const float *baseline); /* clears memory */
void pl_reset(pl_model *model); /* preserves baseline/config */
/* Full-vector supervision: every target dimension is explicitly confirmed. */
int pl_correct(pl_model *model, const float *context, const float *target);
/* Mask length PL_OUTPUTS; nonzero selects an output. Unselected targets are ignored.
 * Empty/null masks fail without modifying the model. Identical contexts merge only
 * selected outputs, preserving earlier corrections for the other outputs.
 */
int pl_correct_masked(pl_model *model, const float *context, const float *target,
                      const unsigned char *mask);
int pl_predict(const pl_model *model, const float *context, pl_prediction *out);

#endif
