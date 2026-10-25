CC = cc
CFLAGS = -std=c11 -O2 -Wall -Wextra -Wpedantic -Werror
CPPFLAGS = -Iinclude
LDLIBS = -lm

.PHONY: test evaluate test-dsp benchmark
test: build/test_preference build/test_scenarios build/test_partial build/test_features build/test_runtime build/test_audio_integration
	./build/test_preference
	./build/test_scenarios
	./build/test_partial
	./build/test_features
	./build/test_runtime
	./build/test_audio_integration

evaluate: build/evaluate
	./build/evaluate

build:
	mkdir -p build

build/test_preference: src/preference.c include/preference.h tests/test_preference.c | build
	$(CC) $(CPPFLAGS) $(CFLAGS) src/preference.c tests/test_preference.c $(LDLIBS) -o $@

build/test_scenarios: src/preference.c include/preference.h tests/test_scenarios.c | build
	$(CC) $(CPPFLAGS) $(CFLAGS) src/preference.c tests/test_scenarios.c $(LDLIBS) -o $@

build/evaluate: src/preference.c include/preference.h simulation/evaluate.c | build
	$(CC) $(CPPFLAGS) $(CFLAGS) src/preference.c simulation/evaluate.c $(LDLIBS) -o $@

build/test_partial: src/preference.c include/preference.h tests/test_partial.c | build
	$(CC) $(CPPFLAGS) $(CFLAGS) src/preference.c tests/test_partial.c $(LDLIBS) -o $@

build/test_features: embedded/ml_features.c embedded/ml_features.h tests/test_features.c | build
	$(CC) $(CPPFLAGS) -Iembedded $(CFLAGS) embedded/ml_features.c tests/test_features.c $(LDLIBS) -o $@

build/test_runtime: embedded/ml_runtime.c embedded/ml_runtime.h embedded/ml_features.c src/preference.c tests/test_runtime.c | build
	$(CC) $(CPPFLAGS) -Iembedded $(CFLAGS) src/preference.c embedded/ml_features.c embedded/ml_runtime.c tests/test_runtime.c $(LDLIBS) -o $@

build/test_audio_integration: tests/test_audio_integration.c embedded/ml_runtime.c embedded/ml_features.c src/preference.c ../audio_passthrough/Core/Src/adaptive_audio.c ../audio_passthrough/Core/Src/audio_controls.c | build
	$(CC) $(CPPFLAGS) -Iembedded -I../audio_passthrough/Core/Inc $(CFLAGS) -DAUDIO_ADAPTIVE_ML -DAUDIO_APP_CONTROL -DCONTROL_HOST_TEST $^ $(LDLIBS) -o $@

DSP_SRC = ../audio_passthrough/Core/Src/noise_filter.c ../audio_passthrough/Drivers/CMSIS/DSP/Source/FilteringFunctions/arm_lms_norm_f32.c ../audio_passthrough/Drivers/CMSIS/DSP/Source/FilteringFunctions/arm_lms_norm_init_f32.c
DSP_FLAGS = -D__GNUC_PYTHON__ -DARM_MATH_AUTOVECTORIZE -DAUDIO_NLMS -I../audio_passthrough/Drivers/CMSIS/DSP/Include -I../audio_passthrough/Core/Inc
test-dsp: build/test_dsp_loop
	./build/test_dsp_loop

build/test_dsp_loop: tests/test_dsp_loop.c embedded/ml_runtime.c embedded/ml_features.c src/preference.c ../audio_passthrough/Core/Src/adaptive_audio.c ../audio_passthrough/Core/Src/audio_controls.c $(DSP_SRC) | build
	$(CC) $(CPPFLAGS) -Iembedded $(CFLAGS) $(DSP_FLAGS) -DAUDIO_ADAPTIVE_ML -DAUDIO_APP_CONTROL -DCONTROL_HOST_TEST $^ $(LDLIBS) -o $@

benchmark: build/benchmark
	./build/benchmark

build/benchmark: simulation/benchmark.c embedded/ml_runtime.c embedded/ml_features.c src/preference.c | build
	$(CC) $(CPPFLAGS) -Iembedded $(CFLAGS) $^ $(LDLIBS) -o $@
