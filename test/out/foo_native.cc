// generator by tool

#include "foo_native.h"
#include <jswrapper.h>
#include <jswrapper_help.h>

namespace ns_foo_native {

inline static Module_Foo* ModuleFrom<CallbackInfo>(const CallbackInfo* callback_info) {
  return jswrapper::GetFromPrivateData<Module_Foo>(
                 callback_info->context, callback_info->self);
}

static JswValue _default_constructor(const JswFunctionCallbackInfo* callback_info, JswValue* pexception) {
  auto* native_ptr = new Module_Foo;

  jswrapper::SetToPrivateData(callback_info->context,
                              callback_info->self,
                              native_ptr); 

  return reinterpret_cast<JswValue>(callback_info->self);
}

// the variable

// get property
JswValue _jsw_var_foo_get_haword (
    const JswPropertyCallbackInfo* callback_info,
    JswValue* pexception) {
  auto* native_ptr = ModuleFrom(callback_info);

  return jswrapper::ToJswValue(callback_info->context,
             native_ptr->get_haword());

}
// set property
void _jsw_var_foo_set_haword (
    const JswPropertyCallbackInfo* callback_info,
    JswValue value,
    JswValue* pexception) {
  auto* native_ptr = ModuleFrom(callback_info);
  js_utils::native_ptr<Employee> _value;
  if (!jswrapper::ToNativeValue(callback_info->context, value, &_value)) {
    // TODO error
    return ;
  }

  native_ptr->set_haword(_value);

}

// get property
JswValue _jsw_var_foo_get_size (
    const JswPropertyCallbackInfo* callback_info,
    JswValue* pexception) {
  auto* native_ptr = ModuleFrom(callback_info);

  return jswrapper::ToJswValue(callback_info->context,
             native_ptr->get_size());

}
// set property
void _jsw_var_foo_set_size (
    const JswPropertyCallbackInfo* callback_info,
    JswValue value,
    JswValue* pexception) {
  auto* native_ptr = ModuleFrom(callback_info);
  js_utils::number_t _value;
  if (!jswrapper::ToNativeValue(callback_info->context, value, &_value)) {
    // TODO error
    return ;
  }

  native_ptr->set_size(_value);

}

// get property
JswValue _jsw_var_foo_get_age (
    const JswPropertyCallbackInfo* callback_info,
    JswValue* pexception) {
  auto* native_ptr = ModuleFrom(callback_info);

  return jswrapper::ToJswValue(callback_info->context,
             native_ptr->get_age());

}
// set property
void _jsw_var_foo_set_age (
    const JswPropertyCallbackInfo* callback_info,
    JswValue value,
    JswValue* pexception) {
  auto* native_ptr = ModuleFrom(callback_info);
  js_utils::number_t _value;
  if (!jswrapper::ToNativeValue(callback_info->context, value, &_value)) {
    // TODO error
    return ;
  }

  native_ptr->set_age(_value);

}


// the function implements

static JswValue jsw_func_foo_foo(JswContext* context, const JswFunctionCallbackInfo* callback_info, JswValue* pexecption) {
  jswrapper::NativeArgumentBuilder builder(context, callback_info);

  auto* native_ptr = ModuleFrom(callback_info);

  
  js_utils::number_t _a;
  builder(_a);
  
  js_utils::string_t _b;
  builder(_b);
  
  js_utils::boolean_t _c;
  builder(_c);
  

  
  native_ptr->foo(
  
    
      _a
    
  
    
    , _b
    
  
    
    , _c
    
  
  );

  
  return JswNullValue;
  
}


static JswPropertyDefinition _module_properties[] = {
  
  {
    "haword",
    _jsw_var_foo_get_haword,
    _jsw_var_foo_set_haword,
    0,
  }
  
  {
    "size",
    _jsw_var_foo_get_size,
    _jsw_var_foo_set_size,
    0,
  }
  
  {
    "age",
    _jsw_var_foo_get_age,
    _jsw_var_foo_set_age,
    0,
  }
  
  {0}
};

static JswFunctionDefinition _module_functions[] = {
  
  // function
  {
    "foo",
    jsw_func_foo_foo,
    0,
  },
  
  {0}
};

static JswClassDefinition _module_definition = {
  .class_name = "foo",  
  .constructor = _default_constructor,
  .constructor_data = 0,
  .finalize = nullptr,
  .properties = _module_properties,
  .functions = _module_functions,
};

}  // ns_foo_native

#ifdef USE_NODE_V8
#include <node.h>
#include <map>

static void Initialize(v8::Local<v8::Object> exports,
                       v8::Local<v8::Value> module,
                       v8::Local<v8::Context> context,
                       void* ptr) {
 v8::Isolate* isolate = v8::Isolate::GetCurrent();
 std::map<std::string, JswClass>* pmaps;
 JswVM vm = JswVMFromPlatformHandle(reinterpret_cast<JswPlatformHandle>(isolate));
 if (vm == nullptr) {
   pmaps = new std::map<std::string, JswClass>;
   vm = JswVMCreateFromPlatformHandle(
             reinterpret_cast<JswPlatformHandle>(isolate),
             reinterpret_cast<JswUserData>(pmap));

 } else {
   pmaps = reinterpret_cast<std::map<std::string, JswClass>*>(JswVMGetUserData(vm));
 }

 JswScope scope;
 JswVMPushScope(vm, &scope);

 JswClass& module_class = (*pmaps)[_module_functions.class_name];

 if (module_class == nullptr)
 {
   JswVMCreateClass(vm, &_module_definition, nullptr, &module_class);
 }

 JswContext jswcontext;
 JswObject module_object;

 JswGetContextFromPlatformHandle(*context, &jswcontext);
 
 JswContextNewObjectWithConstructor(jswcontext,
                                    module_class,
                                    0, nullptr, // argc, argv
                                    &module_object,
                                    nullptr); // pexception

 JswObject jsw_exports = reinterpret_cast<JswObject*>(*exports);
 JswString default_str;
 JswContextNewUtf8String(jswcontext, "default", &default_str);

 JswObjectSetProperty(jswcontext, jsw_exports, default_str, module_object); 

 JswVMPopScope(vm, scope);
}

NODE_MODULE_CONTEXT_AWARE(NODE_MODULE_CONTEXT_AWARE, Initialize)

#endif
