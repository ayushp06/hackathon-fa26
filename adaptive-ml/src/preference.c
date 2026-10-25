#include "preference.h"
#include <math.h>
#include <string.h>

static int normalized(const float *v, size_t n) {
    if (!v) return 0;
    for (size_t i = 0; i < n; ++i)
        if (!isfinite(v[i]) || v[i] < 0.0f || v[i] > 1.0f) return 0;
    return 1;
}
static int target_valid(const pl_config *c, const float *v) {
    if (!normalized(v, PL_OUTPUTS)) return 0;
    for (size_t i = 0; i < PL_OUTPUTS; ++i)
        if (v[i] < c->lower[i] || v[i] > c->upper[i]) return 0;
    return 1;
}
int pl_init(pl_model *m, const pl_config *c, const float *b) {
    if (!m || !c || !normalized(c->lower, PL_OUTPUTS) ||
        !normalized(c->upper, PL_OUTPUTS) || !isfinite(c->radius) ||
        c->radius <= 0.0f || c->radius > 1.0f) return 0;
    for (size_t i = 0; i < PL_OUTPUTS; ++i)
        if (c->lower[i] > c->upper[i]) return 0;
    if (!target_valid(c, b)) return 0;
    memset(m, 0, sizeof(*m));
    m->config = *c;
    memcpy(m->baseline, b, sizeof(m->baseline));
    return 1;
}
void pl_reset(pl_model *m) {
    if (!m) return;
    memset(m->examples, 0, sizeof(m->examples));
    m->count = m->next = 0;
}
int pl_set_baseline(pl_model *m, const float *b) {
    if (!m || !target_valid(&m->config, b)) return 0;
    memcpy(m->baseline, b, sizeof(m->baseline));
    pl_reset(m);
    return 1;
}
int pl_correct(pl_model *m, const float *x, const float *y) {
    if (!m || !normalized(x, PL_FEATURES) || !target_valid(&m->config, y)) return 0;
    /* Latest explicit correction supersedes an identical context. */
    size_t slot = m->next;
    int replacement = 0;
    for (size_t j = 0; j < m->count; ++j) {
        int equal = 1;
        for (size_t i = 0; i < PL_FEATURES; ++i)
            if (x[i] != m->examples[j].context[i]) equal = 0;
        if (equal) { slot = j; replacement = 1; break; }
    }
    memcpy(m->examples[slot].context, x, sizeof(m->examples[slot].context));
    memcpy(m->examples[slot].target, y, sizeof(m->examples[slot].target));
    if (!replacement) {
        m->next = (m->next + 1) % PL_CAPACITY;
        if (m->count < PL_CAPACITY) ++m->count;
    }
    return 1;
}
int pl_predict(const pl_model *m, const float *x, pl_prediction *out) {
    if (!m || !out || !normalized(x, PL_FEATURES)) return 0;
    pl_prediction p = {0};
    float sum = 0.0f, weighted[PL_OUTPUTS] = {0};
    for (size_t j = 0; j < m->count; ++j) {
        float d2 = 0.0f;
        for (size_t i = 0; i < PL_FEATURES; ++i) {
            float d = x[i] - m->examples[j].context[i];
            d2 += d * d / (float)PL_FEATURES;
        }
        if (d2 == 0.0f) {
            for (size_t i = 0; i < PL_OUTPUTS; ++i) {
                p.value[i] = m->examples[j].target[i];
                p.adjustment[i] = p.value[i] - m->baseline[i];
            }
            p.familiarity = 1.0f;
            *out = p;
            return 1;
        }
        float distance = sqrtf(d2);
        if (distance >= m->config.radius) continue;
        float similarity = 1.0f - distance / m->config.radius;
        float weight = similarity * similarity;
        sum += weight;
        if (similarity > p.familiarity) p.familiarity = similarity;
        for (size_t i = 0; i < PL_OUTPUTS; ++i)
            weighted[i] += weight * m->examples[j].target[i];
    }
    for (size_t i = 0; i < PL_OUTPUTS; ++i) {
        float v = m->baseline[i];
        if (sum > 0.0f) v += p.familiarity * (weighted[i] / sum - v);
        p.value[i] = fminf(m->config.upper[i], fmaxf(m->config.lower[i], v));
        p.adjustment[i] = p.value[i] - m->baseline[i];
    }
    *out = p;
    return 1;
}
