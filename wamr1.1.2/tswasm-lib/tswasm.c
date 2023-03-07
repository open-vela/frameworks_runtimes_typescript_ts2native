#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <time.h>
#include <sys/timerfd.h>
#include <setjmp.h>

#include "wasm_export.h"

#define MAX_TRYCATCH 128
typedef struct _jmp_envs{
    jmp_buf jmp_env;
    uint32_t  runtime;
    int     block_id;
    bool    is_using;
}jmp_envs;
jmp_envs jenvs[MAX_TRYCATCH]; 
int jmp_index = 0;

static int timerfd_create_wrap(wasm_exec_env_t exec_env)
{
    return timerfd_create(CLOCK_MONOTONIC, TFD_NONBLOCK | TFD_CLOEXEC);
}

static int timerfd_settime_wrap(wasm_exec_env_t exec_env ,int fd,uint64_t min_timeout)
{
    struct itimerspec spec = {};
    spec.it_value.tv_sec = min_timeout / 1000000;
    spec.it_value.tv_nsec = (min_timeout % 1000000) * 1000;
    return timerfd_settime(fd, TFD_TIMER_ABSTIME, &spec, NULL);
}

static void setjmp_wrap(wasm_exec_env_t exec_env,uint32_t runtime,int blockid)
{
    wasm_module_inst_t wasm_module_inst = wasm_runtime_get_module_inst(exec_env);
    //find next used jmpenv
    static bool found = false;
    for(int i=jmp_index;i<MAX_TRYCATCH;++i)
    {
        if(jenvs[i].is_using==false)
        {
            jmp_index = i;
            found =true;
            break;
        }
    }
    if(found==false)
    {
        for(int i=0;i<jmp_index;++i)
        {
            if(jenvs[i].is_using==false)
            {
                jmp_index = i;
                found =true;
                break;
            }
        }
    }
    if(found==false)
        return;

    jenvs[jmp_index].runtime = runtime;
    jenvs[jmp_index].is_using = true;
    jenvs[jmp_index].block_id = blockid;
    int __try_ret__ = setjmp(jenvs[jmp_index].jmp_env);  
    if(__try_ret__==0)
    {
        jenvs[jmp_index].runtime = runtime;

        wasm_function_inst_t target_func = wasm_runtime_lookup_function(wasm_module_inst, "jmpCallbackTry", NULL);
        uint32_t argv1[2];
        argv1[0] = blockid;
        argv1[1] = runtime;

        if(target_func!=NULL)
        {          
            wasm_exec_env_t exec_env1 = wasm_runtime_get_exec_env_singleton(wasm_module_inst);
            wasm_runtime_call_wasm(exec_env1, target_func,2, argv1);
        }       
    }
    else
    {
        uint32_t argv1[3];
        wasm_function_inst_t target_func = wasm_runtime_lookup_function(wasm_module_inst, "jmpCallbackExp", NULL);
        int tmpi = __try_ret__/10;
        argv1[0] = jenvs[tmpi].block_id;
        argv1[1] = __try_ret__ - tmpi*10;
        argv1[2] = jenvs[tmpi].runtime;
        jenvs[tmpi].is_using=false;
        if(target_func!=NULL)
        {                  
            wasm_exec_env_t exec_env1 = wasm_runtime_get_exec_env_singleton(wasm_module_inst);
            wasm_runtime_call_wasm(exec_env1, target_func, 3, argv1);
        }
    }
    return;
}

static int longjmp_wrap(wasm_exec_env_t exec_env ,int blockid,int val)
{
    if(blockid==-1)
        return -1;
    for(int i=0;i<MAX_TRYCATCH;++i)
    {
        if(jenvs[i].block_id==blockid)
        {
            longjmp(jenvs[i].jmp_env,i*10+val);
        }
    }
    return 0;
}

/* clang-format off */
#define REG_NATIVE_FUNC(func_name, signature) \
    { #func_name, func_name##_wrapper, signature, NULL }

static NativeSymbol native_symbols[] = {
    {"timerfd_create_inwamr",timerfd_create_wrap,"()i"},
    {"timerfd_settime_inwamr",timerfd_settime_wrap,"(iI)i"},
    {"setjmp_inwamr",setjmp_wrap,"(ii)"},
    {"longjmp_inwamr",longjmp_wrap,"(ii)i"}
};
/* clang-format on */

uint32_t
get_native_lib(char **p_module_name, NativeSymbol **p_native_symbols)
{
    *p_module_name = "env";
    *p_native_symbols = native_symbols;
    return sizeof(native_symbols) / sizeof(NativeSymbol);
}