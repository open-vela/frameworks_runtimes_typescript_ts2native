############################################################################
# apps/examples/hello/Make.defs
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.  The
# ASF licenses this file to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance with the
# License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the
# License for the specific language governing permissions and limitations
# under the License.
#
############################################################################

include $(APPDIR)/Make.defs

# Hello, World! built-in application info

PROGNAME  = $(CONFIG_EXAMPLES_TSSHELL_PROGNAME)
PRIORITY  = $(CONFIG_EXAMPLES_TSSHELL_PRIORITY)
STACKSIZE = $(CONFIG_EXAMPLES_TSSHELL_STACKSIZE)
MODULE    = $(CONFIG_EXAMPLES_TSSHELL)

# Hello, World! Example

CFLAGS += ${INCDIR_PREFIX}$(APPDIR)/examples/ts2native/runtime

MAINSRC = ./runtime/ts_shell.c

CSRCS +=  runtime/ts_exception.c 
CSRCS += runtime/ts_gc.c
CSRCS += runtime/ts_lang.c
CSRCS += runtime/ts_package.c
CSRCS += runtime/ts_runtime.c
CSRCS += runtime/ts_shell.c
CSRCS += runtime/ts_std.c
CSRCS += runtime/ts_std_console.c
CSRCS += runtime/ts_std_promise.c
CSRCS += runtime/ts_std_timer.c
# CSRCS += runtime/test/test_async_await_manual.c
# CSRCS += runtime/test/test_class1_manual.c
# CSRCS += runtime/test/test_class2_manual.c
# CSRCS += runtime/test/test_function1_manual.c
# CSRCS += runtime/test/test_function2_manual.c
CSRCS += runtime/test/test_hello_manual.c
# CSRCS += runtime/test/test_interface1_manual.c
# CSRCS += runtime/test/test_interface2_manual.c
# CSRCS += runtime/test/test_promise1_manual.c
# CSRCS += runtime/test/test_timeout_manual.c
# CSRCS += runtime/test/test_trycatch_manual.c
# CSRCS += runtime/test/test_union1_manual.c

include $(APPDIR)/Application.mk
