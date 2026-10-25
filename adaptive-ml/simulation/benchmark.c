#include "ml_runtime.h"
#include <assert.h>
#include <stdio.h>
#include <time.h>
int main(void)
{
    adaptive_runtime r;
    adaptive_runtime_init(&r);
    float x[PL_CAPACITY][PL_FEATURES];
    const float target[PL_OUTPUTS]={0.75f,0.5f};
    const unsigned char mask[PL_OUTPUTS]={1,0};
    for (unsigned i=0;i<PL_CAPACITY;++i) {
        x[i][0]=x[i][1]=(float)i/PL_CAPACITY; x[i][2]=0.5f;
        assert(pl_correct_masked(&r.model,x[i],target,mask));
    }
    float query[PL_FEATURES]={0.53f,0.53f,0.5f};
    pl_prediction p;
    const unsigned iterations=200000;
    clock_t begin=clock();
    for (unsigned i=0;i<iterations;++i) assert(pl_predict(&r.model,query,&p));
    double infer=(double)(clock()-begin)/CLOCKS_PER_SEC*1e6/iterations;
    begin=clock();
    for (unsigned i=0;i<iterations;++i)
        assert(pl_correct_masked(&r.model,x[i%PL_CAPACITY],target,mask));
    double update=(double)(clock()-begin)/CLOCKS_PER_SEC*1e6/iterations;
    printf("HOST ONLY: model=%lu runtime=%lu bytes, full memory inference %.3f us/update %.3f us per call (%u iterations)\n",
           (unsigned long)sizeof(pl_model),(unsigned long)sizeof(r),infer,update,iterations);
    return 0;
}
