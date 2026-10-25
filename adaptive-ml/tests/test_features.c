#include "ml_features.h"
#include <assert.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
int main(void)
{
    float x[PL_FEATURES], previous = -1;
    adaptive_features(0,0,x);
    assert(x[0] == 0 && x[1] == 0 && x[2] == 0.5f);
    adaptive_features(32768,UINT32_MAX,x);
    assert(x[0] == 1 && x[1] == 1);
    adaptive_features(3277,328,x);
    assert(fabsf(x[0]-0.8f)<0.001f && fabsf(x[1]-0.6f)<0.001f);
    for (uint32_t i=0; i<=65536; ++i) {
        adaptive_features(i,i,x);
        assert(isfinite(x[0]) && x[0]>=previous && x[0]>=0 && x[0]<=1);
        assert(x[0]==x[1] && x[2]==0.5f); previous=x[0];
    }
    puts("feature normalization passed: silence, levels, extremes, bounded monotonic mapping");
    return 0;
}
