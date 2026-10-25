CC = cc
CFLAGS = -std=c11 -O2 -Wall -Wextra -Wpedantic -Werror
CPPFLAGS = -Iinclude
LDLIBS = -lm

.PHONY: test evaluate
test: build/test_preference build/test_scenarios
	./build/test_preference
	./build/test_scenarios

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
