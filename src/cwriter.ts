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
  FieldNode,
  FunctionNode,
  MemberNode,
  ModuleInitializeNode,
  SemanticsNode,
  NamedNode,
  EnumNode,
  EnumMemberNode,

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
  StroageValue,
  NewValue,
  EnumValue,
  ElementAccessValue,
  BuildStringValue,
  IsStroageValue,
  IfValue,
  ThenValue,
  ElseValue,
  WhileValue,
  DoWhileValue,
  SwitchValue,
  CaseValue,
  UnaryOpValue,
} from './resolver';

function GetModuleValue(value: StroageValue) : string {
  switch(value.kind) {
    case ValueKind.kVar: return "values";
    case ValueKind.kClass: return "classes";
    case ValueKind.kFunction: return "functions";
    case ValueKind.kInterface: return "interfaces";
    case ValueKind.kEnum: return "enums";
  }
  return '';
}

function GetValueStorage(value: StroageValue) : string {
  let storage = '';
  switch(value.storage) {
    case StorageScope.kGlobal:
      storage = `__rt->std_module->${GetModuleValue(value)}`;
      break;
    case StorageScope.kModule:
      storage = `__module->${GetModuleValue(value)}`;
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

function GetObjectValue(v: Value) : string {
  if (v.kind == ValueKind.kThis) return 'self';

  if (IsStroageValue(v)) {
    return `${GetValueStorage(v as VarValue)}.object`;
  }
  return '';
}

const ValueKindsHasSubType = [ValueKind.kVar, ValueKind.kParameter, ValueKind.kReturn];
const BranchValueKind = [ValueKind.KIf, ValueKind.KElse, ValueKind.KThen, ValueKind.KWhile, 
                         ValueKind.KDoWhile, ValueKind.KSwitch, ValueKind.KCase];
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
      //subvalue = '/*Any*/';
      //break;
    default:
      subvalue = '.object';
      break;
  }
  return subvalue;
}

function GetCTypeFromValueType(kind: ValueTypeKind) : string {
  switch(kind) {
    case ValueTypeKind.kInt:    return `int`;
    case ValueTypeKind.kNumber: return 'double';
    case ValueTypeKind.kBoolean: return 'ts_boolean_t';
    case ValueTypeKind.kString:
    default:
      if (IsObjectValueType(kind))
        return 'ts_object_t*';
      return 'void';
  }
}

function IsObjectValueType(kind: ValueTypeKind) {
  switch(kind) {
    case ValueTypeKind.kString:
    case ValueTypeKind.kAny:
    case ValueTypeKind.kObject:
    case ValueTypeKind.kFunction:
    case ValueTypeKind.kMap:
    case ValueTypeKind.kSet:
    case ValueTypeKind.kUnion:
      return true;
  }
  return false;
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
        case ValueTypeKind.kObject:
          if (IsStroageValue(from)) return `ts_object_to_number(${code}.object, 0.0)`;
    default:
          return code;
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
        case ValueTypeKind.kNumber: return `ts_string_from_double(__rt, ${code}.dval)`;
        case ValueTypeKind.kBoolean: return `ts_string_from_boolean(__rt, ${code}.ival)`;
        case ValueTypeKind.kString:
        case ValueTypeKind.kAny: return `${code}.object`;
        default:
          if (IsStroageValue(from)) return `ts_object_to_string(${code}.object)`;
            return `ts_object_to_string(${code})`;
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
       case ValueTypeKind.kString: return `${code}${GetValueSubValue(from)}`;
       case ValueTypeKind.kBoolean: return `TS_BOOLEAN_NEW_STACK(__rt, ${code}${GetValueSubValue(from)})`;
       default:
         if (IsStroageValue(from)) return `${code}.object`;
         return code;
     }
     break;
  }
  return `${code}${GetValueSubValue(from)}`;
}

function GetLeftValueSubValue(left: Value, right?: Value) {
  if (left.type.kind == ValueTypeKind.kAny) {
    //return GetSubValueFromKind(right.type.kind);
    return '.object';
  }

  return GetValueSubValue(left);
}
function BuildUnaryOperatorCode(op: ts.SyntaxKind, operand: string, operand_value: Value, isPrefix: boolean){
  switch (op){
    case ts.SyntaxKind.PlusPlusToken:
      if(isPrefix){
        return `++${operand}${GetLeftValueSubValue(operand_value)}`;
      }
      
      return `${operand}${GetLeftValueSubValue(operand_value)}++`;
    case ts.SyntaxKind.MinusMinusToken:
      if(isPrefix){
        return `--${operand}${GetLeftValueSubValue(operand_value)}`;
      }
      return `${operand}${GetLeftValueSubValue(operand_value)}--`;
    case ts.SyntaxKind.PlusToken:
      return `+${operand}${GetLeftValueSubValue(operand_value)}`;
    case ts.SyntaxKind.MinusToken:
      return `-${operand}${GetLeftValueSubValue(operand_value)}`;
    case ts.SyntaxKind.TildeToken:  
      //return `~${operand}${GetLeftValueSubValue(operand_value)}`;
    case ts.SyntaxKind.ExclamationToken: 
    //return `!${operand}${GetLeftValueSubValue(operand_value)}`;
  }
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
      return `${left}${GetValueSubValue(left_value)} = (uint64_t)${left}${GetValueSubValue(left_value)}  >> ${right}${GetValueSubValue(right_value)} `;
    case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
      return '>>=';
    case ts.SyntaxKind.AsteriskAsteriskToken:
      return `powl(${left}${GetLeftValueSubValue(left_value, right_value)}, ${right})`;
    case ts.SyntaxKind.AsteriskToken:
      return `${left}${GetValueSubValue(left_value)} * ${right}${GetValueSubValue(right_value)} `;
    case ts.SyntaxKind.SlashToken:
      return `${left}${GetValueSubValue(left_value)} / ${right}${GetValueSubValue(right_value)} `;
    case ts.SyntaxKind.PercentToken:
      return `fmod(${left}${GetLeftValueSubValue(left_value, right_value)}, ${right})`;
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
      return `(uint64_t)${left}${GetValueSubValue(left_value)}  >> ${right}${GetValueSubValue(right_value)} `;
    case ts.SyntaxKind.LessThanToken:
      if(left_value.type.kind == ValueTypeKind.kString){
        return `strcmp(${left}${GetValueSubValue(left_value)}, ${right}${GetValueSubValue(right_value)}) < 0`;
      }
      return `${left}${GetValueSubValue(left_value)}  < ${right}${GetValueSubValue(right_value)}`;
    case ts.SyntaxKind.LessThanEqualsToken:
      return '<=';
    case ts.SyntaxKind.GreaterThanToken:
      if(left_value.type.kind == ValueTypeKind.kString){
        return `strcmp(${left}${GetValueSubValue(left_value)}, ${right}${GetValueSubValue(right_value)}) > 0`;
      }
      return `${left}${GetValueSubValue(left_value)}  > ${right}${GetValueSubValue(right_value)}`;
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
      return `(int64_t)${left}${GetLeftValueSubValue(left_value, right_value)}^(int64_t)${right}`;
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
  return GetTSValueType(rettype.kind);
}

function GetTSValueType(kind: ValueTypeKind) : string {
  switch(kind) {
    case ValueTypeKind.kVoid:
    case ValueTypeKind.kUndefined:
    case ValueTypeKind.kNull:
    case ValueTypeKind.kNever:
      return 'ts_value_void';
    case ValueTypeKind.kInt:
      return 'ts_value_int';
    case ValueTypeKind.kNumber:
      return 'ts_value_double';
    case ValueTypeKind.kBoolean:
      return 'ts_value_boolean';
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
  clazz?: ClassNode;
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

    this.buildEnumDefines();
  }

  setClass(c: ClassNode) {
    this.clazz = c;
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
    if(BranchValueKind.indexOf(value.kind) > 0){
      this.addSource(`  ${this.buildValue(value)}\n`);
    }
    else{
      this.addSource(`  ${this.buildValue(value)};\n`);
    }
  }

  buildValue(value: Value) : string {
    console.log(`== buildValue: kind: ${ValueKind[value.kind]}`);
    switch(value.kind) {
      case ValueKind.kVar:
        return this.buildVarValue(value as VarValue);
      case ValueKind.kLiteral:
        return this.buildLiteralValue(value as LiterialValue);
      case ValueKind.kBinaryOp:
        return this.buildBinaryOpValue(value as BinaryOpValue);
      case ValueKind.KUnaryOp:
        return this.buildUnaryOpValue(value as UnaryOpValue);
      case ValueKind.kCall:
        return this.buildCallValue(value as FunctionCallValue);
      case ValueKind.kParameter:
        return this.buildParameterValue(value as ParameterValue);
      case ValueKind.kReturn:
        return `return ${(value as ReturnValue).retCode}`;
      case ValueKind.kThis:
        return 'self';
      case ValueKind.kNew:
        return this.buildNew(value as NewValue);
      case ValueKind.kPropertyAccess:
        return this.buildPropertyAccessValue(value as PropertyAccessValue);
      case ValueKind.kElementAccess:
        return this.buildElementAccess(value as ElementAccessValue);
      case ValueKind.KIf:
        return this.buildIfValue(value as IfValue);
      case ValueKind.KThen:
        return `}`
      case ValueKind.KElse:
        return this.buildElseValue(value as ElseValue);
      case ValueKind.KWhile:
        return this.buildWhileValue(value as WhileValue);
      case ValueKind.KDoWhile:
        return this.buildDoWhileValue(value as DoWhileValue);
      case ValueKind.KSwitch:
        return this.buildSwitchValue(value as SwitchValue);
      case ValueKind.KCase:
        return this.buildCaseValue(value as CaseValue);
      case ValueKind.KBreak:
        return `break`;
      case ValueKind.kStringBuilder:
        return this.buildStringBuilder(value as BuildStringValue);
    }
    return '';
  }

  buildStringBuilder(v: BuildStringValue) : string {
    const builder_var = GetValueStorage(v.outValue);
    let s = `ts_string_builder_new(&${builder_var}, "${EscapeString(v.head)}");`;
    for (const span of v.spans) {
      const expr = this.buildValue(span.value);
      let build_type = 'add_object';
      switch(span.value.type.kind) {
        case ValueTypeKind.kNumber:
          build_type = 'add_number';
          break;
        case ValueTypeKind.kBoolean:
          build_type = 'add_boolean';
          break;
        case ValueTypeKind.kString:
          if (span.value.kind == ValueKind.kLiteral)
            build_type = 'add_cstr';
          break;
      }
      s += `ts_string_builder_${build_type}(&${builder_var}, ${expr});`;
      s += `ts_string_builder_add_cstr(&${builder_var}, "${EscapeString(span.literal)}");`;
    }
    s += `ts_string_builder_end(&${builder_var});`;
    return s;
  }

  buildVarValue(v: VarValue) : string {
    return GetValueStorage(v);
  }

  buildNew(v: NewValue) : string {
    if (v.param_start >= 0) {
      return `ts_new_object(__rt, &${GetValueStorage(v.clazzValue)}, &__temporary[${v.param_start}])`;
    } else {
      return `ts_new_object(__rt, &${GetValueStorage(v.clazzValue)}, NULL)`;
    }
  }

  buildPropertyAccessValue(v: PropertyAccessValue) : string {
    const m = v.member;
    if (m.kind == SemanticsType.kField) {
      let member_offset = '';
      const f = m as FieldNode;
      console.log(`field: ${f.name} offset32: ${f.offset32}, offset64: ${f.offset64}`);
      if (f.offset32 >= 0) {
        // TODO get super size
        const super_size = `sizeof(ts_object_t)`;
        member_offset = `TS_OFFSET(void, ${GetObjectValue(v.thiz)}, ${super_size} + TS_SIZE_32_64(${f.offset32}, ${f.offset64}))`
      } else {
        member_offset = `ts_field_of(${GetObjectValue(v.thiz)}, ${f.index})`;
      }

      return `(*((${GetCTypeFromValueType(f.type.kind)}*)${member_offset}))`;
    } else if (m.kind == SemanticsType.kEnumMember) {
      return `enum_member_${(m.parent as EnumNode).name}_${(m as EnumMemberNode).name}`;
    }
    return '';
  }

  buildElementAccess(v: ElementAccessValue) : string {
    if (v.element.kind == ValueKind.kEnum) {
      return `${GetValueStorage(v.element as EnumValue)}(__rt, (uintptr_t)(${this.buildValue(v.argument)}))`;
    }

    // TODO

    return '';
  }

  buildLiteralValue(v: LiterialValue) : string {
    switch(v.type.kind) {
      case ValueTypeKind.kNumber:
      case ValueTypeKind.kInt:
        return `${v.value}`;
      case ValueTypeKind.kBoolean:
    return `${v.value as boolean ? 'ts_true' : 'ts_false'}`;
      case ValueTypeKind.kString:
    return `"${EscapeString(v.value as string)}"`;
    }
    return '';
  }
  buildUnaryOpValue(v: UnaryOpValue) : string{
    return BuildUnaryOperatorCode(v.op, this.buildValue(v.operand), v.operand, v.isPrefix);
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
  // TODO align
  buildIfValue(v: IfValue): string{
    console.log("buildIfValue");
    let expr : string = `${this.buildValue(v.expr)}${GetLeftValueSubValue(v.expr, v.expr)}`;
    return `if(${expr}){`;
  }
  buildElseValue(v: ElseValue): string{
    if(v.start){
      return `else{`;
    }
    return `}`;
  }
  buildWhileValue(v: WhileValue): string{
    if(v.start){
      const expr = `${this.buildValue(v.expr)}${GetLeftValueSubValue(v.expr, v.expr)}`;
      return `while(${expr}){`;
    }
    else{
      return '}';
    }
  }
  buildDoWhileValue(v: DoWhileValue): string{
    if(v.start){
      return `do{`;
    }
    else{
      const expr = `${this.buildValue(v.expr)}${GetLeftValueSubValue(v.expr, v.expr)}`;
      return `}while(${expr});`
    }
  }
  buildSwitchValue(v: SwitchValue): string{
    if(v.start){
      const expr = `${this.buildValue(v.expr)}${GetLeftValueSubValue(v.expr, v.expr)}`;
      return `switch(${expr}){`;
    }
    return `}`;
  }
  buildCaseValue(v: CaseValue): string{
    if(v.isDefault){
      return `default:`;
    }
    const expr = `${this.buildValue(v.expr)}${GetLeftValueSubValue(v.expr, v.expr)}`;
    return `case ${expr}:`
  }
  finish() {
    // write functions, class and module

    for (const c of this.module.classes) {
      if (c.kind == SemanticsType.kClass)
        this.writeClassDefine(c);
      else if (c.kind == SemanticsType.kLiteralClass)
    this.writeLiteralClassDefine(c);
      else if (c.kind == SemanticsType.kInterface)
    this.writeInterfaceDefine(c);
    }

    for (const f of this.module.functions) {
      this.writeFunctionDefine(f);
    }

    for (const e of this.module.enums) {
      this.writeEnumRelect(e);
    }

    this.writeModuleDefine();
  }

  buildEnumDefines() {
    for (const e of this.module.enums) {
      for (const m of e.members) {
    if (typeof m.value == 'number')
          this.addSource(`const int enum_member_${e.name}_${m.name} = ${m.value};\n`);
        else
          this.addSource(`const char enum_member_${e.name}_${m.name}[] = "${EscapeString(m.value)}";\n`);
      }
    }
  }

  writeEnumRelect(e: EnumNode) {
    this.addSource(`static const char* enum_reflect_${e.name}(ts_runtime_t* rt, uintptr_t v) {\n`);
    if (e.type.kind == ValueTypeKind.kInt || e.type.kind == ValueTypeKind.kUnion) {
      this.addSource(`  switch((int)v) {\n`);
      for (const m of e.members) {
    if (typeof m.value == 'number')
          this.addSource(`    case ${m.value}: return "${EscapeString(m.name)}";\n`);
      }
      this.addSource(`  }\n`);
    }
    if (e.type.kind == ValueTypeKind.kString || e.type.kind == ValueTypeKind.kUnion) {
      this.addSource(`  const char* str_v = (const char*)v;\n`);
      for (const m of e.members) {
        if (typeof m.value == 'string') {
          this.addSource(`  if (str_v == enum_member_${e.name}_${m.name}
                || strcmp(str_v, enum_member_${e.name}_${m.name}) == 0)\n`);
          this.addSource(`    return "${EscapeString(m.name)}";\n`);
    }
      }
    }
    this.addSource('  return "";\n');
    this.addSource(`}\n`);
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
    const super_size = "sizeof(ts_object_t)"; // TODO super
    this.addSource(`static TS_VTABLE_DEF(_${c.name}_vt, ${c.members.length}) = {\n`);
    this.addSource(`  TS_VTABLE_SUPER_BASE(${super_size} + TS_SIZE_32_64(${c.fieldSize32}, ${c.fieldSize64}),\n`);
    this.addSource(`      "${c.name}",\n`);
    this.addSource(`      NULL/*TODO super*/,\n`);
    this.addSource(`      0/*TODO interface_count*/,\n`);
    this.addSource(`      TS_VTABLE_NEMBER_COUNT(_${c.name}_vt),\n`);
    this.addSource(`      ${c.ctr ? GetFunctionImplName(c.ctr): "NULL"},\n`);
    this.addSource(`      NULL/*TODO destroy*/,\n`);
    this.addSource(`      NULL/*TODO to_str*/,\n`);
    this.addSource(`      NULL/*TODO visitor*/),\n`);
    this.addSource(`  {\n`);
    for (const m of c.members) {
      if (m.kind == SemanticsType.kMethod) {
        this.addSource(`    {.method = (ts_call_t)(${GetFunctionImplName(m as MethodNode)})},\n`);
      } else if (m.kind == SemanticsType.kField) {
    const f = m as FieldNode;
        this.addSource(`    {.field = ${super_size} + TS_SIZE_32_64(${f.offset32}, ${f.offset64})},\n`);
      }
    }
    this.addSource(`  }\n`);
    this.addSource(`};\n`);
  }

  writeLiteralClassMemberNameInfo(c: ClassNode) {
    this.addSource(`static struct { const char* name; int type; } _ts_${c.name}_key_infos[] = {\n`);
    for (const m of c.members) {
      this.addSource(`  {"${m.name}",`);
      if (m.kind == SemanticsType.kMethod) {
        this.addSource(` -1},\n`);
      } else if (m.kind == SemanticsType.kField) {
        this.addSource(` ${GetTSValueType((m as FieldNode).type.kind)}},\n`);
      }
    }
    this.addSource(`};\n`);

    this.addSource(`static int _ts_impl_${c.name}_key_to_index(ts_key_t key) {\n`);
    this.addSource(`  if (key.type == ts_index_key) return key.idx;\n`);
    this.addSource(`  if (key.type == ts_string_key) {\n`);
    this.addSource(`    for (int idx = 0; idx < sizeof(_ts_${c.name}_key_infos) / sizeof(_ts_${c.name}_key_infos[0]); idx++) {\n`);
    this.addSource(`      if (strcmp(_ts_${c.name}_key_infos[idx].name, key.str) == 0)  return idx;\n`)
    this.addSource(`    }\n`);
    this.addSource(`  }\n`);
    this.addSource(`  return -1;\n`);
    this.addSource(`}\n`);
  }


  writeLiteralClassGetter(c: ClassNode) {
    this.addSource(`static int _ts_impl_${c.name}_get_by_key(ts_object_t* self, ts_key_t key, ts_value_t* value) {\n`);
    this.addSource(`  int index = _ts_impl_${c.name}_key_to_index(key);\n`);
    this.addSource(`  if (index < 0) return -1;\n`);

    this.addSource(`  switch(index) {\n`);
    for (const m of c.members) {
      if (m.kind == SemanticsType.kField) {
        const f = m as FieldNode;
        this.addSource(`   case ${f.index}:\n`);
        if (IsObjectValueType(f.type.kind)) {
          this.addSource(`     ts_reset_object(&(value->object), *TS_OFFSET(ts_object_t*, self, sizeof(ts_object_t) + TS_SIZE_32_64(${f.offset32}, ${f.offset64})));\n`);
        } else {
          this.addSource(`     (*value)${GetSubValueFromKind(f.type.kind)} =\n`);
          this.addSource(`       *TS_OFFSET(${GetCTypeFromValueType(f.type.kind)}, self, sizeof(ts_object_t) + TS_SIZE_32_64(${f.offset32}, ${f.offset64}));\n`);
        }
       this.addSource(`     return 0;\n`);
      }
    }
    this.addSource(`    default: return -1;\n  }\n`);

    this.addSource(`  return -1;\n}\n`);
  }

  writeLiteralClassSetter(c: ClassNode) {
    this.addSource(`static int _ts_impl_${c.name}_set_by_key(ts_object_t* self, ts_key_t key, ts_value_t value) {\n`);
    this.addSource(`  int index = _ts_impl_${c.name}_key_to_index(key);\n`);
    this.addSource(`  if (index < 0) return -1;\n`);
    this.addSource(`  switch(index) {\n`);
    for (const m of c.members) {
      if (m.kind == SemanticsType.kField) {
        const f = m as FieldNode;
        this.addSource(`   case ${f.index}:\n`);
        if (IsObjectValueType(f.type.kind)) {
          this.addSource(`     ts_reset_object(TS_OFFSET(ts_object_t*, self, sizeof(ts_object_t) + TS_SIZE_32_64(${f.offset32}, ${f.offset64})), value.object);\n`);
        } else {
          this.addSource(`     *TS_OFFSET(${GetCTypeFromValueType(f.type.kind)}, self, sizeof(ts_object_t) + TS_SIZE_32_64(${f.offset32}, ${f.offset64})) =\n`);
          this.addSource(`       value${GetSubValueFromKind(f.type.kind)};\n`);
        }
        this.addSource(`     return 0;\n`);
      }
    }
    this.addSource(`    default: return -1;\n  }\n`);

    this.addSource(`  return -1;\n}\n`);
  }

  writeLiteralClassKeyIterator(c: ClassNode) {
    this.addSource(`static int _ts_impl_${c.name}_iterator_next(ts_object_t* self, ts_key_iterator_t* it) {\n`);
    this.addSource(`  if (it->indexKey < 0) it->indexKey = 0;\n`);
    this.addSource(`  else it->indexKey ++;\n`);
    this.addSource(`  if (it->indexKey >= (int)sizeof(_ts_${c.name}_key_infos)/sizeof(_ts_${c.name}_key_infos[0])) return 0;\n`);
    this.addSource(`  it->strKey = _ts_${c.name}_key_infos[it->indexKey].name;\n`);
    this.addSource(`  it->type = _ts_${c.name}_key_infos[it->indexKey].type;\n`);
    this.addSource(`  return 1;\n`);

    this.addSource(`}\n`);
  }

  writeLiteralClassDefine(c: ClassNode) {
    this.writeLiteralClassMemberNameInfo(c);
    this.writeLiteralClassGetter(c)
    this.writeLiteralClassSetter(c)
    this.writeLiteralClassKeyIterator(c)
    const super_size = "sizeof(ts_object_t)"; // TODO super

    this.addSource(`static TS_VTABLE_DEF(_${c.name}_vt, 0) = {\n`);
    this.addSource(`  {\n`);
    this.addSource(`    TS_VTABLE_THIS_INTERFACE_ENTRY,\n`);
    this.addSource(`    "${c.name}",\n`);
    this.addSource(`    NULL,/*super*/\n`);
    this.addSource(`    sizeof(ts_object_t) + TS_SIZE_32_64(${c.fieldSize32},${c.fieldSize64}),\n`);
    this.addSource(`    0,/*interface count*/\n`);
    this.addSource(`    ts_object_object,\n`);
    this.addSource(`    ts_value_void,\n`);
    this.addSource(`    0,/*member count*/\n`);
    this.addSource(`    NULL,/*ctr*/\n`);
    this.addSource(`    NULL,/*TODO destroy*/\n`);
    this.addSource(`    NULL,/*TODO to_str*/\n`);
    this.addSource(`    NULL,/*TODO visitor*/\n`);
    this.addSource(`    _ts_impl_${c.name}_get_by_key,\n`);
    this.addSource(`    _ts_impl_${c.name}_set_by_key,\n`);
    this.addSource(`    NULL/*call by key*/,\n`);
    this.addSource(`    _ts_impl_${c.name}_iterator_next,\n`);
    this.addSource(`  },\n`);
    this.addSource(` {\n`);
    for (const m of c.members) {
      if (m.kind == SemanticsType.kMethod) {
        this.addSource(`    {.method = (ts_call_t)(${GetFunctionImplName(m as MethodNode)})},\n`);
      } else if (m.kind == SemanticsType.kField) {
    const f = m as FieldNode;
        this.addSource(`    {.field = ${super_size} + TS_SIZE_32_64(${f.offset32}, ${f.offset64})},\n`);
      }
    }
    this.addSource(`  }\n`);
    this.addSource(`};\n`);
  }

  writeInterfaceDefine(c: ClassNode) {

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
    this.addSource(`  ts_module_t* m = ts_new_module_ex(runtime, &_${m.name}_vt.base,`);
    this.addSource(`0/*imports*/,`);
    this.addSource(`${m.vars.length}/*vars*/,`);
    this.addSource(`${m.functions.length}/*functions*/,`);
    this.addSource(`${m.functions.length + m.classes.length}/*classes*/,`);
    this.addSource(`0/*interfaces*/,\n`);
    this.addSource(`${m.enums.length}/*enums*/);\n`);

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


    i = 0;
    for (const e of m.enums) {
      this.addSource(`  m->enums[${i++}] = enum_reflect_${e.name};\n`);
    }

    this.addSource(`  return m;\n`);
    this.addSource('}');
  }
}
