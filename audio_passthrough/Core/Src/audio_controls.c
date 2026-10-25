#include "audio_controls.h"
#ifdef AUDIO_APP_CONTROL
#include "noise_filter.h"
#include <math.h>
#include <string.h>
#ifndef CONTROL_HOST_TEST
#include "main.h"
#endif
#define SECTIONS 8U
typedef struct {
    float coefficient[SECTIONS][5]; /* b0,b1,b2,a1,a2, normalized by a0 */
    int8_t value[CONTROL_COUNT];
    uint8_t status;
    uint8_t loudness, spatial;
    uint32_t sequence, relearns, generation;
} Settings;
static Settings requested;
static float coefficient[SECTIONS][5], target[SECTIONS][5], state[SECTIONS][2];
static uint32_t generation;
static float volume, target_volume;
static float envelope, compression_gain, loudness, target_loudness;
volatile ControlStats g_control_stats;

/* Robert Bristow-Johnson's W3C Audio EQ Cookbook; shelves use slope S=1.
 * Coefficients are designed in foreground, never in the audio callback. */
static void design(float *c, float frequency, float db, int shelf, float q)
{
    float a = powf(10.0f, db / 40.0f);
    float w = 6.28318530718f * frequency / 16000.0f;
    float co = cosf(w), si = sinf(w), alpha = si / (2.0f * q);
    float b0, b1, b2, a0, a1, a2;
    if (shelf) {
        float beta = 2.0f * sqrtf(a) * si * 0.70710678118f;
        if (shelf < 0) {
            b0 = a*((a+1)-(a-1)*co+beta); b1 = 2*a*((a-1)-(a+1)*co);
            b2 = a*((a+1)-(a-1)*co-beta); a0 = (a+1)+(a-1)*co+beta;
            a1 = -2*((a-1)+(a+1)*co); a2 = (a+1)+(a-1)*co-beta;
        } else {
            b0 = a*((a+1)+(a-1)*co+beta); b1 = -2*a*((a-1)+(a+1)*co);
            b2 = a*((a+1)+(a-1)*co-beta); a0 = (a+1)-(a-1)*co+beta;
            a1 = 2*((a-1)-(a+1)*co); a2 = (a+1)-(a-1)*co-beta;
        }
    } else {
        b0=1+alpha*a; b1=-2*co; b2=1-alpha*a;
        a0=1+alpha/a; a1=-2*co; a2=1-alpha/a;
    }
    c[0]=b0/a0; c[1]=b1/a0; c[2]=b2/a0; c[3]=a1/a0; c[4]=a2/a0;
}

static void design_all(Settings *s)
{
    design(s->coefficient[0],125,s->value[3],-1,0.707f);
    design(s->coefficient[1],1000,s->value[4],0,1.0f);
    /* 8 kHz is Nyquist at this sample rate: treble is a 4 kHz high shelf. */
    design(s->coefficient[2],4000,s->value[5],1,0.707f);
    const float frequencies[4]={250,500,2000,4000};
    for (uint32_t i=0;i<4;++i) design(s->coefficient[3+i],frequencies[i],s->value[6+i],0,1.0f);
    design(s->coefficient[7],2000,s->value[2]*0.12f,0,0.7f);
}

void Controls_Init(void)
{
    memset(&requested,0,sizeof requested);
    memset((void*)&g_control_stats,0,sizeof g_control_stats);
    memset(state,0,sizeof state);
    requested.value[0]=requested.value[1]=100;
    requested.generation=1;
    design_all(&requested);
    memcpy(coefficient,requested.coefficient,sizeof coefficient);
    memcpy(target,requested.coefficient,sizeof target);
    volume=target_volume=1.0f;
    envelope=loudness=target_loudness=0.0f; compression_gain=1.0f;
    generation=0;
}

void Controls_Command(uint8_t id,int8_t value,uint32_t sequence)
{
    /* Retries must not repeat a relearn operation. */
    if (sequence && requested.sequence==sequence) return;
    Settings next=requested;
    next.sequence=sequence;
    next.status=0;
    if ((id>CONTROL_COUNT && id!=CONTROL_LOUDNESS && id!=CONTROL_SPATIAL)
        || ((id<3 || id==CONTROL_LOUDNESS || id==CONTROL_SPATIAL) && (value<0 || value>100))
        || (id>=3 && id<CONTROL_COUNT && (value < -12 || value>12))
        || (id==CONTROL_COUNT && value!=0)) {
        next.status=1;
    } else if (id==CONTROL_LOUDNESS) {
        next.loudness=(uint8_t)value;
    } else if (id==CONTROL_SPATIAL) {
        next.spatial=(uint8_t)value;
    } else if (id==CONTROL_COUNT) {
        ++next.relearns;
    } else {
        next.value[id]=value;
        design_all(&next);
    }
    ++next.generation;
#ifndef CONTROL_HOST_TEST
    uint32_t mask=__get_PRIMASK(); __disable_irq();
#endif
    /* Short atomic publication; expensive coefficient design is above. */
    requested=next;
#ifndef CONTROL_HOST_TEST
    __DMB(); __set_PRIMASK(mask);
#endif
}

void Controls_BeginBlock(void)
{
    if (generation==requested.generation) return;
    memcpy(target,requested.coefficient,sizeof target);
    target_volume=requested.value[0]/100.0f;
    Noise_SetStrength((uint32_t)requested.value[1]);
    Noise_SetSpatialFocus(requested.spatial);
    target_loudness=requested.loudness/100.0f;
    g_control_stats.loudness=requested.loudness;
    g_control_stats.spatial=requested.spatial;
    if (g_control_stats.relearns!=requested.relearns) Noise_RequestReset();
    for (uint32_t i=0;i<CONTROL_COUNT;++i) g_control_stats.value[i]=requested.value[i];
    g_control_stats.sequence=requested.sequence;
    g_control_stats.status=requested.status;
    g_control_stats.relearns=requested.relearns;
    generation=requested.generation;
}

void Controls_Process24(int32_t *samples,uint32_t count)
{
    float power=0;
    for (uint32_t i=0;i<count;++i) {
        float sample=samples[i]/8388608.0f;
        /* Smooth coefficient and level changes, retaining filter history. */
        for (uint32_t section=0;section<SECTIONS;++section) {
            float *c=coefficient[section], *z=state[section];
            for (uint32_t j=0;j<5;++j) c[j]+=0.002f*(target[section][j]-c[j]);
            float out=c[0]*sample+z[0];
            z[0]=c[1]*sample-c[3]*out+z[1]; z[1]=c[2]*sample-c[4]*out;
            if (!isfinite(out) || !isfinite(z[0]) || !isfinite(z[1]) || fabsf(out)>1024.0f) {
                out=z[0]=z[1]=0; ++g_control_stats.clips;
            }
            sample=out;
        }
        /* Peak-envelope 4:1 compressor above -18 dBFS, 5 ms attack and
         * 100 ms release. No automatic makeup gain: quiet sounds stay quiet.
         * Compute the nonlinear curve once per 16 samples to bound IRQ cost. */
        float magnitude=fabsf(sample);
        envelope+=(magnitude>envelope?0.0124222f:0.000624805f)*(magnitude-envelope);
        if ((i&15U)==0U) compression_gain=envelope>0.12589254f
            ?powf(0.12589254f/envelope,0.75f):1.0f;
        loudness+=fmaxf(-0.003125f,fminf(0.003125f,target_loudness-loudness));
        sample*=1.0f+loudness*(compression_gain-1.0f);
        float difference=target_volume-volume;
        volume+=fmaxf(-0.003125f,fminf(0.003125f,difference)); /* 20 ms full ramp */
        sample*=volume;
        /* Instant digital peak ceiling catches transients before the envelope
         * reacts. This is a dBFS ceiling, not a calibrated acoustic SPL limit. */
        float ceiling=1.0f-0.75f*loudness;
        sample=fmaxf(-ceiling,fminf(ceiling,sample));
        if (sample>0.99999988f) {sample=0.99999988f; ++g_control_stats.clips;}
        if (sample < -1.0f) {sample=-1.0f; ++g_control_stats.clips;}
        samples[i]=(int32_t)(sample*8388608.0f);
        power+=sample*sample;
    }
    g_control_stats.output_rms=count?(uint32_t)(sqrtf(power/count)*32768.0f):0;
}
#endif
