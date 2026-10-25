#include "preference.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>

/* Arbitrary normalized preference function, not an acoustic/DSP model. */
static void preference(const float *x, float *y) {
    y[0] = 0.2f + 0.6f*x[0];
    y[1] = 0.75f - 0.5f*x[1];
}
typedef struct { double absolute, squared; size_t n; } metric;
static void record(metric *m, float actual, float target) {
    double e = (double)actual-target;
    m->absolute += fabs(e); m->squared += e*e; ++m->n;
}
static void report(const char *name, const metric *m) {
    printf("%s MAE=%.6f RMSE=%.6f outputs=%lu\n", name,
           m->absolute/m->n,sqrt(m->squared/m->n),(unsigned long)m->n);
}
int main(void) {
    pl_config c = {{0,0},{1,1},0.2f};
    float b[] = {0.5f,0.5f};
    const float centers[][PL_FEATURES] = {
        {0.2f,0.2f,0.2f},{0.8f,0.2f,0.2f},
        {0.2f,0.8f,0.2f},{0.8f,0.8f,0.2f}
    };
    pl_model m, replica;
    pl_prediction p, other;
    metric learned = {0}, baseline = {0}, unfamiliar = {0}, unfamiliar_base = {0};
    assert(pl_init(&m,&c,b)); assert(pl_init(&replica,&c,b));
    for (size_t i = 0; i < 4; ++i) {
        float target[PL_OUTPUTS]; preference(centers[i],target);
        assert(pl_correct(&m,centers[i],target));
        assert(pl_correct(&replica,centers[i],target));
    }
    /* 4 centers × 6 nonzero offsets; held-out points repeat over 10 transitions.
     * Third feature deliberately carries no target information. */
    for (int cycle = 0; cycle < 10; ++cycle) {
        for (size_t k = 0; k < 4; ++k) {
            for (int offset = -3; offset <= 3; ++offset) {
                if (offset == 0) continue;
                float d = (float)offset*0.01f;
                float x[] = {centers[k][0]+d,centers[k][1]-d,centers[k][2]+d};
                float target[PL_OUTPUTS]; preference(x,target);
                assert(pl_predict(&m,x,&p)); assert(pl_predict(&replica,x,&other));
                for (size_t j = 0; j < PL_OUTPUTS; ++j) {
                    assert(p.value[j] == other.value[j]);
                    record(&learned,p.value[j],target[j]);
                    record(&baseline,b[j],target[j]);
                }
            }
        }
    }
    for (int i = 0; i < 20; ++i) {
        float x[] = {0.3f+(float)i*0.02f,0.5f,0.95f}, target[PL_OUTPUTS];
        preference(x,target);
        assert(pl_predict(&m,x,&p)); assert(p.familiarity == 0);
        for (size_t j = 0; j < PL_OUTPUTS; ++j) {
            assert(p.value[j] == b[j]);
            record(&unfamiliar,p.value[j],target[j]);
            record(&unfamiliar_base,b[j],target[j]);
        }
    }
    assert(m.count == 4 && replica.count == 4);
    assert(learned.absolute < baseline.absolute);
    puts("SYNTHETIC ONLY: 4 corrections; 24 unique nearby queries repeated 10 times; 20 unfamiliar queries");
    report("nearby learner",&learned); report("nearby constant baseline",&baseline);
    report("unfamiliar learner",&unfamiliar); report("unfamiliar constant baseline",&unfamiliar_base);
    printf("host sizeof(pl_model)=%lu bytes; deterministic replicas agree\n",(unsigned long)sizeof(m));
    return 0;
}
