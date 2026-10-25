#include "ml_runtime.h"
#include "ml_features.h"
#include <math.h>
#include <string.h>
_Static_assert(PL_FEATURES==3 && PL_OUTPUTS==2, "Review embedded mappings when model shape changes");

static int fresh(const adaptive_runtime *r, uint32_t now)
{
    return r->valid && r->stable >= 3 && now-r->observed_at <= 250U;
}
void adaptive_runtime_init(adaptive_runtime *r)
{
    const pl_config config = {{0.0f,0.5f},{1.0f,0.5f},0.15f};
    const float baseline[PL_OUTPUTS] = {0.5f,0.5f};
    memset(r,0,sizeof(*r));
    (void)pl_init(&r->model,&config,baseline);
    r->enabled = 1;
}
void adaptive_runtime_observe(adaptive_runtime *r, uint32_t primary, uint32_t reference,
                              uint32_t now, int usable)
{
    if (!usable || !primary || !reference) { r->valid=r->stable=0; return; }
    float x[PL_FEATURES];
    adaptive_features(primary,reference,x);
    int stable = r->valid && now-r->observed_at <= 250U;
    for (size_t i=0;i<PL_FEATURES;++i)
        if (fabsf(x[i]-r->context[i])>0.03f) stable=0;
    r->stable=stable ? (r->stable<3 ? r->stable+1 : 3) : 1;
    memcpy(r->context,x,sizeof x);
    r->observed_at=now; r->valid=1;
}
int adaptive_runtime_predict(adaptive_runtime *r, uint32_t now, uint32_t *percent)
{
    if (!r->enabled || !fresh(r,now)) return 0;
    if (r->holding && now-r->hold_started<2000U) return 0;
    r->holding=0;
    pl_prediction prediction;
    if (!pl_predict(&r->model,r->context,&prediction)) return 0;
    *percent=(uint32_t)lroundf(prediction.value[0]*100.0f);
    if (*percent>100U) *percent=100U;
    return 1;
}
int adaptive_runtime_correct(adaptive_runtime *r, uint32_t now, uint32_t percent,
                            uint32_t sequence)
{
    if (!sequence || percent>100U) return 0;
    if (sequence==r->feedback_sequence) return 1;
    if (!fresh(r,now)) return 0;
    const float target[PL_OUTPUTS] = {percent/100.0f,0.5f};
    const unsigned char mask[PL_OUTPUTS] = {1,0};
    if (!pl_correct_masked(&r->model,r->context,target,mask)) return 0;
    r->feedback_sequence=sequence;
    r->enabled=r->holding=1; r->hold_started=now;
    return 1;
}
void adaptive_runtime_enable(adaptive_runtime *r, int enabled)
{
    r->enabled=enabled!=0;
    r->holding=0;
}
void adaptive_runtime_reset(adaptive_runtime *r)
{
    pl_reset(&r->model); r->feedback_sequence=0; r->holding=0;
}
