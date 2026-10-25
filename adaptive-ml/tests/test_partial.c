#include "preference.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

static void close_to(float a, float b) { assert(fabsf(a-b) < 0.00001f); }
int main(void) {
    pl_config c = {{0.1f,0.2f},{0.9f,0.8f},0.25f};
    float b[] = {0.5f,0.5f}, x[] = {0.2f,0.2f,0.2f};
    float nearby[] = {0.22f,0.22f,0.22f}, far[] = {0.9f,0.9f,0.9f};
    float first[] = {0.8f,NAN}, second[] = {NAN,0.3f};
    unsigned char only_first[] = {1,0}, only_second[] = {0,7};
    unsigned char both[] = {1,1}, none[] = {0,0};
    pl_model m, before, replica;
    pl_prediction p, q;
    assert(pl_init(&m,&c,b));
    assert(pl_correct_masked(&m,x,first,only_first));
    assert(m.count == 1 && m.examples[0].corrected[0] == 1);
    assert(m.examples[0].corrected[1] == 0);
    assert(pl_predict(&m,x,&p));
    close_to(p.value[0],0.8f); close_to(p.value[1],b[1]);
    assert(pl_predict(&m,nearby,&p));
    close_to(p.value[0],0.776f); close_to(p.value[1],b[1]);

    /* Same context merges masks; first output survives second-only feedback. */
    assert(pl_correct_masked(&m,x,second,only_second));
    assert(m.count == 1 && m.examples[0].corrected[1] == 1);
    assert(pl_predict(&m,x,&p));
    close_to(p.value[0],0.8f); close_to(p.value[1],0.3f);
    first[0] = 0.7f;
    assert(pl_correct_masked(&m,x,first,only_first));
    assert(pl_predict(&m,x,&p));
    close_to(p.value[0],0.7f); close_to(p.value[1],0.3f);

    /* No-feedback and selected invalid targets fail without mutation. */
    before = m;
    float invalid[] = {0.95f,0.3f};
    assert(!pl_correct_masked(&m,x,invalid,none));
    assert(!pl_correct_masked(&m,x,invalid,only_first));
    assert(!pl_correct_masked(&m,x,first,both)); /* selected NaN */
    assert(!pl_correct_masked(&m,x,first,NULL));
    assert(!pl_correct_masked(&m,x,NULL,only_first));
    assert(memcmp(&m,&before,sizeof(m)) == 0);

    /* A full-vector correction remains equivalent to an all-selected mask. */
    float full[] = {0.9f,0.2f};
    replica = m;
    assert(pl_correct(&m,x,full));
    assert(pl_correct_masked(&replica,x,full,both));
    for (int t = 0; t <= 100; ++t) {
        float query[] = {(float)t/100,0.2f,0.2f};
        assert(pl_predict(&m,query,&p)); assert(pl_predict(&replica,query,&q));
        for (size_t i = 0; i < PL_OUTPUTS; ++i) {
            assert(p.value[i] == q.value[i]);
            assert(p.value[i] >= c.lower[i] && p.value[i] <= c.upper[i]);
        }
    }

    /* Exact match on one dimension must not suppress another's nearby evidence.
     * Nor may its greater similarity change the other dimension's attenuation. */
    pl_reset(&m);
    assert(pl_correct_masked(&m,nearby,second,only_second));
    assert(pl_predict(&m,x,&q));
    assert(pl_correct_masked(&m,x,first,only_first));
    before = m;
    for (int t = 0; t < 100; ++t) {
        assert(pl_predict(&m,x,&p));
        close_to(p.value[0],first[0]); close_to(p.value[1],q.value[1]);
        assert(pl_predict(&m,far,&p));
        close_to(p.value[0],b[0]); close_to(p.value[1],b[1]);
        close_to(p.familiarity,0);
    }
    assert(memcmp(&m,&before,sizeof(m)) == 0);

    /* Independent normalization: unrelated outputs must not dilute weights. */
    pl_reset(&m);
    assert(pl_correct_masked(&m,x,second,only_second));
    assert(pl_predict(&m,nearby,&q));
    assert(pl_correct_masked(&m,nearby,first,only_first));
    assert(pl_predict(&m,nearby,&p)); close_to(p.value[1],q.value[1]);

    /* Eviction clears old mask bits; no-feedback at capacity never evicts. */
    pl_reset(&m);
    assert(pl_correct(&m,x,full));
    for (size_t i = 1; i <= PL_CAPACITY; ++i) {
        float context[] = {(float)i/(PL_CAPACITY+1),0,0};
        assert(pl_correct_masked(&m,context,first,only_first));
    }
    assert(m.count == PL_CAPACITY && m.examples[0].corrected[1] == 0);
    for (size_t i = 0; i < m.count; ++i) assert(!m.examples[i].corrected[1]);
    before = m;
    assert(!pl_correct_masked(&m,x,full,none));
    assert(memcmp(&m,&before,sizeof(m)) == 0);
    assert(pl_predict(&m,x,&p)); close_to(p.value[1],b[1]);
    pl_reset(&m);
    assert(pl_predict(&m,x,&p));
    close_to(p.value[0],b[0]); close_to(p.value[1],b[1]);
    printf("partial-feedback tests passed; example=%lu model=%lu prediction=%lu bytes\n",
           (unsigned long)sizeof(pl_example),(unsigned long)sizeof(pl_model),
           (unsigned long)sizeof(pl_prediction));
    return 0;
}
