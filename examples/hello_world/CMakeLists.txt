cmake_minimum_required(VERSION 3.24)
project(stm32_hello_world LANGUAGES C)
add_executable(hello_world main.c)
set_target_properties(hello_world PROPERTIES SUFFIX .elf C_STANDARD 11)
target_compile_options(hello_world PRIVATE
    -mcpu=cortex-m4 -mthumb -ffreestanding -fno-builtin
    -ffunction-sections -fdata-sections -Wall -Wextra -Werror)
set(LINKER_SCRIPT "${CMAKE_CURRENT_SOURCE_DIR}/../../linker/STM32F411RE_FLASH.ld")
set_property(TARGET hello_world APPEND PROPERTY LINK_DEPENDS "${LINKER_SCRIPT}")
target_link_options(hello_world PRIVATE -mcpu=cortex-m4 -mthumb -nostdlib
    -T${LINKER_SCRIPT} -Wl,--gc-sections -Wl,--print-memory-usage
    -Wl,-Map=${CMAKE_CURRENT_BINARY_DIR}/hello_world.map)
add_custom_command(TARGET hello_world POST_BUILD
    COMMAND ${CMAKE_OBJCOPY} -O ihex $<TARGET_FILE:hello_world> ${CMAKE_CURRENT_BINARY_DIR}/hello_world.hex
    COMMAND ${CMAKE_OBJCOPY} -O binary $<TARGET_FILE:hello_world> ${CMAKE_CURRENT_BINARY_DIR}/hello_world.bin
    COMMAND ${CMAKE_SIZE} $<TARGET_FILE:hello_world>
    VERBATIM)
