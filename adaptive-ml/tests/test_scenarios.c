#include "preference.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>

int main(void) {
    pl_config c = {{0.2f,0.3f},{0.8f,0.7f},0.2f};
    float b[] = {0.5f,0.5f}, x[] = {0.2f,0.2f,0.2f};
    float y[] = {0.8f,0.3f}, near[] = {0.22f,0.22f,0.22f};
    float far[] = {0.9f,0.9f,0.9f};
    pl_model m;
    pl_prediction p, first;
    assert(pl_init(&m,&c,b)); assert(pl_correct(&m,x,y));
    assert(pl_predict(&m,near,&first));
    assert(first.value[0] > b[0] && first.value[0] < y[0]);
    assert(fabsf(first.familiarity-0.9f) < 0.00001f);
    for (int t = 0; t < 1000; ++t) {
        assert(pl_predict(&m,far,&p));
        assert(p.familiarity == 0 && p.value[0] == b[0]);
        assert(pl_predict(&m,near,&p));
        for (size_t i = 0; i < PL_OUTPUTS; ++i) assert(p.value[i] == first.value[i]);
    }
    assert(m.count == 1); /* no feedback from transitions */
    /* Dense input sweep verifies per-output bounds, not just exact targets. */
    for (int i = 0; i <= 1000; ++i) {
        float q[] = {(float)i/1000,0.2f,0.2f};
        assert(pl_predict(&m,q,&p));
        for (size_t j = 0; j < PL_OUTPUTS; ++j)
            assert(p.value[j] >= c.lower[j] && p.value[j] <= c.upper[j]);
    }
    pl_reset(&m);
    for (size_t i = 0; i < PL_CAPACITY + 5; ++i) {
        float q[] = {(float)i/(PL_CAPACITY+5),0,0};
        assert(pl_correct(&m,q,y));
        assert(m.count == (i+1 < PL_CAPACITY ? i+1 : PL_CAPACITY));
    }
    assert(m.next == 5);
    for (size_t i = 0; i < 5; ++i)
        assert(m.examples[i].context[0] == (float)(PL_CAPACITY+i)/(PL_CAPACITY+5));
    for (size_t i = 5; i < PL_CAPACITY; ++i)
        assert(m.examples[i].context[0] == (float)i/(PL_CAPACITY+5));
    pl_reset(&m);
    assert(pl_predict(&m,near,&p)); assert(p.value[0] == b[0]);
    /* Two nearby corrections contribute continuous weighted outputs. */
    float a[] = {0.4f,0.4f,0.4f}, z[] = {0.6f,0.6f,0.6f};
    float mid[] = {0.5f,0.5f,0.5f}, low[] = {0.2f,0.7f};
    assert(pl_correct(&m,a,y)); assert(pl_correct(&m,z,low));
    assert(pl_predict(&m,mid,&p));
    assert(fabsf(p.value[0]-0.5f) < 0.00001f);
    puts("scenario tests passed: nearby, unfamiliar, transitions, bounds, FIFO, reset, interpolation");
    return 0;
}
