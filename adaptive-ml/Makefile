CC = cc
CFLAGS = -std=c11 -O2 -Wall -Wextra -Wpedantic -Werror
CPPFLAGS = -Iinclude
LDLIBS = -lm

.PHONY: test
test: build/test_preference
	./build/test_preference

build:
	mkdir -p build

build/test_preference: src/preference.c include/preference.h tests/test_preference.c | build
	$(CC) $(CPPFLAGS) $(CFLAGS) src/preference.c tests/test_preference.c $(LDLIBS) -o $@
