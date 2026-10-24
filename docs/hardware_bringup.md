# AURA hardware bring-up

**Hold point:** Use only parts whose actual package, breakout, header, and jack pinouts have been matched to their datasheets and to [wiring_guide.md](wiring_guide.md). Keep SW6 open and **keep earbuds disconnected from any listener** throughout initial testing. An uncharacterized speaker or listener is not a test load. Record measured values, instrument settings, USB source, and board revision at each stage. See [electrical_review.md](electrical_review.md) for blockers and manufacturer references.

## 1. Continuity — unpowered

1. Disconnect USB and all audio loads. Confirm U1/U2/U3 package orientation and the correct endpoints of C4/C5/C8/C9; confirm U3 exposed pad and all specified ground pins have continuity to CN7-20/CN10-20.
2. Measure resistance between CN7-16 V3V3 and GND. Investigate a low-resistance short before power. Capacitors can cause transient meter readings, so wait for settling; no arbitrary pass resistance is assumed.
3. Trace each digital run: CN10-16→U1-3/U2-15; CN10-30→U1-1/U2-13; CN10-28→U1-2; CN10-26→U2-14. Confirm there are no swaps or cross-shorts among them.
4. Confirm U2-12 SCK, U2-16 FMT, U2-10 DEMP, U1-4 L/R are grounded; U1-8 CHIPEN, U2-11 FLT, U2-17 XSMT are on V3V3. Verify C4 bridges only U2-2/U2-4, C8 only U3-2/U3-4, and C9 reaches U3-5 and PGND.
5. Confirm J3 pin 1 sleeve goes to GND, pin 2 tip to HP_L, and pin 3 ring to HP_R **for SJ-3523-SMT-TR only**. Check tip, ring, sleeve using an unpowered TRS plug and continuity meter. With SW6 open, TP11/U3-16 must be pulled to GND through R7.

**Gate:** No shorts or mapping discrepancies. Resolve any mismatch before applying power.

## 2. Power — amplifier muted

1. Remove any jack load. Set SW6 open. Set Nucleo JP5 to pins 1–2 U5V and JP1 for the actual host/charger case per [ST UM1724](https://www.st.com/resource/en/user_manual/dm00105823-stm32-nucleo-32-boards-stmicroelectronics.pdf). Use a current-monitored USB source where available.
2. Power the Nucleo first, with peripherals attached only after the rail/load budget is established. Measure CN7-16/TP1 to TP2; verify approximately 3.3 V and within every attached IC's data-sheet operating range. Measure startup and steady current. Check for abnormal heating.
3. With all ICs connected and still muted, measure V3V3 at U1-7, U2-1/-8/-20, U3-1/-9/-13; measure ripple/transients near DAC and amplifier with a short oscilloscope ground spring. Check TP11 low with SW6 open and after MCU reset. If rail dips or current exceeds the documented configuration, stop and revise power distribution.

**Gate:** Stable rail and known current margin under the intended USB configuration. ERC does not establish this margin.

## 3. GPIO — passive controls and shutdown

1. With audio output unloaded and SW6 open, verify PA0/CN7-28, PA1/CN7-30, PA4/CN7-32, PB0/CN7-34, PB1/CN10-24 each sits near 3.3 V and falls near GND only when its contact closes. Check encoder A/B sequencing and button bounce with a logic analyzer or scope. No input may exceed V3V3.
2. Verify PA8/CN10-23 remains low or input during reset. Then drive it low/high in a controlled bench test; with SW6 open, TP11 must remain low. Close SW6 only for a no-load enable test; TP11 should follow PA8. Reopen SW6 before moving to audio measurements.

**Gate:** All five inputs distinct and manual mute/shutdown deterministic.

## 4. I²S clocks — no listener/load

1. Configure the STM32 for I2S2 master transmit and synchronized I2S2_ext receive; use the verified PB12/PB13/PB14/PB15 alternate functions and separate DMA requests in [RM0383](https://www.st.com/resource/en/reference_manual/dm00119316.pdf). This document does not supply firmware.
2. At TP3 verify WS ≈16 kHz; at TP4 verify BCK ≈1.024 MHz (64 BCK/WS frame), valid 3.3 V levels, shared timing at U1 and U2, and left/right frame order. Capture TP6 and confirm 24 data bits in each 32-bit slot with correct I²S one-clock offset. Check DMA continuity and absence of underrun/overrun during a sustained test.

**Gate:** Stable clocks and correctly framed data. Divider settings must be validated on the actual clock source.

## 5. Microphone — digital data

1. Verify U1 CHIPEN high and L/R low. Capture TP5 relative to TP3/TP4 while applying a modest acoustic test tone to the microphone; observe activity in the left slot and a defined low during the high-impedance right slot via R6.
2. Decode signed 24-bit samples and confirm expected polarity, absence of stuck bits, and reasonable silence/noise behavior. Measure input-to-buffer timing as needed; no acoustic performance claim follows from a toggling data line.

**Gate:** Stable, aligned microphone samples with no digital framing fault.

## 6. DAC — line outputs, amplifier muted

1. Keep SW6 open. Send digital silence, then a low-level known stereo test tone on TP6. Confirm U2 SCK is grounded, XSMT is high, and U2's 3-wire PLL produces stable analog output.
2. Measure TP9 DAC_L and TP10 DAC_R with a high-impedance scope or meter. Check output DC, tone frequency, channel separation, and RMS level against the digital input. Increase only within the DAC's stated line-output range. Check for pops during power and clock transitions.

**Gate:** Correct left/right line output with acceptable DC/transient behavior. Do not attach earbuds.

## 7. Amplifier and resistive test load

1. Connect **separate 32 Ω resistive loads of adequate power rating** from J3 tip (HP_L) to sleeve and ring (HP_R) to sleeve. Confirm the load value and jack continuity before enabling. A different known load within the amplifier data-sheet range may be used, with the calculation updated accordingly.
2. Start with DAC digital silence and SW6 open. Drive PA8 low, close SW6, then set PA8 high. Confirm TP11 rises and U3 supplies/charge-pump nodes behave per the [MAX97220A datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX97220A-MAX97220E.pdf). Do not ground PVSS or probe pump nodes with a long scope ground lead.
3. Apply a small known DAC tone. At TP7/TP8 measure DC, RMS, peak, clipping, and any startup/shutdown transient across each load. Check L/R isolation and gain: the design target is about 0.1 V/V magnitude from each DAC output to the corresponding headphone output, subject to actual load and supply. Open SW6 and verify output shutdown. Characterize the maximum possible output including full-scale digital input and fault/transient cases **on the resistive loads only**.
4. Check USB and V3V3 current/ripple at the highest tested load. Stop if the supply droops, overheats, oscillates, or exceeds the verified current budget.

**Gate:** Measured gain, output DC, peak/RMS level, mute, and power margin documented. Nominal 0.21 V RMS from a 2.1 V RMS DAC with 0.1 gain is only an estimate; it does not establish a safe earbud SPL.

## 8. Controlled audio loopback

1. Keep the resistive loads attached. Begin with the DAC and amplifier muted and digital gain at minimum. Route decoded microphone samples to both DAC channels, preserving 24-bit alignment and left/right frame structure. Enable gradually and verify live speech/test-tone continuity, latency, dropout behavior, feedback susceptibility, and limit behavior on instruments.
2. Recheck maximum output during restarts, disconnects, button/encoder operation, and clock/DMA fault recovery. Define a measured electrical output limit and assess actual earbud sensitivity using an appropriate acoustic measurement setup before **any** listener use.

**Final gate:** No listener connection until output levels and transients have been measured and reviewed with the actual earbuds. The current project remains **NO-GO** for listener use and for unidentified modules/jack.
