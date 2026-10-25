#include "ml_runtime.h"
#include <assert.h>
#include <stdio.h>
static void observe(adaptive_runtime *r, uint32_t p, uint32_t n, uint32_t now)
{
    adaptive_runtime_observe(r,p,n,now-200,1);
    adaptive_runtime_observe(r,p,n,now-100,1);
    adaptive_runtime_observe(r,p,n,now,1);
}
int main(void)
{
    adaptive_runtime r, replica;
    uint32_t value=999;
    adaptive_runtime_init(&r);
    assert(!adaptive_runtime_predict(&r,0,&value));
    assert(!adaptive_runtime_correct(&r,0,75,1));
    observe(&r,328,656,300);
    assert(adaptive_runtime_predict(&r,300,&value) && value==50);
    assert(!adaptive_runtime_correct(&r,300,101,1));
    assert(!adaptive_runtime_correct(&r,300,75,0));
    assert(adaptive_runtime_correct(&r,300,75,1));
    assert(r.model.count==1 && !r.model.examples[0].corrected[1]);
    assert(!adaptive_runtime_predict(&r,400,&value));
    assert(adaptive_runtime_correct(&r,400,75,1)); assert(r.model.count==1);
    observe(&r,328,656,2300);
    assert(adaptive_runtime_predict(&r,2300,&value) && value==75);
    observe(&r,340,670,2600);
    assert(adaptive_runtime_predict(&r,2600,&value) && value>=74 && value<=75);
    assert(!adaptive_runtime_correct(&r,3000,10,2)); /* stale */
    observe(&r,32768,32768,3300);
    assert(adaptive_runtime_predict(&r,3300,&value) && value==50);
    adaptive_runtime_enable(&r,0);
    assert(!adaptive_runtime_predict(&r,3300,&value)); /* manual wins */
    adaptive_runtime_enable(&r,1);
    replica=r;
    for (unsigned i=0;i<100;++i) {
        observe(&r,328,656,3600+i*300);
        observe(&replica,328,656,3600+i*300);
        uint32_t other;
        assert(adaptive_runtime_predict(&r,3600+i*300,&value));
        assert(adaptive_runtime_predict(&replica,3600+i*300,&other));
        assert(value==other && value==75);
    }
    adaptive_runtime_observe(&r,0,0,34000,1);
    assert(!adaptive_runtime_predict(&r,34000,&value));
    adaptive_runtime_reset(&r);
    observe(&r,328,656,35000);
    assert(adaptive_runtime_predict(&r,35000,&value) && value==50);
    puts("runtime passed: baseline, feedback, recall, hold, freshness, missing input, manual override, determinism");
    return 0;
}
