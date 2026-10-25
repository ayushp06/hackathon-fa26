#include "preference.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

static void close_to(float a, float b) { assert(fabsf(a-b) < 0.00001f); }
int main(void) {
    pl_config c = {{0.1f,0.2f},{0.9f,0.8f},0.25f};
    float b[] = {0.5f,0.5f}, x[] = {0.2f,0.2f,0.2f}, y[] = {0.8f,0.3f};
    pl_model m, before;
    pl_prediction p;
    assert(pl_init(&m,&c,b));
    assert(pl_predict(&m,x,&p));
    close_to(p.value[0],b[0]); close_to(p.familiarity,0);
    assert(pl_correct(&m,x,y));
    before = m;
    assert(pl_predict(&m,x,&p));
    close_to(p.value[0],y[0]); close_to(p.value[1],y[1]);
    close_to(p.adjustment[0],0.3f); close_to(p.familiarity,1);
    assert(memcmp(&m,&before,sizeof(m)) == 0); /* inference is read-only */
    y[0] = 0.7f;
    assert(pl_correct(&m,x,y)); assert(m.count == 1);
    assert(pl_predict(&m,x,&p)); close_to(p.value[0],0.7f);
    before = m;
    float bad[] = {NAN,0,0}, invalid[] = {0.95f,0.5f};
    assert(!pl_correct(&m,bad,y)); assert(!pl_correct(&m,x,invalid));
    assert(!pl_predict(&m,bad,&p)); assert(!pl_set_baseline(&m,invalid));
    assert(memcmp(&m,&before,sizeof(m)) == 0);
    c.radius = 0;
    assert(!pl_init(&m,&c,b)); assert(memcmp(&m,&before,sizeof(m)) == 0);
    assert(!pl_init(NULL,&c,b)); assert(!pl_predict(&m,NULL,&p));
    pl_reset(&m); assert(m.count == 0 && m.next == 0);
    assert(pl_predict(&m,x,&p)); close_to(p.value[0],b[0]);
    assert(pl_correct(&m,x,y));
    float new_baseline[] = {0.6f,0.4f};
    assert(pl_set_baseline(&m,new_baseline)); assert(m.count == 0);
    assert(pl_predict(&m,x,&p)); close_to(p.value[0],0.6f);
    /* Non-finite, out-of-domain and inverted limits fail transactionally. */
    c.radius = 0.25f; c.lower[0] = 1;
    assert(!pl_init(&m,&c,b));
    float outside[] = {-0.1f,0,0};
    assert(!pl_correct(&m,outside,y));
    puts("unit tests passed");
    return 0;
}
