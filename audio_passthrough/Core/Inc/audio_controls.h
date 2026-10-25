#ifndef AUDIO_CONTROLS_H
#define AUDIO_CONTROLS_H
#include <stdint.h>
#define CONTROL_COUNT 10U
#define CONTROL_RELEARN 10U
#define CONTROL_RESTART 11U
#define CONTROL_LOUDNESS 12U
#define CONTROL_SPATIAL 13U
/* IDs: volume, NLMS wet mix, speech gain, bass, mid, treble,
 * 250 Hz, 500 Hz, 2 kHz, 4 kHz; ID 10 relearns background noise. */
typedef struct {
    uint32_t sequence, relearns, clips, output_rms;
    int8_t value[CONTROL_COUNT];
    uint8_t status;
    uint8_t loudness, spatial;
} ControlStats;
extern volatile ControlStats g_control_stats;
void Controls_Init(void);
void Controls_Command(uint8_t id, int8_t value, uint32_t sequence);
void Controls_BeginBlock(void);
void Controls_Process24(int32_t *samples, uint32_t count);
#endif
