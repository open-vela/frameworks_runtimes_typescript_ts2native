/// <reference types="node" />

const path = require('path');
const fs = require('fs');

import * as ts from "typescript";
import { operatorString } from './compiler';

import {
  debug,
  is_debug,
  DumpWriter,
  CreateDumpWriter
} from './debug';

import {
  Writer,
  ModuleNode,
  VarNode,
  ClassNode,
  FunctionLikeNode,
  MethodNode,
  FunctionNode,
  MemberNode,
  ModuleInitializeNode,
  SemanticsNode,
  NamedNode,

  SemanticsType,
  StorageScope,

  ValueTypeKind,
  ValueType,

  ValueKind,
  Value,
  NoneValue,
  VarValue,
  ParameterValue,
  LiterialValue,
  FunctionValue,
  FunctionCallValue,
  BinaryOpValue,
  PropertyAccessValue,
  ReturnValue,
  StroageValue
} from './resolver';

function GetValueStorage(value: StroageValue) : string {
  let storage = '';
  switch(value.storage) {
    case StorageScope.kGlobal:
      storage = '__rt->std_module->values';
      break;
    case StorageScope.kModule:
      switch(value.kind) {
        case ValueKind.kFunction:
          storage = '__module->functions';
	  break;
	case ValueKind.kVar:
          storage = '__module->values';
	  break;
      }
      break;
    case StorageScope.kParameter:
      storage = '__params';
      break;
    case StorageScope.kLocal:
      storage = '__locals';
      break;
    case StorageScope.kTemporary:
      storage = '__temporary';
      break;
    case StorageScope.kClosure:
      storage = 'ts_closure_data(self)';
      break;
    case StorageScope.kReturn:
      storage = '__ret';
      break;
  }
  return `${storage}[${value.index}]`;
}

function GetFunctionObject(v: StroageValue) : string {
  let s = GetValueStorage(v);
  if (v.kind == ValueKind.kFunction &&
       (v.storage == StorageScope.kModule || v.storage == StorageScope.kGlobal)) {
    return s;
  }
  return `${s}.object`;
}

const ValueKindsHasSubType = [ValueKind.kVar, ValueKind.kParameter, ValueKind.kReturn];

function GetSubValueFromKind(kind: ValueTypeKind) : string {
  let subvalue = '';
  switch(kind) {
    case ValueTypeKind.kInt:
      subvalue = '.ival';
      break;
    case ValueTypeKind.kNumber:
      subvalue = '.dval';
      break;
    case ValueTypeKind.kBoolean:
      subvalue = '.ival';
      break;
    case ValueTypeKind.kAny:
      subvalue = '/*Any*/';
      break;
    default:
      subvalue = '.object';
      break;
  }
  return subvalue;
}

function GetValueSubValue(value: Value) : string {
  if (ValueKindsHasSubType.indexOf(value.kind) < 0) {
    return `/*kind:${ValueKind[value.kind]}*/`; // don't change any
  }

  return GetSubValueFromKind(value.type.kind);
}

function EscapeString(s: string) : string {
  return s; // TODO
}

function CastTo(to: Value, from: Value, code: string) : string {
  if (to.kind == from.kind && to.type.kind == from.type.kind) return code;

  debug(`to: {kind: ${ValueKind[to.kind]}, type: ${ValueTypeKind[to.type.kind]}, from: {kind: ${ValueKind[from.kind]}, type: ${ValueTypeKind[from.type.kind]}}`);

  switch(to.type.kind) {
    case ValueTypeKind.kInt:
      switch(from.type.kind) {
        case ValueTypeKind.kNumber: return `(int)(${code}${GetValueSubValue(from)})`;
	case ValueTypeKind.kBoolean: return `${code}${GetValueSubValue(from)}`;
	case ValueTypeKind.kAny: return `${code}${GetValueSubValue(to)}`;
	case ValueTypeKind.kString:
	  if (from.kind == ValueKind.kLiteral) return `atoi(${code})`;
	  //fall through
	case ValueTypeKind.kArray:
	case ValueTypeKind.kMap:
	case ValueTypeKind.kSet:
	case ValueTypeKind.kObject: {
          return `ts_object_to_int(${code}.object, 0)` 
	}
	default:
	  return code;
      }
      break;
    case ValueTypeKind.kNumber: 
      switch(from.type.kind) {
        case ValueTypeKind.kInt: return `(double)(${code}${GetValueSubValue(from)})`;
        case ValueTypeKind.kNumber: return `${code}${GetValueSubValue(from)}`;
	case ValueTypeKind.kBoolean: return `(double)((${code}${GetValueSubValue(from)} == 0 ? 0 : 1.0))`;
	case ValueTypeKind.kAny: return `${code}${GetValueSubValue(to)}`;
	case ValueTypeKind.kString:
          if (from.kind == ValueKind.kLiteral) return `strtod(${code}, NULL)`;
	case ValueTypeKind.kArray:
	case ValueTypeKind.kMap:
	case ValueTypeKind.kSet:
        case ValueTypeKind.kObject: {
          return `ts_object_to_number(${code}.object, 0.0)`;
	}
      } 
      break;
    case ValueTypeKind.kString:
      if (from.kind == ValueKind.kLiteral) {
	if (from.type.kind == ValueTypeKind.kString)
          return `TS_STRING_NEW_STACK(__rt, ${code})`
        else
          return `TS_STRING_NEW_STACK(__rt, "${EscapeString(code)}")`
      }
      switch(from.type.kind) {
        case ValueTypeKind.kInt: return `ts_string_from_int(__rt, ${code}.ival)`;
	case ValueTypeKind.kNumber: return `ts_string_from_double(__rt, ${code}.dval})`;
	case ValueTypeKind.kBoolean: return `ts_string_from_boolean(__rt, ${code}.ival})`;
	case ValueTypeKind.kString:
	case ValueTypeKind.kAny: return `${code}.object`;
	default: return `ts_object_to_string(${code}.object)`;
      }
      break;
    case ValueTypeKind.kAny:
    case ValueTypeKind.kArray:
    case ValueTypeKind.kMap:
    case ValueTypeKind.kSet:
    case ValueTypeKind.kObject:
     switch(from.type.kind) {
       case ValueTypeKind.kInt: return `TS_INT32_NEW_STACK(__rt, ${code}${GetValueSubValue(from)})`;
       case ValueTypeKind.kNumber: return `TS_DOUBLE_NEW_STACK(__rt, ${code}${GetValueSubValue(from)})`;
       case ValueTypeKind.kString: return `TS_STRING_NEW_STACK(__rt, ${code}${GetValueSubValue(from)})`;
       case ValueTypeKind.kBoolean: return `TS_BOOLEAN_NEW_STACK(__rt, ${code}${GetValueSubValue(from)})`;
       default: return `${code}.object`;
     }
     break;
  }
  return `${code}${GetValueSubValue(from)}`;
}

function GetLeftValueSubValue(left: Value, right: Value) {
  if (left.type.kind == ValueTypeKind.kAny) {
    //return GetSubValueFromKind(right.type.kind);
    return '.object';
  }

  return GetValueSubValue(left);
}

function BuildOperatorCode(op: ts.SyntaxKind, left_value: Value, left: string, right_value: Value, right: string) : string {
  switch(op) {
    case ts.SyntaxKind.EqualsToken:
      return `${left}${GetLeftValueSubValue(left_value, right_value)} = ${CastTo(left_value, right_value, right)}`;
    case ts.SyntaxKind.PlusEqualsToken:
      return `${left}${GetLeftValueSubValue(left_value, right_value)}  += ${CastTo(left_value, right_value, right)}`;
    case ts.SyntaxKind.MinusEqualsToken:
      return `${left}${GetLeftValueSubValue(left_value, right_value)}  -= ${CastTo(left_value, right_value, right)}`;
    case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
      return `squareTo(&(${left}${GetLeftValueSubValue(left_value, right_value)} ), ${right})`;
    case ts.SyntaxKind.AsteriskEqualsToken:
      return `${left}${GetLeftValueSubValue(left_value, right_value)}  *= ${CastTo(left_value, right_value, right)}`;
    case ts.SyntaxKind.SlashEqualsToken:
      return `${left}${GetLeftValueSubValue(left_value, right_value)}  /= ${CastTo(left_value, right_value, right)}`;
    case ts.SyntaxKind.PercentEqualsToken:
      return `${left}${GetLeftValueSubValue(left_value, right_value)}  %= ${CastTo(left_value, right_value, right)}`;
    case ts.SyntaxKind.AmpersandEqualsToken:
      return `${left}${GetLeftValueSubValue(left_value, right_value)}  &= ${CastTo(left_value, right_value, right)}`;
    case ts.SyntaxKind.BarEqualsToken:
      return `${left}${GetLeftValueSubValue(left_value, right_value)}  |= ${CastTo(left_value, right_value, right)}`;
    case ts.SyntaxKind.CaretEqualsToken:
      return `${left}${GetLeftValueSubValue(left_value, right_value)}  ^= ${CastTo(left_value, right_value, right)}`;
    case ts.SyntaxKind.LessThanLessThanEqualsToken:
      return `${left}${GetLeftValueSubValue(left_value, right_value)}  <<= ${CastTo(left_value, right_value, right)}`;
    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
      return '>>>=';
    case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
      return '>>=';
    case ts.SyntaxKind.AsteriskAsteriskToken:
      return '**';
    case ts.SyntaxKind.AsteriskToken:
      return `${left}${GetValueSubValue(left_value)} * ${right}${GetValueSubValue(right_value)} `;
    case ts.SyntaxKind.SlashToken:
      return `${left}${GetValueSubValue(left_value)} / ${right}${GetValueSubValue(right_value)} `;
    case ts.SyntaxKind.PercentToken:
      return `${left}${GetValueSubValue(left_value)}  % ${right}${GetValueSubValue(right_value)} `;
    case ts.SyntaxKind.PlusToken:
      return `${left}${GetValueSubValue(left_value)}  + ${right}${GetValueSubValue(right_value)} `;
    case ts.SyntaxKind.MinusToken:
      return `${left}${GetValueSubValue(left_value)}  - ${right}${GetValueSubValue(right_value)} `;
    case ts.SyntaxKind.CommaToken:
      return `${left}${GetValueSubValue(left_value)} , ${right}${GetValueSubValue(right_value)} `;
    case ts.SyntaxKind.LessThanLessThanToken:
      return `${left}${GetValueSubValue(left_value)}  << ${right}${GetValueSubValue(right_value)} `;
    case ts.SyntaxKind.GreaterThanGreaterThanToken:
      return `${left}${GetValueSubValue(left_value)}  >> ${right}${GetValueSubValue(right_value)} `;
    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
      return '<<<';
    case ts.SyntaxKind.LessThanToken:
      return '<';
    case ts.SyntaxKind.LessThanEqualsToken:
      return '<=';
    case ts.SyntaxKind.GreaterThanToken:
      return '>';
    case ts.SyntaxKind.GreaterThanEqualsToken:
      return '>=';
    case ts.SyntaxKind.InstanceOfKeyword:
      return 'instance of';
    case ts.SyntaxKind.InKeyword:
      return 'in';
    case ts.SyntaxKind.EqualsEqualsToken:
      return '==';
    case ts.SyntaxKind.EqualsEqualsEqualsToken:
      return '===';
    case ts.SyntaxKind.ExclamationEqualsEqualsToken:
      return '!==';
    case ts.SyntaxKind.ExclamationEqualsToken:
      return '!=';
    case ts.SyntaxKind.AmpersandToken:
      return '&';
    case ts.SyntaxKind.BarToken:
      return '|';
    case ts.SyntaxKind.CaretToken:
      return '^';
    case ts.SyntaxKind.AmpersandAmpersandToken:
      return '&&';
    case ts.SyntaxKind.BarBarToken:
      return '||';
    case ts.SyntaxKind.QuestionQuestionToken:
      return '??';
  }

  return '';
}

function GetFunctionImplName(func: FunctionLikeNode) : string {
  const fname = func.name;
  const name = (func.parent as NamedNode).name;
  return `_ts_impl_${name}_${fname}`;
}

function GetFunctionReturnType(func: FunctionLikeNode) : string {
  const rettype = func.returnValueType;

  switch(rettype.kind) {
    case ValueTypeKind.kVoid:
    case ValueTypeKind.kUndefined:
    case ValueTypeKind.kNull:
    case ValueTypeKind.kNever:
      return 'ts_value_void';
    case ValueTypeKind.kInt:
      return 'ts_value_int';
    case ValueTypeKind.kNumber:
      return 'ts_value_double';
    case ValueTypeKind.kString:
    case ValueTypeKind.kArray:
    case ValueTypeKind.kMap:
    case ValueTypeKind.kSet:
    case ValueTypeKind.kObject:
      return 'ts_value_object';
  }

  return 'ts_value_void';
}

function MakeFunctionConstructor(func: FunctionLikeNode) : string {
  if (func.closureDatas.length > 0) {
    // TODO
  }
  return 'NULL';
}

function MakeFunctionDestroy(func: FunctionLikeNode) : string {
  if (func.closureDatas.length > 0) {
    // TODO
  }
  return 'NULL';
}

function MakeFunctionGCVisitor(func: FunctionLikeNode) : string {
  if (func.closureDatas.length > 0) {
    // TODO
  }
  return 'NULL';
}

export class CCodeWriter implements Writer {
  module: ModuleNode;
  outDir: string;
  fdSource: number = 0;

  constructor(outDir: string) {
    this.outDir = outDir;
  }

  makePath(name, ext_name) : string {
    let basename = path.basename(name, '.ts');
    return `${this.outDir}/${basename}.${ext_name}`;
  }

  addSource(source: string) : void {
    fs.writeSync(this.fdSource, source);
  }

  setModule(m: ModuleNode) {
    this.module = m;
    const fileName = (this.module.astNode as ts.SourceFile).fileName;
    const file_path = this.makePath(fileName, 'c');
    this.fdSource = fs.openSync(file_path, "w");
    this.addSource("#include <ts_runtime.h>\n");
    this.addSource("#include <ts_lang.h>\n");
    this.addSource("#include <ts_std.h>\n");
  } 

  writeFunction(func: FunctionLikeNode, values: Value[]) {
    this.addSource(`static int ${GetFunctionImplName(func)}(ts_object_t* self, ts_argument_t __params, ts_return_t __ret) {\n`);
    // add the locals and templates
    if (func.local_count > 0)
      this.addSource(`  ts_value_t __locals[${func.local_count}] = {0};\n`);

    if (func.temporary_count > 0)
      this.addSource(`  ts_value_t __temporary[${func.temporary_count}] = {0};\n`);

    this.addSource(`  register ts_module_t*  __module = ts_module_from_object(self);\n`);
    this.addSource(`  register ts_runtime_t* __rt = __module->runtime;\n`);

    for (const v of values) {
      this.writeValue(v);
    }

    if (values.length > 0 && values[values.length-1].kind != ValueKind.kReturn)
      this.addSource(`  return 0;\n`);
    this.addSource(`}\n`);
  }

  writeValue(value: Value) {
    this.addSource(`  ${this.buildValue(value)};\n`);
  }

  buildValue(value: Value) : string {
    switch(value.kind) {
      case ValueKind.kVar:
        return this.buildVarValue(value as VarValue);
      case ValueKind.kLiteral:
        return this.buildLiteralValue(value as LiterialValue);
      case ValueKind.kBinaryOp:
	return this.buildBinaryOpValue(value as BinaryOpValue);
      case ValueKind.kCall:
	return this.buildCallValue(value as FunctionCallValue);
      case ValueKind.kParameter:
        return this.buildParameterValue(value as ParameterValue);
      case ValueKind.kReturn:
	return `return ${(value as ReturnValue).retCode}`;
      //case ValueKind.kPropertyAccess:
      //  return this.buildPropertyAccessValue(value as PropertyAccessValue);
    }
    return '';
  }

  buildVarValue(v: VarValue) : string {
    return GetValueStorage(v);
  }

  buildLiteralValue(v: LiterialValue) : string {
    switch(v.type.kind) {
      case ValueTypeKind.kNumber:
      case ValueTypeKind.kInt:
        return `${v.value}`;
      case ValueTypeKind.kString:
	return `"${EscapeString(v.value as string)}"`;
    }
    return '';
  }

  buildBinaryOpValue(v: BinaryOpValue) : string {
    return BuildOperatorCode(v.op, v.left, this.buildValue(v.left), v.right, this.buildValue(v.right));
  }

  buildCallValue(v: FunctionCallValue) : string {
    let call_str = '';
    if (v.self.kind == ValueKind.kFunction) {
      call_str = `ts_function_call(${GetFunctionObject(v.self as FunctionValue)}`;
    } else if (v.self.kind == ValueKind.kPropertyAccess) {
      const p = v.self as PropertyAccessValue;
      call_str = `ts_method_call(${GetFunctionObject(p.thiz as VarValue)}, ts_method_last + ${p.member.index}`;
    }

    return `${call_str}, &__temporary[${v.param_start}], &${GetValueStorage(v.ret as VarValue)})`;
  }

  buildParameterValue(v: ParameterValue) : string {
    return BuildOperatorCode(ts.SyntaxKind.EqualsToken, v, GetValueStorage(v), v.value, this.buildValue(v.value));
  }

  finish() {
    // write functions, class and module

    for (const c of this.module.classes) {
      this.writeClassDefine(c);
    }

    for (const f of this.module.functions) {
      this.writeFunctionDefine(f);
    }

    this.writeModuleDefine();
  }


  writeFunctionDefine(f: FunctionLikeNode) {
    this.addSource(`static TS_FUNCTIONLIKE_CLOSURE_VTABLE_DEF(\n`);
    this.addSource(`        ${f.name},\n`);
    this.addSource(`        ${GetFunctionImplName(f)},\n`)
    this.addSource(`        ts_object_function,\n`)
    this.addSource(`        ${GetFunctionReturnType(f)},\n`);
    this.addSource(`        ${f.closureDatas.length},\n`);
    this.addSource(`        ${MakeFunctionConstructor(f)}, /*constructor*/\n`);
    this.addSource(`        ${MakeFunctionDestroy(f)}, /*destroy*/\n`);
    this.addSource(`        ${MakeFunctionGCVisitor(f)} /*gc_vsisitor*/\n`)
    this.addSource(`  );\n`);
  }

  writeClassDefine(c: ClassNode) {

  }

  writeModuleDefine() {
    const m = this.module;
    this.addSource(`static TS_VTABLE_DEF(_${m.name}_vt, 1) = {\n`);
    this.addSource(`  TS_MODULE_VTABLE_BASE(\n`);
    this.addSource(`    TS_MODULE_SIZE(0/*imports*/, ${m.vars.length}, `);
    this.addSource(`${m.functions.length}, ${m.classes.length + m.functions.length}, 0/*interfaces*/),\n`);
    this.addSource(`    "${EscapeString(m.name)}",\n`);
    this.addSource(`    0,\n`);
    this.addSource(`    1, /*member count*/\n`);
    this.addSource(`    NULL, /*constrcutor*/\n`);
    this.addSource(`    NULL, /*destroy*/\n`);
    this.addSource(`    NULL, /*to_string*/\n`);
    this.addSource(`    NULL), /*gc_visit*/\n`);
    this.addSource(`  {\n`);
    this.addSource(`    {.method = ${GetFunctionImplName(m.initialize)}}\n`);
    this.addSource(`  }\n`);
    this.addSource(`};\n`);


    this.addSource(`TS_EXTERN ts_module_t* _${m.name}_module(ts_runtime_t* runtime) {\n`);
    this.addSource(`  ts_module_t* m = ts_new_module(runtime, &_${m.name}_vt.base,`);
    this.addSource(`0/*imports*/,`);
    this.addSource(`${m.vars.length}/*vars*/,`);
    this.addSource(`${m.functions.length}/*functions*/,`);
    this.addSource(`${m.functions.length + m.classes.length}/*classes*/,`);
    this.addSource(`0/*interfaces*/);\n`);

    let i = 0;
    for (i = 0; i < m.vars.length; i++) {
      this.addSource(`  m->values[${i}].lval = 0;\n`);
    }

    for (i = 0; i < m.classes.length; i++) {
      const c = m.classes[i];
      this.addSource(`  ts_init_vtable_env(&m->classes[${i}], &_${c.name}_vt.base, m, NULL);\n`);
    }

    let k = 0;
    for (const f of m.functions) {
      this.addSource(`  ts_init_vtable_env(&m->classes[${i}], &_${f.name}_vt.base, m, NULL);\n`);
      this.addSource(`  m->functions[${k++}] = ts_new_object(runtime, &m->classes[${i++}], NULL);\n`);
    }

    this.addSource(`  return m;\n`);
    this.addSource('}');
  }
}
