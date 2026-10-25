cmake_minimum_required(VERSION 3.24)
project(stm32f411_dsp LANGUAGES C ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

include(FetchContent)
# Pinned upstream releases. For offline builds, set FETCHCONTENT_SOURCE_DIR_<NAME>.
FetchContent_Declare(cmsis_core
    URL https://github.com/ARM-software/CMSIS_5/archive/refs/tags/5.9.0.tar.gz
    TIMEOUT 60
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE)
FetchContent_Declare(stm32_device
    URL https://github.com/STMicroelectronics/cmsis-device-f4/archive/refs/tags/v2.6.10.tar.gz
    TIMEOUT 60
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE)
FetchContent_Declare(cmsis_dsp
    URL https://github.com/ARM-software/CMSIS-DSP/archive/refs/tags/v1.16.2.tar.gz
    TIMEOUT 60
    SOURCE_SUBDIR Source
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE)
FetchContent_MakeAvailable(cmsis_core stm32_device)

add_compile_options(-mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard
    -ffunction-sections -fdata-sections)
add_compile_definitions(ARM_MATH_CM4 STM32F411xE)
set(CMSISCORE "${cmsis_core_SOURCE_DIR}/CMSIS/Core")
set(DISABLEFLOAT16 ON CACHE BOOL "F411 has a single-precision FPU")
FetchContent_MakeAvailable(cmsis_dsp)

add_executable(firmware
    src/main.c
    src/dsp_demo.c
    ${stm32_device_SOURCE_DIR}/Source/Templates/system_stm32f4xx.c
    ${stm32_device_SOURCE_DIR}/Source/Templates/gcc/startup_stm32f411xe.s)
set_target_properties(firmware PROPERTIES SUFFIX .elf)
target_include_directories(firmware PRIVATE include
    ${stm32_device_SOURCE_DIR}/Include ${CMSISCORE}/Include)
target_compile_options(firmware PRIVATE -Wall -Wextra -Wpedantic)
target_link_libraries(firmware PRIVATE CMSISDSP m)
set(LINKER_SCRIPT "${CMAKE_CURRENT_SOURCE_DIR}/linker/STM32F411RE_FLASH.ld")
set_property(TARGET firmware APPEND PROPERTY LINK_DEPENDS "${LINKER_SCRIPT}")
target_link_options(firmware PRIVATE
    -mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard
    -T${LINKER_SCRIPT} --specs=nano.specs --specs=nosys.specs
    -Wl,--gc-sections -Wl,--print-memory-usage
    -Wl,-Map=${CMAKE_CURRENT_BINARY_DIR}/firmware.map)
add_custom_command(TARGET firmware POST_BUILD
    COMMAND ${CMAKE_OBJCOPY} -O ihex $<TARGET_FILE:firmware> ${CMAKE_CURRENT_BINARY_DIR}/firmware.hex
    COMMAND ${CMAKE_OBJCOPY} -O binary $<TARGET_FILE:firmware> ${CMAKE_CURRENT_BINARY_DIR}/firmware.bin
    COMMAND ${CMAKE_SIZE} $<TARGET_FILE:firmware>
    VERBATIM)
