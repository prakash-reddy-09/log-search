cmake_minimum_required(VERSION 3.14)
project(logindex LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE RELEASE)
endif()

add_executable(logindex src/main.cpp)
target_compile_options(logindex PRIVATE -Wall -Wextra -O2)
