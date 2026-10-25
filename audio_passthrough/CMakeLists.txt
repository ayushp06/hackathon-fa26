cmake_minimum_required(VERSION 3.24)
project(AudioPassthrough LANGUAGES C ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
file(GLOB HAL_SOURCES CONFIGURE_DEPENDS Drivers/STM32F4xx_HAL_Driver/Src/*.c)
add_executable(AudioPassthrough
    Core/Src/main.c Core/Src/audio.c Core/Src/pc_audio.c Core/Src/noise_filter.c Core/Src/audio_controls.c Core/Src/reference_capture.c Core/Src/stm32f4xx_hal_msp.c
    Core/Src/stm32f4xx_it.c Core/Src/system_stm32f4xx.c Core/Src/syscalls.c
    Core/Startup/startup_stm32f411xe.s ${HAL_SOURCES})
set_target_properties(AudioPassthrough PROPERTIES SUFFIX .elf)
option(AUDIO_PIN_PROBE "Run a one-time GPIO activity and SD weak-pull test" OFF)
if(AUDIO_PIN_PROBE)
    target_compile_definitions(AudioPassthrough PRIVATE AUDIO_PIN_PROBE)
endif()

option(AUDIO_NLMS "Dual-microphone normalized LMS background-noise reduction" OFF)
option(AUDIO_APP_CONTROL "Acknowledged live app controls and MIC3 telemetry" OFF)
if(AUDIO_APP_CONTROL)
    if(NOT AUDIO_NLMS OR NOT AUDIO_PC_STREAM)
        message(FATAL_ERROR "App controls require NLMS and PC streaming")
    endif()
    target_compile_definitions(AudioPassthrough PRIVATE AUDIO_APP_CONTROL)
endif()
option(AUDIO_DUAL_DATA "Separate I2S3 data input with shared external clocks" OFF)
option(AUDIO_SWAP_MIC_INPUTS "Voice on PC12 and noise reference on PB14" OFF)
if(AUDIO_SWAP_MIC_INPUTS)
    if(NOT AUDIO_DUAL_DATA)
        message(FATAL_ERROR "Swapped microphone inputs require AUDIO_DUAL_DATA=ON")
    endif()
    target_compile_definitions(AudioPassthrough PRIVATE AUDIO_SWAP_MIC_INPUTS)
endif()
if(AUDIO_DUAL_DATA)
    if(NOT AUDIO_NLMS)
        message(FATAL_ERROR "Separate reference capture requires AUDIO_NLMS=ON")
    endif()
    target_compile_definitions(AudioPassthrough PRIVATE AUDIO_DUAL_DATA)
endif()
if(AUDIO_NLMS)
    if(NOT AUDIO_PC_STREAM)
        message(FATAL_ERROR "NLMS output currently requires AUDIO_PC_STREAM=ON")
    endif()
    target_compile_definitions(AudioPassthrough PRIVATE AUDIO_NLMS ARM_MATH_CM4 ARM_MATH_LOOPUNROLL)
    target_include_directories(AudioPassthrough PRIVATE Drivers/CMSIS/DSP/Include)
    target_sources(AudioPassthrough PRIVATE
        Drivers/CMSIS/DSP/Source/FilteringFunctions/arm_lms_norm_f32.c
        Drivers/CMSIS/DSP/Source/FilteringFunctions/arm_lms_norm_init_f32.c)
    target_link_libraries(AudioPassthrough PRIVATE m)
endif()
option(AUDIO_DAC_TEST_TONE "Replace microphone output with a quiet diagnostic tone" OFF)
if(AUDIO_DAC_TEST_TONE)
    target_compile_definitions(AudioPassthrough PRIVATE AUDIO_DAC_TEST_TONE)
endif()
option(AUDIO_PC_STREAM "Stream microphone PCM to the PC over ST-LINK serial" OFF)
if(AUDIO_PC_STREAM)
    if(AUDIO_DAC_TEST_TONE OR AUDIO_PIN_PROBE)
        message(FATAL_ERROR "Disable test tone and pin probe for PC audio streaming")
    endif()
    target_compile_definitions(AudioPassthrough PRIVATE AUDIO_PC_STREAM)
endif()
target_include_directories(AudioPassthrough PRIVATE Core/Inc
    Drivers/CMSIS/Include Drivers/CMSIS/Device/ST/STM32F4xx/Include
    Drivers/STM32F4xx_HAL_Driver/Inc)
target_compile_definitions(AudioPassthrough PRIVATE USE_HAL_DRIVER STM32F411xE)
target_compile_options(AudioPassthrough PRIVATE
    -mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard
    -ffunction-sections -fdata-sections -Wall -Wextra)
set(LINKER_SCRIPT ${CMAKE_CURRENT_SOURCE_DIR}/STM32F411RE_FLASH.ld)
set_property(TARGET AudioPassthrough APPEND PROPERTY LINK_DEPENDS "${LINKER_SCRIPT}")
target_link_options(AudioPassthrough PRIVATE
    -mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard
    -T${LINKER_SCRIPT} --specs=nano.specs --specs=nosys.specs
    -Wl,--gc-sections -Wl,--print-memory-usage
    -Wl,-Map=${CMAKE_CURRENT_BINARY_DIR}/AudioPassthrough.map)
add_custom_command(TARGET AudioPassthrough POST_BUILD
    COMMAND ${CMAKE_OBJCOPY} -O ihex $<TARGET_FILE:AudioPassthrough> ${CMAKE_CURRENT_BINARY_DIR}/AudioPassthrough.hex
    COMMAND ${CMAKE_OBJCOPY} -O binary $<TARGET_FILE:AudioPassthrough> ${CMAKE_CURRENT_BINARY_DIR}/AudioPassthrough.bin
    COMMAND ${CMAKE_SIZE} $<TARGET_FILE:AudioPassthrough>
    VERBATIM)
