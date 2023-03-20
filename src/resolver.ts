/// <reference types="node" />

import * as ts from "typescript";
import {
  debug,
  is_debug,
  DumpWriter,
  CreateDumpWriter
} from './debug';

const path = require('path');

import {compileFiles, nodeToString} from './compiler';

function normalize_name(name: string) : string {
  let ret = path.parse(name);
  return ret.name;
}

export enum ValueTypeKind {
  kVoid,
  kUndefined,
  kNull,
  kNever,
  kInt,
  kNumber,
  kBoolean,
  kString,
  kAny,
  kArray,
  kObject,
  kFunction,
  kMap,
  kSet,
  kUnion,
  kDynamic
}

export interface ValueType {
  readonly kind: ValueTypeKind;
}

export interface ArrayValueType extends ValueType {
  readonly kind: ValueTypeKind.kArray;
  element: ValueType;
}

export interface MapValueType extends ValueType {
  readonly kind: ValueTypeKind.kMap;
  key: ValueType;
  value: ValueType;
}

export interface SetValueType extends ValueType {
  readonly kind: ValueTypeKind.kSet;
  element: ValueType;
}

export interface ObjectValueType extends ValueType {
  readonly kind: ValueTypeKind.kObject;
  clazz: ClassLikeNode;
}

export interface FunctionValueType extends ValueType {
  readonly kind: ValueTypeKind.kFunction;
  function: FunctionLikeNode;
}

export interface UnionValueType extends ValueType {
  readonly kind: ValueTypeKind.kUnion;
  types: ValueType[];
}

function IsValueTypeEqual(v1: ValueType, v2: ValueType) : boolean {
  if (v1.kind != v2.kind) return false;

  switch(v1.kind) {
    case ValueTypeKind.kArray:
      return IsValueTypeEqual((v1 as ArrayValueType).element, (v2 as ArrayValueType).element);
    case ValueTypeKind.kSet:
      return IsValueTypeEqual((v1 as SetValueType).element, (v2 as SetValueType).element);
    case ValueTypeKind.kMap:
      return IsValueTypeEqual((v1 as MapValueType).key, (v2 as MapValueType).key)
          && IsValueTypeEqual((v1 as MapValueType).value, (v2 as MapValueType).value);
    case ValueTypeKind.kObject:
      return (v1 as ObjectValueType).clazz.equals((v2 as ObjectValueType).clazz);

    case ValueTypeKind.kUnion:
      {
        const types1 = (v1 as UnionValueType).types;
        const types2 = (v2 as UnionValueType).types;
        const set1 = new Set<ValueType>();
        for (const t of types1)
          set1.add(t);
          for (const t of types2) {
            for (const s of set1) {
              if (IsValueTypeEqual(t, s)) {
                set1.delete(s);
            break;
          }
        }
        return false;
      }
      if (set1.size == 0)
          return true;
    }
    break;
  }

  return true;
}

export const PrimitiveValueType = {
  Void:         {kind: ValueTypeKind.kVoid},
  Undefined:    {kind: ValueTypeKind.kUndefined},
  Null:         {kind: ValueTypeKind.kNull},
  Never:        {kind: ValueTypeKind.kNever},
  Int:          {kind: ValueTypeKind.kInt},
  Number:       {kind: ValueTypeKind.kNumber},
  Boolean:      {kind: ValueTypeKind.kBoolean},
  String:       {kind: ValueTypeKind.kString},
  Any:          {kind: ValueTypeKind.kAny},
  Dynamic:      {kind: ValueTypeKind.kDynamic},
}

export const IntStringUnion : UnionValueType = {
  kind: ValueTypeKind.kUnion,
  types: [
    PrimitiveValueType.Int,
    PrimitiveValueType.String
  ]
}

export const VoidOrAnyValueType: UnionValueType = {kind: ValueTypeKind.kUnion, types: [ PrimitiveValueType.Void,  PrimitiveValueType.Any]};
export const PrimitiveArrayValueType : ArrayValueType[] = [
  {kind: ValueTypeKind.kArray, element: PrimitiveValueType.Any},
  {kind: ValueTypeKind.kArray, element: PrimitiveValueType.Int},
  {kind: ValueTypeKind.kArray, element: PrimitiveValueType.Number},
  {kind: ValueTypeKind.kArray, element: PrimitiveValueType.Boolean},
  {kind: ValueTypeKind.kArray, element: PrimitiveValueType.String},
]

export function getTypeSize(kind: ValueTypeKind) : number[]  {
  switch(kind) {
    case ValueTypeKind.kInt: return [4,4];
    case ValueTypeKind.kNumber: return [8,8];
    case ValueTypeKind.kBoolean: return [1,1];
    case ValueTypeKind.kString:
    case ValueTypeKind.kAny:
    case ValueTypeKind.kObject:
    case ValueTypeKind.kFunction:
    case ValueTypeKind.kMap:
    case ValueTypeKind.kSet:
    case ValueTypeKind.kUnion:
      return [4, 8];
    default:
      return [0, 0];
  }
}

export enum StorageScope {
  kNone,
  kGlobal,
  kModule,
  kParameter,
  kReturn,
  kLocal,
  kClosure,
  kTemporary,
  kLiteral,
  kObject
}

export enum ValueKind {
  kNone,
  kVar,
  kThis,
  kLiteral,
  kBinaryOp,
  kCall,
  kParameter,
  kFunction,
  kClass,
  kInterface,
  kEnum,
  kElementAccess,
  kNew,
  kPropertyAccess,
  kReturn,
  KIf,
  KThen,
  KElse,
  KWhile,
  KDoWhile,
  KSwitch,
  KCase,
  KBreak,
  KUnaryOp,
  kStringBuilder,
}

export class Value {
  readonly kind: ValueKind;
  type: ValueType;

  constructor(kind: ValueKind, type: ValueType) {
    this.kind = kind;
    this.type = type;
  }

  equals(v: Value) : boolean {
    return v.kind == this.kind;
  }
}

export class NoneValue extends Value {
  constructor() {
    super(ValueKind.kNone, PrimitiveValueType.Void);
  }
}

export class VarValue extends Value {
  storage: StorageScope;
  index: number;

  constructor (type: ValueType, storage: StorageScope, index: number) {
    super(ValueKind.kVar, type);
    this.storage = storage;
    this.index = index;
  }

  equals(v: Value) : boolean {
    return (this.kind == v.kind)
         && (this.storage == (v as VarValue).storage)
     && (this.index == (v as VarValue).index);
  }
}

export class ParameterValue extends Value {
  storage: StorageScope;
  index: number;
  value: Value;
  constructor(type: ValueType, index: number, value: Value) {
    super(ValueKind.kParameter, type);
    this.storage = StorageScope.kTemporary;
    this.index = index;
    this.value = value;
  }

  equals(v: Value) : boolean {
    if (super.equals(v)) {
      const p = v as ParameterValue;
      return p.storage == this.storage
           && p.index == this.index
           && this.value.equals(p.value);
    }
    return false;
  }
}

export class ThisValue extends Value {
  constructor(type: ObjectValueType) {
    super(ValueKind.kThis, type);
  }
}

export class LiterialValue extends Value {
  value: any;

  constructor(type: ValueType, value: any) {
    super(ValueKind.kLiteral, type);
    this.value = value;
  }
}

export class FunctionValue extends Value {
  storage: StorageScope;
  index: number;
  func: FunctionLikeNode;

  constructor(func: FunctionLikeNode, storage: StorageScope, index: number) {
    super(ValueKind.kFunction, func.returnValueType);
    this.func = func;
    this.index = index;
    this.storage = storage;
  }
}

export class EnumValue extends Value {
  storage: StorageScope;
  index: number;
  enumNode: EnumNode;

  constructor(en: EnumNode, storage: StorageScope) {
    super(ValueKind.kEnum, en.type);
    this.enumNode = en;
    this.storage = storage;
    this.index = en.index;
  }
}

type FunctionLikeCallKind = ValueKind.kCall | ValueKind.kNew;

export class FunctionLikeCallValue extends Value {
  param_start: number;

  constructor(kind: FunctionLikeCallKind, type: ValueType, start: number) {
    super(kind, type);
    this.param_start = start;
  }
}

export class FunctionCallValue extends FunctionLikeCallValue {
  self: Value;
  ret: Value;

  constructor(funcValue: Value, start: number, ret: Value) {
    super(ValueKind.kCall, ret.type, start);
    this.self = funcValue;
    this.ret = ret;
  }
}

export class ClassValue extends Value {
  storage: StorageScope;
  index: number;

  constructor(clazzType: ObjectValueType) {
    super(ValueKind.kClass, clazzType);
    const clazz = clazzType.clazz;
    this.index = clazz.index;
    this.storage = clazz.parent.kind == SemanticsType.kModule
               ? StorageScope.kModule : StorageScope.kGlobal;
  }
}

export class NewValue extends FunctionLikeCallValue {
  clazzValue: ClassValue;
  constructor(clazzValue: ClassValue, start: number) {
    super(ValueKind.kNew, clazzValue.type, start);
    this.clazzValue = clazzValue;
  }

  getClass() : ClassLikeNode {
    return (this.type as ObjectValueType).clazz;
  }

  static FromClazzType(clazzType: ObjectValueType, start: number) : NewValue {
    return new NewValue(new ClassValue(clazzType), start);
  }
}
export class UnaryOpValue extends Value{
  op: ts.PrefixUnaryOperator | ts.PostfixUnaryOperator;
  operand: Value;
  isPrefix: boolean;
  constructor(op: ts.PrefixUnaryOperator | ts.PostfixUnaryOperator, operand : Value, isPrefix: boolean){
    super(ValueKind.KUnaryOp, operand.type);  // to do
    this.op = op;
    this.operand = operand;
    this.isPrefix = isPrefix;
  }
}
export class BinaryOpValue extends Value {
  op: ts.BinaryOperator;
  left: Value;
  right: Value;

  constructor(left: Value, op: ts.BinaryOperator, right: Value) {
    super(ValueKind.kBinaryOp, left.type); // TODO
    this.op = op;
    this.left = left;
    this.right = right;
  }

  equals(v: Value) : boolean {
    if (super.equals(v)) {
      const b = v as BinaryOpValue;
      return b.op == this.op
           && this.left.equals(b.left)
       && this.right.equals(b.right);
    }
    return false;
  }
}

export class ReturnValue extends Value {
  retCode: number = 0;
  constructor() {
    super(ValueKind.kReturn, PrimitiveValueType.Void);
  }
}

export interface StringSpan {
  value: Value;
  literal: string;
}

export class BuildStringValue extends Value {
  head: string;
  spans: StringSpan[] = [];
  outValue: VarValue;

  constructor(outValue: VarValue, head: string) {
    super(ValueKind.kStringBuilder, PrimitiveValueType.Void);
    this.head = head;
    this.outValue = outValue;
  }

  add(value: Value, literal: string) {
    this.spans.push({value: value, literal: literal});
  }
}


export function IsLeftValue(value: Value) {
  return value.kind == ValueKind.kVar
        || value.kind == ValueKind.kParameter
    || value.kind == ValueKind.kPropertyAccess;
}

function GetMemberValueType(m: MemberNode | EnumMemberNode) : ValueType {
  if (m.kind == SemanticsType.kMethod)
    return (m as MethodNode).returnValueType;
  else if (m.kind == SemanticsType.kField)
    return (m as FieldNode).type;
  else if (m.kind == SemanticsType.kEnumMember) {
    const em = m as EnumMemberNode;
    if (typeof em.value == 'number')
      return PrimitiveValueType.Int;
    return PrimitiveValueType.String;
  }
  return PrimitiveValueType.Void;
}

export class PropertyAccessValue extends Value {
  thiz: Value;
  member: MemberNode | EnumMemberNode;

  constructor(thiz: Value, member: MemberNode|EnumMemberNode) {
    super(ValueKind.kPropertyAccess, GetMemberValueType(member));
    this.thiz = thiz;
    this.member = member;
  }
}


function GetElementAccessType(el: Value, arg: Value) : ValueType {
  if (el.kind == ValueKind.kEnum) {
    return PrimitiveValueType.String;
  }

  // TODO

  return PrimitiveValueType.Dynamic;
}

export class ElementAccessValue extends Value {
  element: Value;
  argument: Value;

  constructor(el: Value, arg: Value) {
    super(ValueKind.kElementAccess, GetElementAccessType(el, arg));
    this.element = el;
    this.argument = arg;
  }
}
export class IfValue extends Value{
  expr: Value;
  constructor(expr: Value){
    super(ValueKind.KIf, PrimitiveValueType.Void);
    this.expr = expr;
  }
}
export class ThenValue extends Value{
  constructor(){
    super(ValueKind.KThen, PrimitiveValueType.Void);
  }
}
export class ElseValue extends Value{
  start: boolean;
  constructor(start: boolean){
    super(ValueKind.KElse, PrimitiveValueType.Void);
    this.start = start;
  }
}
export class WhileValue extends Value{
  expr: Value;
  start: boolean;
  constructor(start: boolean, expr?: Value){
    super(ValueKind.KWhile, PrimitiveValueType.Void);
    this.start = start;
    this.expr = expr;
  }
}
export class DoWhileValue extends Value{
  expr: Value;
  start: boolean;
  constructor(start: boolean, expr?: Value){
    super(ValueKind.KDoWhile, PrimitiveValueType.Void);
    this.start = start;
    this.expr = expr;
  }
}
export class SwitchValue extends Value{
  expr: Value;
  start: boolean;
  constructor(start: boolean, expr? :Value){
    super(ValueKind.KSwitch, PrimitiveValueType.Void);
    this.start = start;
    this.expr = expr;
  }
}
export class CaseValue extends Value{
  expr: Value;
  isDefault: boolean;
  constructor(isDefault: boolean, expr? : Value){
    super(ValueKind.KCase, PrimitiveValueType.Void);
    this.isDefault = isDefault;
    this.expr = expr;
  }
}
export class BreakValue extends Value{
  label: string;
  constructor(label?: string){
    super(ValueKind.KBreak, PrimitiveValueType.Void);

  }
}
export type StroageValue = VarValue | FunctionValue | ParameterValue | ClassValue | EnumValue;
export function IsStroageValue(v: Value) : boolean {
  return v.kind == ValueKind.kVar
       || v.kind == ValueKind.kClass
       || v.kind == ValueKind.kFunction
       || v.kind == ValueKind.kParameter;
}

const kCustroumerMemberStart = 4;

export interface Writer {
  setModule(m: ModuleNode);
  setClass(c: ClassNode);

  writeFunction(func: FunctionLikeNode, values: Value[]);
  //writeFragements(stack: FragmentNode[]);
  finish();
}

function isEqualOperator(kind: ts.BinaryOperator) {
  return kind == ts.SyntaxKind.EqualsToken
        || kind == ts.SyntaxKind.PlusEqualsToken
    || kind == ts.SyntaxKind.MinusEqualsToken
    || kind == ts.SyntaxKind.AsteriskAsteriskEqualsToken
    || kind == ts.SyntaxKind.AsteriskEqualsToken
    || kind == ts.SyntaxKind.SlashEqualsToken
    || kind == ts.SyntaxKind.PercentEqualsToken
    || kind == ts.SyntaxKind.AmpersandEqualsToken
    || kind == ts.SyntaxKind.CaretEqualsToken
    || kind == ts.SyntaxKind.LessThanLessThanEqualsToken
    || kind == ts.SyntaxKind.GreaterThanGreaterThanToken
    || kind == ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken;
}

export enum SemanticsType {
  kModule,
  kStdModule,
  kClass,
  kLiteralClass,
  kInterface,
  kEnum,
  kEnumMember,
  kParamter,
  kFunction,
  kMethod,
  kField,
  kConstructor,
  kModuleInitializer,
  kVar,
  kClosure,
  kBlock,
  kBranchBlock,
};

function isVarValue(kind: SemanticsType) : boolean {
  return kind == SemanticsType.kVar
       || kind == SemanticsType.kParamter
       || kind == SemanticsType.kEnum
       || kind == SemanticsType.kFunction;
}

function isClassLikeValue(kind: SemanticsType) : boolean {
  return kind == SemanticsType.kClass
       || kind == SemanticsType.kInterface
       || kind == SemanticsType.kLiteralClass;
}

function isTypeValue(kind: SemanticsType) : boolean {
  return isClassLikeValue(kind)
       || kind == SemanticsType.kEnum;
}

function isClassMemberValue(kind: SemanticsType) : boolean {
  return kind == SemanticsType.kMethod
       || kind == SemanticsType.kField;
}

interface CheckSemanticsType {
  (kind: SemanticsType) : boolean;
}

export class SemanticsNode {
  readonly kind: SemanticsType;
  astNode: ts.Node;
  index: number = 0;
  parent?: SemanticsNode;

  constructor(kind: SemanticsType, astNode: ts.Node) {
    this.kind = kind;
    this.astNode = astNode;
  }

  add(n: SemanticsNode) { }

  find(name: string) : SemanticsNode | undefined { return undefined; }

  dump(writer: DumpWriter) {
    writer.writeLine(`${SemanticsType[this.kind]} @${this.index}`);
  }

  equals(s: SemanticsNode) : boolean {
    return s.kind == this.kind;
  }
}

export class BlockLikeNode extends SemanticsNode {
  locals: VarNode[] = [];

  subBlocks: BlockLikeNode[] = [];

  constructor(kind: SemanticsType.kBlock | SemanticsType.kBranchBlock, astNode: ts.Node) {
    super(kind, astNode);
  }

  add(n: SemanticsNode) {
    if (n.kind == SemanticsType.kVar) {
      n.index = this.locals.length;
      n.parent = this;
      this.locals.push(n as VarNode);
    } else if (n.kind == SemanticsType.kBlock) {
      n.index = this.subBlocks.length;
      n.parent = this;
      this.subBlocks.push(n as BlockLikeNode);
    }
  }

  find(name: string) : SemanticsNode | undefined {
    for (const v of this.locals) {
      if (v.name == name)
        return v;
    }
    return undefined;
  }

  calcLocals(start: number) : number {
    if (start > 0) {
      for (const l of this.locals) {
        l.index += start;
      }
    }

    start += this.locals.length;

    if (this.kind == SemanticsType.kBranchBlock) {
      let var_count = start;
      let max_count = start;
      for (const b of this.subBlocks) {
        var_count = b.calcLocals(start);
        if (var_count > max_count) max_count = var_count;
      }
      start += max_count;
    } else {
      for (const b of this.subBlocks) {
        start += b.calcLocals(start);
      }
    }
    return start;
  }

  dump(writer: DumpWriter) {
    writer.writeLine(`${this.kind == SemanticsType.kBlock? 'Block': 'BranchBlock'}`);
    writer.shift();
    for (const l of this.locals)
      l.dump(writer);
    for (const b of this.subBlocks)
      b.dump(writer);
    writer.unshift();
  }
}

export class BlockNode extends BlockLikeNode {
  constructor(astNode: ts.Node) {
    super(SemanticsType.kBlock, astNode);
  }
}

export class BranchBlockNode extends BlockLikeNode {
  constructor(astNode: ts.Node) {
    super(SemanticsType.kBranchBlock, astNode);
  }
}

export class NamedNode extends SemanticsNode {
  name: string;
  constructor(kind: SemanticsType, name: string, astNode: ts.Node) {
    super(kind, astNode);
    this.name = name;
  }

  dump(writer: DumpWriter) {
    writer.writeLine(`${SemanticsType[this.kind]} ${this.name}@${this.index}`);
  }
}

export class ParameterNode extends NamedNode {
  type: ValueType;
  is_dotdotdot: boolean = false;
  usedByClosure: boolean = false;
  constructor(name: string, type: ValueType, astNode: ts.Node) {
    super(SemanticsType.kParamter, name, astNode);
    this.type = type;
  }

  dump(writer: DumpWriter) {
    writer.writeLine(`Paramter ${this.name}@${this.index} type: ${ValueTypeToString(this.type)} ...:${this.is_dotdotdot} closure: ${this.usedByClosure}`);
  }

  equals(s: SemanticsNode) : boolean {
    if (super.equals(s)) {
      const p = s as ParameterNode;
      return p.is_dotdotdot == this.is_dotdotdot
         && IsValueTypeEqual(p.type, this.type);
    }
    return false;
  }
}

type ClosureableDataNode = VarNode | ParameterNode;

class ClosureDataNode extends NamedNode {
  type: ValueType;
  reference: SemanticsNode;

  constructor(reference: ClosureableDataNode|ClosureDataNode, astNode: ts.Node) {
    super(SemanticsType.kClosure, reference.name, astNode);
    this.type = reference.type;
  }

  dump(writer: DumpWriter) {
    writer.writeLine(`ClosuerData ${this.name}@${this.index} ${ValueTypeToString(this.type)}`);
  }
}

export class EnumMemberNode extends NamedNode {
  value: string | number;
  constructor(name: string, value: string | number, node: ts.Node) {
    super(SemanticsType.kEnumMember, name, node);
    this. value = value;
  }

  equals(s: SemanticsNode) : boolean {
    return super.equals(s)
           && (s as EnumMemberNode).name === this.name
           && this.value === (s as EnumMemberNode).value;
  }
}

export class EnumNode extends NamedNode {
  type: ValueType = PrimitiveValueType.Undefined;
  members: EnumMemberNode[] = [];
  constructor(name: string, node: ts.Node) {
    super(SemanticsType.kEnum, name, node);
  }

  equals(s: SemanticsNode) : boolean {
    if (super.equals(s)) {
      const e = s as EnumNode;
      for (const c1 of this.members) {
        const c2 = e.find(c1.name);
        if (!c2 || c2.equals(c1))
          return false;
      }
      return true;
    }
    return false;
  }

  add(n: SemanticsNode) {
    if (n.kind == SemanticsType.kEnumMember) {
      n.parent = this;
      n.index = this.members.length;
      this.members.push(n as EnumMemberNode);
      const mn = n as EnumMemberNode;
      if (typeof mn.value == 'string') {
        if (this.type.kind == ValueTypeKind.kUndefined) {
          this.type = PrimitiveValueType.String;
    } else if (this.type.kind == ValueTypeKind.kInt) {
          this.type = IntStringUnion;
    }
      } else {
        if (this.type.kind == ValueTypeKind.kUndefined) {
          this.type = PrimitiveValueType.Int;
    } else if (this.type.kind == ValueTypeKind.kString) {
          this.type = IntStringUnion;
    }
      }
    }
  }

  find(name: string) : SemanticsNode | undefined {
    for (const m of this.members) {
      if (m.name == name)
        return m;
    }
    return undefined;
  }

  dump(writer: DumpWriter) {
    writer.writeLine(`Enum ${this.name}@${this.index}`);
    for (const m of this.members) {
      writer.writeLine(`  ${m.name} = ${m.value}`);
    }
  }
}

type FunctionLikeNodeType = SemanticsType.kFunction|SemanticsType.kMethod|SemanticsType.kConstructor | SemanticsType.kModuleInitializer;

export class FunctionLikeNode extends NamedNode {
  returnValueType: ValueType;
  params: ParameterNode[] = [];
  param_count: number = 0;
  has_variable_param: boolean = false;
  local_count: number = 0;
  temporary_count: number = 0;
  closureDatas: ClosureDataNode[] = [];
  block?: BlockNode;

  constructor(kind: FunctionLikeNodeType, name: string, astNode: ts.Node) {
    super(kind, name, astNode);
  }

  equals(s: SemanticsNode) : boolean {
    if (super.equals(s)){
      const f = s as FunctionLikeNode;
      if (!IsValueTypeEqual(this.returnValueType, f.returnValueType))
        return false;
      if (f.param_count != this.param_count)
        return false;
      let i = 0;
      for (i = 0; i < this.param_count; i ++) {
        if (!this.params[i].equals(f.params[i]))
          return false;
      }
      return true;
    }
    return false;
  }

  getParamterType(i: number) : ValueType {
    if (i >= 0 && i < this.params.length) {
      return this.params[i].type;
    }
    if (i < 0) return PrimitiveValueType.Void;

    const last = this.params[this.params.length-1];
    if (last.is_dotdotdot) {
      if (last.type.kind == ValueTypeKind.kArray) {
        return (last.type as ArrayValueType).element;
      }
    }
    return PrimitiveValueType.Any;
  }

  addParameter(p: ParameterNode) {
    p.parent = this;
    p.index = this.params.length;
    this.params.push(p);
    this.param_count = this.params.length;
  }

  add(n: SemanticsNode) {
    if (n.kind == SemanticsType.kBlock) {
      this.block = n as BlockNode;
    } else if (n.kind == SemanticsType.kParamter) {
      this.addParameter(n as ParameterNode);
    } else if (n.kind == SemanticsType.kClosure) {
      n.parent = this;
      n.index = this.closureDatas.length;
      this.closureDatas.push(n as ClosureDataNode);
    }
  }

  find(name: string) : SemanticsNode | undefined {
    for (const p of this.params) {
      if (p.name == name)
        return p;
    }

    for (const c of this.closureDatas) {
      if (c.name == name)
        return c;
    }
    return undefined;
  }

  calcLocalVars() {
    if (!this.block) return;

    this.local_count = this.block.calcLocals(0);
  }

  dump(writer: DumpWriter) {
    let type_name = '';
    switch(this.kind) {
      case SemanticsType.kFunction: type_name = 'function'; break;
      case SemanticsType.kMethod: type_name = 'method'; break;
      case SemanticsType.kModuleInitializer: type_name = 'module_initializer'; break;
      case SemanticsType.kConstructor: type_name = 'constructor'; break;

    }

    writer.writeLine(`${type_name}: ${this.name} locals: ${this.local_count} param_count: ${this.param_count} variable_param: ${this.has_variable_param}`);
    writer.shift();
    for (const p of this.params)
      p.dump(writer);
    for (const c of this.closureDatas)
      c.dump(writer);
    writer.unshift();
  }
}

export class FunctionNode extends FunctionLikeNode {
  constructor(name: string, astNode: ts.Node) {
    super(SemanticsType.kFunction, name, astNode);
  }
}

export class MethodNode extends FunctionLikeNode {
  constructor(name: string, astNode: ts.Node) {
    super(SemanticsType.kMethod, name, astNode);
  }
}

export class ModuleInitializeNode extends FunctionLikeNode {
  constructor(astNode: ts.Node) {
    super(SemanticsType.kModuleInitializer, "initialize", astNode);
    this.index = 0;
    this.returnValueType = PrimitiveValueType.Void;
  }

  calcLocalVars() {
    const m = this.parent as ModuleLikeNode;

    m.updateVarNodes();

    super.calcLocalVars();
  }
}

export class ConstructorNode extends FunctionLikeNode {
  constructor(astNode: ts.Node) {
    super(SemanticsType.kConstructor, "__ctr__", astNode);
  }
}

export class FieldNode extends NamedNode {
  type: ValueType;
  value?: Value;
  offset32: number;
  offset64: number;

  constructor(name: string, type: ValueType, astNode: ts.Node) {
    super(SemanticsType.kField, name, astNode);
    this.type = type;
    this.offset32 = -1;
    this.offset64 = -1;
  }

  equals(s: SemanticsNode) : boolean {
    return super.equals(s) && IsValueTypeEqual(this.type, (s as FieldNode).type);
  }

  dump(writer: DumpWriter) {
    writer.writeLine(`Field '${this.name}':${ValueTypeToString(this.type)} @${this.index} Offset: ${this.offset32}, ${this.offset64}`);
  }
}


export type MemberNode = MethodNode | FieldNode;

type ClassLikeNodeType = SemanticsType.kClass | SemanticsType.kInterface | SemanticsType.kLiteralClass;


function calcOffset(fields: FieldNode[], start: number, e_size: number, offsets: number[], update: {(f: FieldNode, offset: number):void}) : number {
  let s = (start + e_size - 1) & (~(e_size - 1));  //align e_size
  for(let i = 0; i < offsets.length; i ++) {
    if (offsets[i] == e_size) {
      update(fields[i], s);
      s += e_size;
    }
  }
  return s;
}

class ClassLikeNode extends NamedNode {
  members: MemberNode[] = [];
  extends?: ClassNode;
  impl_interfaces: ClassLikeNode[];

  constructor(kind: ClassLikeNodeType, name: string, astNode: ts.Node) {
    super(kind, name, astNode);
  }

  equals(s: SemanticsNode) : boolean {
    if (super.equals(s)) {
      const c = s as ClassLikeNode;
      if (this.extends && c.extends) {
        if (!this.extends.equals(c.extends)) return false;
      } else if (this.extends || c.extends) {
        return false;
      }

      if (c.members.length != this.members.length)
        return false;

      for (const m of c.members) {
        const m2 = this.find(m.name);
        if (!(m2 && m2.equals(m)))
          return false;
      }
      return true;
    }

    return false;
  }

  addMember(member: MemberNode | undefined) {
    if (member) {
      member.index = this.members.length;
      member.parent = this;
      this.members.push(member);
    }
  }

  addImplements(intf: ClassLikeNode) {
    if (intf.kind == SemanticsType.kLiteralClass)
      return;

    if (!this.impl_interfaces) {
      this.impl_interfaces = [intf];
      return;
    }

    for (const i of this.impl_interfaces) {
      if (i.name === intf.name)
        return;
    }

    this.impl_interfaces.push(intf);
  }

  add(n: SemanticsNode) {
    if (n.kind == SemanticsType.kMethod) {
      this.addMember(n as MethodNode);
    } else if (n.kind == SemanticsType.kField) {
      this.addMember(n as FieldNode);
    }
  }

  find(name: string) : SemanticsNode | undefined {
    for (const m of this.members) {
      //console.log(`this.name: ${this.name}, name: ${name}, m: ${m.name}`);
      if (m.name == name) {
        return m;
      }
    }
    return undefined;
  }

  dump(writer: DumpWriter) {
    let type_name = '';
    switch(this.kind) {
      case SemanticsType.kClass: type_name = 'class'; break;
      case SemanticsType.kInterface: type_name = 'interface'; break;
    }
    writer.writeLine(`${type_name}(${this.name}) {`);
    writer.shift();
    for (const m of this.members)
      m.dump(writer);
    writer.unshift();
    writer.writeLine(`}`);
  }

  getConstructor() : ConstructorNode | undefined { return undefined; }
}

export class ClassNode extends ClassLikeNode {
  ctr?: ConstructorNode;
  fieldSize32: number = 0;
  fieldSize64: number = 0;

  constructor(name: string, astNode: ts.Node, is_literal: boolean = false) {
    super(is_literal ? SemanticsType.kLiteralClass : SemanticsType.kClass,
      name, astNode);
  }

  getConstructor() : ConstructorNode | undefined { return this.ctr; }

  addConstructor(ctr: ConstructorNode) {
    this.ctr = ctr;
    ctr.parent = this;
  }

  add(n: SemanticsNode) {
    if (n.kind == SemanticsType.kConstructor) {
      this.addConstructor(n as ConstructorNode);
    } else {
      super.add(n);
    }
  }

  updateFieldOffsets() {
    const field32_offsets: number[] = [];
    const field64_offsets: number[] = [];
    const fields: FieldNode[] = [];
    for (const m of this.members) {
      if (m.kind != SemanticsType.kField) continue;
      const f = m as FieldNode;
      fields.push(f);
      const offsets = getTypeSize(f.type.kind);
      field32_offsets.push(offsets[0]);
      field64_offsets.push(offsets[1]);
    }

    let s32 = 0;
    let s64 = 0;

    s32 = calcOffset(fields, s32, 1, field32_offsets, (f, of) => f.offset32 = of);
    s32 = calcOffset(fields, s32, 2, field32_offsets, (f, of) => f.offset32 = of);
    s32 = calcOffset(fields, s32, 4, field32_offsets, (f, of) => f.offset32 = of);
    s32 = calcOffset(fields, s32, 8, field32_offsets, (f, of) => f.offset32 = of);

    s64 = calcOffset(fields, s64, 1, field64_offsets, (f, of) => f.offset64 = of);
    s64 = calcOffset(fields, s64, 2, field64_offsets, (f, of) => f.offset64 = of);
    s64 = calcOffset(fields, s64, 4, field64_offsets, (f, of) => f.offset64 = of);
    s64 = calcOffset(fields, s64, 8, field64_offsets, (f, of) => f.offset64 = of);

    this.fieldSize32 = s32;
    this.fieldSize64 = s64;
  }
}

export class InterfaceNode extends ClassLikeNode {
  constructor(name: string, astNode: ts.Node) {
    super(SemanticsType.kInterface, name, astNode);
  }
}

export class VarNode extends NamedNode {
  type: ValueType;
  usedByClosure: boolean = false;
  constructor(name: string, type: ValueType, astNode: ts.Node) {
    super(SemanticsType.kVar, name, astNode);
    this.type = type;
  }

  dump(writer: DumpWriter) {
    writer.writeLine(`VarNode: ${this.name}@${this.index} {type: ${ValueTypeToString(this.type)}, closure: ${this.usedByClosure}}`);
  }
}


type ModuleLikeNodeType = SemanticsType.kModule | SemanticsType.kStdModule;

export class ModuleLikeNode extends NamedNode {
  // imports
  classes: ClassNode[] = [];
  functions: FunctionNode[] = [];
  // interfaces
  interfaces: InterfaceNode[] = [];
  vars: VarNode[] = [];
  enums: EnumNode[] = [];

  tempClasses: Map<ts.Node, ClassNode> = new Map();
  funcExpress: Map<ts.Node, FunctionNode> = new Map();

  initialize: ModuleInitializeNode;

  constructor(kind: ModuleLikeNodeType, name: string, astNode: ts.SourceFile) {
    super(kind, name, astNode);
    this.initialize = this.createModuleInitialzeMethod(astNode);
    console.log("=== initalize:", SemanticsType[this.initialize.kind]);
  }

  setTempClass(clazz: ClassNode, node: ts.Node) {
    this.tempClasses.set(node, clazz);
    clazz.parent = this;
  }

  getTempClass(node: ts.Node) : ClassNode {
    return this.tempClasses.get(node);
  }

  uploadTempClass(clazz: ClassNode) {
    const new_clazz = this.tempClasses.get(clazz.astNode);
    if (!new_clazz)  return; // TODO

    this.classes.push(clazz);
    this.tempClasses.delete(clazz.astNode);
  }

  combineTempClass(clazz: ClassNode) : ClassNode | undefined {
    // find the same expression value
    for (const c of this.classes) {
      if (c.equals(clazz))
        return c;
    }
    return undefined;
  }

  setFunctionExpression(func: FunctionNode, node: ts.Node) {
    this.funcExpress.set(node, func);
  }

  getTemporaryClassName() : string {
    return `__temp${this.classes.length + 1}`;
  }

  addTo(nodes: SemanticsNode[], n: SemanticsNode) {
    n.index = nodes.length;
    nodes.push(n);
    n.parent = this;
  }

  add(n: SemanticsNode) {
    switch(n.kind) {
      case SemanticsType.kClass:
      case SemanticsType.kLiteralClass:
        this.addTo(this.classes, n);
        break;
      case SemanticsType.kInterface:
        this.addTo(this.interfaces, n);
        break;
      case SemanticsType.kFunction:
        this.addTo(this.functions, n);
        break;
      case SemanticsType.kVar:
        this.addTo(this.vars, n);
        break;
      case SemanticsType.kEnum:
        this.addTo(this.enums, n);
        break;
      default:
        // TODO ERROR
        break;
    }
  }

  createModuleInitialzeMethod(node: ts.SourceFile) : ModuleInitializeNode {
    const m = new ModuleInitializeNode(node);
    m.add(new BlockNode(node));
    m.parent = this;
    return m;
  }

  findFrom(name: string, nodes: NamedNode[]) : SemanticsNode | undefined {
    for (const n of nodes) {
      if (n.name == name) return n;
    }
    return undefined;
  }

  find(name: string) : SemanticsNode | undefined {
    return this.findFrom(name, this.vars)
          || this.findFrom(name, this.functions)
          || this.findFrom(name, this.classes)
          || this.findFrom(name, this.enums)
          || this.findFrom(name, this.interfaces)
          ;
  }

  updateVarNodes() {
    const vars: VarNode[] = [];
    const localvars: VarNode[] = [];

    for (const v of this.vars) {
      if (v.usedByClosure) {
    v.index = vars.length;
        vars.push(v);
      } else {
    v.index = localvars.length;
        localvars.push(v);
      }
    }

    this.vars = vars;
    this.initialize.block.locals = localvars;
  }

  dump(writer: DumpWriter) {
    writer.writeLine(`Module name: ${this.name} ${(this.astNode as ts.SourceFile).fileName}`);
    writer.shift();
    this.initialize.dump(writer);
    for (const c of this.classes)
      c.dump(writer);
    for (const f of this.functions)
      f.dump(writer);
    for (const v of this.vars)
      v.dump(writer);
    for (const e of this.enums)
      e.dump(writer);
    writer.unshift();
  }
}

export class ModuleNode extends ModuleLikeNode {
  constructor(name: string, astNode: ts.SourceFile) {
    super(SemanticsType.kModule, name, astNode);
  }
}

export class StdModuleNode extends ModuleLikeNode {
  constructor(astNode: ts.SourceFile) {
    super(SemanticsType.kStdModule, '__std__', astNode);
  }
}


interface BuildTask {
  (): void;
}

interface ModuleVarUpdator {
  node: VarNode;
  value: VarValue;
}

class ContextBase {
  stacks: SemanticsNode[];
  module: ModuleLikeNode;
  tasks: BuildTask[];
  moduleVarUpdators: ModuleVarUpdator[]; // for storage the VarValues to update

  constructor(stacks: SemanticsNode[]) {
    this.stacks = stacks;
    this.tasks = [];
  }

  push(n: SemanticsNode) {
    this.stacks.push(n);
  }
  pop() {
    this.stacks.pop();
  }
  top() : SemanticsNode { return this.stacks[this.stacks.length - 1]; }

  addToModule(n: SemanticsNode) {
    this.module.add(n);
  }

  addTo(n: SemanticsNode, types: SemanticsType[]) {
    let p : SemanticsNode | undefined = undefined;
    for (let i = this.stacks.length - 1; i >= 0; i--) {
      if (types.indexOf(this.stacks[i].kind) >= 0) {
        p = this.stacks[i];
    break;
      }
    }

    if (p) {
      p.add(n);
    } else {
      // TODO
    }
  }

  resolve(name: string, check: CheckSemanticsType) : Value {
    let node : SemanticsNode | undefined = undefined;

    let i = -1;
    for (i = this.stacks.length-1; i >= 0; i --) {
      node = this.stacks[i].find(name);
      if (node && check(node.kind)) {
        break;
      }
    }

    if (!node) {
      console.error(`resolve "${name}" failed: no such name`);
      return new NoneValue();
    }

    debug(`resolved "${name}" found ${SemanticsType[node.kind]} in ${i}`);
    switch(node.kind) {
      case SemanticsType.kVar:
      case SemanticsType.kParamter:
        return this.createVarValue(node as ClosureableDataNode, i);
      case SemanticsType.kFunction: {
    const p = this.stacks[i];
    let storage = StorageScope.kModule;
    if (p.kind == SemanticsType.kModule)
          storage = StorageScope.kModule;
        else if (p.kind == SemanticsType.kStdModule)
          storage = StorageScope.kGlobal;
        else {
          // TODO
    }
        return new FunctionValue(node as FunctionNode, storage, node.index);
      }
      case SemanticsType.kEnum: {
        return new EnumValue(node as EnumNode,
                   node.parent.kind == SemanticsType.kModule ?
            StorageScope.kModule : StorageScope.kGlobal);
      }
    }
    console.error(`resolve "${name}" unknown type ${SemanticsType[node.kind]}`);
    return new NoneValue();
  }

  resolveThis() : Value {
    let node : SemanticsNode | undefined = undefined;

    let i = -1;
    for (i = this.stacks.length-1; i >= 0; i --) {
      node = this.stacks[i];
      if (node && isClassLikeValue(node.kind)) {
        break;
      }
    }

    if (i >= 0) {
      return new ThisValue({kind: ValueTypeKind.kObject, clazz: node as ClassLikeNode});
    }

    return new NoneValue();
  }

  resolveType(name: string) : SemanticsNode | undefined {
    // we only release from module or stdModule
    let i = 0;
    for (; i < this.stacks.length &&
         (this.stacks[i].kind == SemanticsType.kStdModule
             || this.stacks[i].kind == SemanticsType.kModule);
       i++);

    debug(`resolveType name: ${name} from ${i}`);
    let node: SemanticsNode | undefined = undefined;
    for (--i; i >= 0; i --) {
      node = this.stacks[i].find(name);
      if (node && isTypeValue(node.kind)) {
        return node;
      }
    }

    console.error(`resolveType error: cannot resolve "${name}"`);
    return undefined;
  }

  resolveClassLikeType(name: string) : ObjectValueType | undefined {
    const v = this.resolveType(name);
    return isClassLikeValue(v.kind) ?
        {kind: ValueTypeKind.kObject, clazz: v as ClassLikeNode}
            : undefined;
  }

  getNode(kinds: SemanticsType[]) : SemanticsNode | undefined {
    for (let i = this.stacks.length - 1; i >= 0; i --) {
      if (kinds.indexOf(this.stacks[i].kind) >= 0) {
        return this.stacks[i];
      }
    }
    return undefined;
  }

  getCurrentFunctionReturnType() : ValueType {
    const node = this.getNode([SemanticsType.kMethod, SemanticsType.kFunction, SemanticsType.kConstructor]);
    if (!node) return PrimitiveValueType.Void;
    return (node as FunctionLikeNode).returnValueType;
  }

  isInModuleIntializer() : boolean {
    for (let i = this.stacks.length - 1; i > 0; i --) {
      const n = this.stacks[i];
      if (n.kind == SemanticsType.kBlock
     || n.kind == SemanticsType.kBranchBlock)
        continue;

      if (n.kind == SemanticsType.kModuleInitializer)
        return true;
      return false;
    }
    return false;
  }

  pushModuleVarUpdator(node: VarNode, value: VarValue) {
    if (!this.moduleVarUpdators)  this.moduleVarUpdators = [];
    this.moduleVarUpdators.push({node: node, value: value});
  }

  createVarValue(v: ClosureableDataNode, index: number) {
    const parent = v.parent;
    if (parent.kind == SemanticsType.kModule) {
      const vnode = new VarValue(v.type, StorageScope.kModule, v.index);
      if (v.kind == SemanticsType.kVar) {
    if (!this.isInModuleIntializer()) {
          (v as VarNode).usedByClosure = true;
    }
        this.pushModuleVarUpdator(v as VarNode, vnode);
      }
      return vnode;
    }
    if (parent.kind == SemanticsType.kStdModule) {
      return new VarValue(v.type, StorageScope.kGlobal, v.index);
    }

    // make closure
    let v_closure : ClosureDataNode | undefined = undefined;
    if (parent.kind == SemanticsType.kBlock
    || parent.kind == SemanticsType.kFunction
        || parent.kind == SemanticsType.kConstructor
    || parent.kind == SemanticsType.kModuleInitializer
        || parent.kind == SemanticsType.kMethod) {
      for(let i = this.stacks.length - 1; i > index; i --) {
        const n = this.stacks[i]
    if(n.kind == SemanticsType.kFunction
           || parent.kind == SemanticsType.kConstructor
       || parent.kind == SemanticsType.kModuleInitializer
       || n.kind == SemanticsType.kMethod) {
          // load as closure
      if (!v_closure) {
          v.usedByClosure = true;
        v_closure = new ClosureDataNode(v, n.astNode);
        n.add(v_closure);
      } else {
        v_closure = new ClosureDataNode(v_closure, n.astNode);
        n.add(v_closure);
      }
    }
      }
    }

    if (v_closure) {
      return new VarValue(v_closure.type, StorageScope.kClosure, v_closure.index);
    } else if (v.kind == SemanticsType.kVar) {
      return new VarValue(v.type, StorageScope.kLocal, v.index);
    } else if (v.kind == SemanticsType.kParamter) {
      return new VarValue(v.type, StorageScope.kParameter, v.index + 1); // parameter start from 1
    }

    return new NoneValue();
  }


  getArrayValueType(type: ts.TypeNode) : ValueType {
    let v: ValueTypeKind = ValueTypeKind.kUndefined;
    switch(type.kind) {
      case ts.SyntaxKind.NumberKeyword:
        v = ValueTypeKind.kNumber;
        break;
      case ts.SyntaxKind.StringKeyword:
        v = ValueTypeKind.kString;
        break;
      case ts.SyntaxKind.AnyKeyword:
        v = ValueTypeKind.kAny
        break;
      case ts.SyntaxKind.BooleanKeyword:
        v = ValueTypeKind.kBoolean;
        break;
      default:
        return <ArrayValueType>{kind: ValueTypeKind.kArray, element: this.getValueTypeFrom(type) };
    }

    for (const a of PrimitiveArrayValueType) {
      if (a.element.kind == v)
        return a;
    }
    return PrimitiveValueType.Undefined;
  }

  getValueTypeFrom(type?: ts.TypeNode) : ValueType | undefined {
    if (!type) return VoidOrAnyValueType;

    debug(`getValueTypeFrom type: ${nodeToString(type)}`)
    switch(type.kind) {
      case ts.SyntaxKind.VoidKeyword:
        return PrimitiveValueType.Void;
      case ts.SyntaxKind.NumberKeyword:
        return PrimitiveValueType.Number;
      case ts.SyntaxKind.StringKeyword:
        return PrimitiveValueType.String;
      case ts.SyntaxKind.AnyKeyword:
        return PrimitiveValueType.Any;
      case ts.SyntaxKind.BooleanKeyword:
        return PrimitiveValueType.Boolean;
      case ts.SyntaxKind.UndefinedKeyword:
        return PrimitiveValueType.Undefined;
      case ts.SyntaxKind.NullKeyword:
        return PrimitiveValueType.Null;
      case ts.SyntaxKind.NeverKeyword:
        return PrimitiveValueType.Never;
      case ts.SyntaxKind.ArrayType:
        return this.getArrayValueType((type as ts.ArrayTypeNode).elementType);
      case ts.SyntaxKind.TypeReference:
    return this.getValueTypeFromTypeReference(type as ts.TypeReferenceNode);
    }

    return PrimitiveValueType.Undefined;
  }

  getValueTypeFromTypeReference(ref: ts.TypeReferenceNode) : ValueType | undefined {
    let node : SemanticsNode | undefined = undefined;
    if (ref.typeName.kind == ts.SyntaxKind.Identifier) {
      node = this.resolveType((ref.typeName as ts.Identifier).text);
    } else if (ref.typeName.kind == ts.SyntaxKind.QualifiedName) {
      // TODO
    }

    if (node) {
      if (isClassLikeValue(node.kind))
        return <ObjectValueType>{kind: ValueTypeKind.kObject, clazz: node as ClassLikeNode};
    }
    return undefined;
  }

  flushTasks() {
    for (const t of this.tasks) {
      t();
    }
  }
}

class BuildSemanticsContext extends ContextBase {

  constructor(stacks: SemanticsNode[]) {
    super(stacks);
  }


  build(sourceFile: ts.SourceFile, is_std: boolean) {
    const module : ModuleLikeNode =
        is_std ? new StdModuleNode(sourceFile)
              : new ModuleNode(normalize_name(sourceFile.fileName), sourceFile);
    this.module = module;
    this.push(module);

    ts.forEachChild(sourceFile, (node) => { this.buildNode(node) });

    this.flushTasks();
  }

  buildNode(node: ts.Node) {
    //console.log(`=== buildNode ${nodeToString(node)}`);
    switch(node.kind) {
    case ts.SyntaxKind.ClassDeclaration:
      this.buildClassDeclaration(node as ts.ClassDeclaration);
      break;
    case ts.SyntaxKind.InterfaceDeclaration:
      this.buildInterfaceDeclaration(node as ts.InterfaceDeclaration);
      break;
    case ts.SyntaxKind.MethodDeclaration:
      this.buildMethodDeclaration(node as ts.MethodDeclaration);
      break;
    case ts.SyntaxKind.FunctionDeclaration:
      this.buildFunctionDeclaration(node as ts.FunctionDeclaration);
      break;
    case ts.SyntaxKind.VariableStatement:
      this.buildVariableStatement(node as ts.VariableStatement);
      break;
    case ts.SyntaxKind.EnumDeclaration:
      this.buildEnumDeclaration(node as ts.EnumDeclaration);
      break;
    case ts.SyntaxKind.ObjectLiteralExpression:
      this.buildObjectLieralClass(node as ts.ObjectLiteralExpression);
      break;
    case ts.SyntaxKind.FunctionExpression:
      this.buildFunctionExpression(node as ts.FunctionExpression);
      break;
    default:
      ts.forEachChild(node, (node) => {this.buildNode(node)});
      break;
    }
  }

  buildObjectLieralClass(expr: ts.ObjectLiteralExpression) {
    const clazz = new ClassNode(this.module.getTemporaryClassName(), expr, true);
    //console.log("=== build clazz", clazz);
    this.module.setTempClass(clazz, expr);
    this.push(clazz);
    for (const p of expr.properties) {
      if (p.kind == ts.SyntaxKind.PropertyAssignment) {
        const f = new FieldNode(p.name.getText(), PrimitiveValueType.Void, p);
        clazz.add(f);
      } else if (p.kind == ts.SyntaxKind.MethodDeclaration) {
        this.buildMethodDeclaration(p as ts.MethodDeclaration);
      }
    }

    this.pop();
  }

  buildFunctionExpression(func: ts.FunctionExpression) {
    const m = new FunctionNode(func.name? func.name!.text : "", func);
    this.addToModule(m);
    this.buildFunctionLike(m, func);
    this.module.setFunctionExpression(m, func);
  }

  buildFunctionDeclaration(func: ts.FunctionDeclaration) {
    const m = new FunctionNode(func.name.text, func);
    this.addToModule(m);
    this.buildFunctionLike(m, func);
  }

  buildClassDeclaration(classDec: ts.ClassDeclaration) {
    const clazz = new ClassNode(classDec.name.text, classDec);
    this.addToModule(clazz);

    this.tasks.push(() => {
      this.push(clazz);
      for (const m of classDec.members) {
        this.buildClassLikeMember(m);
      }
      this.pop();
    });
  }

  buildInterfaceDeclaration(intfDec: ts.InterfaceDeclaration) {
    const intf = new InterfaceNode(intfDec.name.text, intfDec);
    this.addToModule(intf);

    this.tasks.push(() => {
      this.push(intf);
      for (const m of intfDec.members) {
        this.buildClassLikeMember(m);
      }
      //intf.updateFieldOffsets();
      this.pop();
    });
  }

  buildEnumMemberValue(expr: ts.Expression) : string | number | undefined {
    switch(expr.kind) {
      case ts.SyntaxKind.NumericLiteral:
    return parseInt((expr as ts.NumericLiteral).text);
        break;
      case ts.SyntaxKind.StringLiteral:
        return (expr as ts.StringLiteral).text;
    }
    return undefined;
  }

  buildEnumDeclaration(e: ts.EnumDeclaration) {
    const enum_node = new EnumNode(e.name.text, e);

    let start : number = 0;
    for (const m of e.members) {
      let value : number | string | undefined = start;
      if (m.initializer) {
        value = this.buildEnumMemberValue(m.initializer);
    if (!value) {
          value = start ++;
    } else if (typeof value == 'number') {
          start = (value as number) + 1;
    }
      } else {
        value = start ++;
      }
      const enum_member = new EnumMemberNode((m.name as ts.Identifier).text, value, m);
      enum_node.add(enum_member);
    }
    this.addToModule(enum_node);
  }

  buildClassLikeMember(m: ts.ClassElement | ts.TypeElement) {
    switch(m.kind) {
      case ts.SyntaxKind.MethodDeclaration:
        this.buildMethodDeclaration(m as ts.MethodDeclaration);
        break;
      case ts.SyntaxKind.MethodSignature:
        this.buildMethodSignature(m as ts.MethodSignature);
        break;
      case ts.SyntaxKind.PropertyDeclaration:
        this.buildPropertyDeclaration(m as ts.PropertyDeclaration);
        break;
      case ts.SyntaxKind.PropertySignature:
        this.buildPropertySignature(m as ts.PropertySignature);
        break;
      case ts.SyntaxKind.Constructor:
        this.buildConstructor(m as ts.ConstructorDeclaration);
        break;
    }
  }

  buildMethodDeclaration(method: ts.MethodDeclaration) {
    const m = new MethodNode((method.name as ts.Identifier).text, method);
    this.addTo(m, [SemanticsType.kClass, SemanticsType.kLiteralClass, SemanticsType.kInterface]);
    this.buildFunctionLike(m, method);
  }

  buildMethodSignature(method: ts.MethodSignature) {
    const m = new MethodNode(method.name.getText(), method);
    this.addTo(m, [SemanticsType.kInterface]);
    this.buildFunctionLike(m, method);
  }

  buildConstructor(ctr: ts.ConstructorDeclaration) {
    const c = new ConstructorNode(ctr);
    this.addTo(c, [SemanticsType.kClass]);
    this.buildFunctionLike(c, ctr);
  }

  buildFunctionLike(m: FunctionLikeNode, method: ts.FunctionLikeDeclaration | ts.MethodSignature) {
    m.returnValueType = this.getValueTypeFrom(method.type)

    for (let i = 0; i < method.parameters.length; i ++) {
      let name = "";
      const p = method.parameters[i];
      if (p.name.kind == ts.SyntaxKind.Identifier) {
        name = (p.name as ts.Identifier).text;
      }

      const param = new ParameterNode(name, this.getValueTypeFrom(p.type), p);
      param.is_dotdotdot = p.dotDotDotToken != undefined;
      m.addParameter(param);
    }

    if (method.kind != ts.SyntaxKind.MethodSignature
        && (method as ts.FunctionLikeDeclaration).body) {
      ts.forEachChild((method as ts.FunctionLikeDeclaration).body, (node) => {this.buildNode(node)});
    }
  }

  buildVariableStatement(varDec: ts.VariableStatement) {
    for (const v of varDec.declarationList.declarations) {
      let value : ValueType = PrimitiveValueType.Any;

      if (v.type) {
        value = this.getValueTypeFrom(v.type);
      }

      if (v.initializer) {
        this.buildNode(v.initializer);
      }

      const vnode = new VarNode((v.name as ts.Identifier).text, value, v);
      this.addToModule(vnode);
    }
  }

  buildPropertyDeclaration(p: ts.PropertyDeclaration) {
    let valueType: ValueType = PrimitiveValueType.Any;

    if (p.type) {
      valueType = this.getValueTypeFrom(p.type);
    }

    const field = new FieldNode((p.name as ts.Identifier).text, valueType, p);
    this.addTo(field, [SemanticsType.kClass, SemanticsType.kInterface]);
  }

  buildPropertySignature(p: ts.PropertySignature) {
    const value_type = this.getValueTypeFrom(p.type);

    const field = new FieldNode(p.name.getText(), value_type, p);
    this.addTo(field, [SemanticsType.kInterface]);
  }
}

class CompilerContext extends ContextBase {

  values: Value[] = [];
  writer: Writer;
  typeStack: ValueType[] = [];
  max_temporary: number;
  cur_temporary: number;

  constructor(writer: Writer, module: ModuleNode, stdModule: StdModuleNode) {
    super([stdModule, module]);
    this.module = module;
    this.writer = writer;
  }

  incTemporary() : number {
    this.cur_temporary ++;
    if (this.cur_temporary > this.max_temporary) {
      this.max_temporary = this.cur_temporary;
    }

    return this.cur_temporary - 1;
  }

  subTemporary(count: number) {
    this.cur_temporary -= count;
    if (this.cur_temporary < 0) this.cur_temporary = 0;
  }

  createTemporaryValue(type: ValueType) : VarValue {
    return new VarValue(type, StorageScope.kTemporary, this.incTemporary());
  }

  createParameterCountValue(count: number) : ParameterValue {
    return this.createParameterValue(PrimitiveValueType.Int,
                     new LiterialValue(PrimitiveValueType.Int, count));
  }

  createParameterValue(type: ValueType, value: Value) : ParameterValue {
    return new ParameterValue(type, this.incTemporary(), value);
  }

  pushPreType(valueType: ValueType) {
    this.typeStack.push(valueType);
  }

  popPreType() {
    if (this.typeStack.length > 0)
      this.typeStack.pop();
  }

  getPreType() : ValueType | undefined {
    const l = this.typeStack.length;
    if (l > 0) return this.typeStack[l - 1];
    return undefined;
  }

  compile() {
    this.writer.setModule(this.module);
    this.compileFunctions();
    this.writer.finish();
  }

  compileFunctions() {
    this.push(this.module);
    for (const f of this.module.functions) {
      this.compileFunction(f);
    }

    for (const c of this.module.classes) {
      this.compileClass(c);
    }

    this.compileModuleInitialize();
    this.pop();
  }

  updateVars() {
    if (!this.moduleVarUpdators) return;
    for (const u of this.moduleVarUpdators) {
      u.value.index = u.node.index;
      if (!u.node.usedByClosure) {
        u.value.storage = StorageScope.kLocal;
      }
      console.log(`+++++++ node: ${u.node.index}, closure: ${u.node.usedByClosure} value storage: ${StorageScope[u.value.storage]} `);
    }
    this.moduleVarUpdators = undefined;
  }

  compileClass(clazz: ClassNode) {
    this.push(clazz);
    this.writer.setClass(clazz);

    if (clazz.ctr) { // must call firstly
      this.compileFunction(clazz.ctr);
    }

    for (const m of clazz.members) {
      if (m.kind == SemanticsType.kMethod) {
        this.compileFunction(m as MethodNode);
      }
    }

    this.writer.setClass(undefined);
    this.pop();
  }

  compileModuleInitialize() {
    this.compileFunction(this.module.initialize);
  }

  compileClassPropertiesInitialize(clazz: ClassNode) {
    let thiz_value : ThisValue | undefined = undefined;
    for (const m of clazz.members) {
      if (m.kind != SemanticsType.kField) continue;

      const f = m as FieldNode;

      const node = f.astNode as ts.PropertyDeclaration;
      if (node.initializer) {
        let value_type : ValueType = PrimitiveValueType.Any;
        if (node.type) {
          value_type = f.type;
        }

        if (!thiz_value) {
          thiz_value = new ThisValue(<ObjectValueType> {
          kind: ValueTypeKind.kObject,
          clazz: clazz});
        }

        const left_value = new PropertyAccessValue(thiz_value, f);

        let right_value: Value;
        if (this.isNeedReturnExpression(node.initializer.kind)) {
         right_value = this.compileFunctionCallLikeExpression(node.initializer, left_value);
        } else {
          right_value = this.compileExpression(node.initializer);
          this.values.push(new BinaryOpValue(left_value,
                  ts.SyntaxKind.EqualsToken,
                  right_value));
        }
        if (!node.type) {
          f.type = right_value.type;
        }
      }
    }

    clazz.updateFieldOffsets();
  }

  compileFunction(func: FunctionLikeNode) {
    const start = this.values.length;
    const max_temporary = this.max_temporary;
    const cur_temporary = this.cur_temporary;

    this.max_temporary = 0;
    this.cur_temporary = 0;
    this.push(func);

    console.log("===== build ", func.name, SemanticsType[func.kind], func.kind);
    if (func.kind == SemanticsType.kModuleInitializer) {
      const sourceFile = func.astNode as ts.SourceFile;
      for (const s of sourceFile.statements) {
        this.compileFunctionStatement(s);
      }
    } else {
      if (func.kind == SemanticsType.kConstructor) {
        this.compileClassPropertiesInitialize(func.parent as ClassNode);
      }

      const node = func.astNode as ts.FunctionLikeDeclaration;
      if (node.body) {
        if (node.body.kind == ts.SyntaxKind.Block) {
          this.compileFunctionStatement(node.body);
        } else {
          const one_expr = node.body as ts.Expression;
      this.compileReturnExpression(one_expr);
        }
      }
    }
    this.pop();
    func.temporary_count = this.max_temporary;
    func.calcLocalVars();

    if (func.kind == SemanticsType.kModuleInitializer)
      this.updateVars();
    this.writer.writeFunction(func, this.values.slice(start));
    this.values = this.values.slice(0, start);
    this.max_temporary = max_temporary;
    this.cur_temporary = cur_temporary;
  }

  compileFunctionStatement(n: ts.Node) {
    debug(`compileFunctionStatement: ${nodeToString(n)}`);
    switch(n.kind) {
      case ts.SyntaxKind.Block: {
        const block = new BlockNode(n);
    this.addTo(block, [
        SemanticsType.kBlock,
        SemanticsType.kBranchBlock,
        SemanticsType.kFunction,
        SemanticsType.kModuleInitializer,
        SemanticsType.kConstructor,
        SemanticsType.kMethod]);
    ts.forEachChild(n,  (node) => this.compileFunctionStatement(node));
        break;
      }
      case ts.SyntaxKind.ExpressionStatement: {
      const expr = (n as ts.ExpressionStatement).expression;
      const value = this.compileExpression(expr);
      if (expr.kind == ts.SyntaxKind.BinaryExpression &&
          isEqualOperator((expr as ts.BinaryExpression).operatorToken.kind)) {
            this.values.push(value);
          }
    if(value.kind == ValueKind.KUnaryOp){
            this.values.push(value);
          }
        }
        break;

      case ts.SyntaxKind.VariableStatement:
    this.compileVariableStatement((n as ts.VariableStatement));
        break;
      case ts.SyntaxKind.ReturnStatement:
    this.compileReturnStatement((n as ts.ReturnStatement));
        break;
      case ts.SyntaxKind.IfStatement:
        this.compileIfStatement((n as ts.IfStatement));
        break;
      case ts.SyntaxKind.WhileStatement:
        this.compileWhileStatement((n as ts.WhileStatement));
        break;
      case ts.SyntaxKind.DoStatement:
        this.compileDoWhileStatement((n as ts.DoStatement));
        break;
      case ts.SyntaxKind.SwitchStatement:
        this.compileSwitchStatement((n as ts.SwitchStatement));
        break;
      case ts.SyntaxKind.BreakStatement:
        this.compileBreakStatement((n as ts.BreakStatement));
    }
  }

  compileVariableStatement(varSt: ts.VariableStatement) {
    for (const v of varSt.declarationList.declarations) {
      let value_type : ValueType = PrimitiveValueType.Any;
      if (v.type) {
        value_type = this.getValueTypeFrom(v.type);
        this.pushPreType(value_type);
      }

      let value: VarValue | undefined = undefined;

      if (v.initializer) {
        value = new VarValue(value_type, StorageScope.kLocal, 0);
        if (v.initializer.kind == ts.SyntaxKind.CallExpression) {
          let new_value = this.compileCallExpression(v.initializer as ts.CallExpression, value);
          if (!v.type){
            value_type = new_value.type;
            value.type = value_type; // reset the value type
          } else {
            this.popPreType();
          }
        } else {
          const right = this.compileExpression(v.initializer);
          console.log("=========++++ ", ValueTypeKind[right.type.kind]);
          if (!v.type) {
            value_type = right.type;
            value.type = value_type; // reset the value type
          } else {
            this.popPreType();
          }
          this.values.push(new BinaryOpValue(value, ts.SyntaxKind.EqualsToken, right));
        }
      } else {
        this.popPreType();
      }

      if (this.isInModuleIntializer()) {
        const top = this.getNode([SemanticsType.kModule, SemanticsType.kStdModule]);
        const vnode = top.find((v.name as ts.Identifier).text);
        console.log(`==== try find vnode: from top ${SemanticsType[top.kind]} with node: ${vnode}`);
        if (vnode && vnode.kind == SemanticsType.kVar) {
          if (!v.type)
             (vnode as VarNode).type = value_type;
          console.log("==== vnode type:", ValueTypeKind[(vnode as VarNode).type.kind]);
          value.storage = (top.kind == SemanticsType.kModule ?
                   StorageScope.kModule : StorageScope.kGlobal);
          value.index = vnode.index;
          this.pushModuleVarUpdator(vnode as VarNode, value);
        }
      } else {
         const vnode = new VarNode((v.name as ts.Identifier).text, value_type, v);
         this.addTo(vnode, [SemanticsType.kBlock]);
         value.index = vnode.index;
      }
    }
  }

  compileReturnStatement(retNode: ts.ReturnStatement) {
    this.compileReturnExpression(retNode.expression);
  }

  compileIfStatement(ifSt: ts.IfStatement){
    const expr = this.compileExpression(ifSt.expression);
    const if_value = new IfValue(expr);
    this.values.push(if_value);
    this.compileThenStatement(ifSt.thenStatement);
    this.compileElseStatement(ifSt.elseStatement);
  }

  compileThenStatement(thenSt: ts.Statement) {
    this.compileFunctionStatement(thenSt);
    const then_value = new ThenValue();
    this.values.push(then_value);
  }

  compileElseStatement(elseSt: ts.Statement){
    if(!elseSt) return;
    const else_start = new ElseValue(true);
    this.values.push(else_start);
    this.compileFunctionStatement(elseSt);
    const else_end = new ElseValue(false);
    this.values.push(else_end);
  }

  compileWhileStatement(whileSt: ts.WhileStatement){
    const expr = this.compileExpression(whileSt.expression);
    const while_start = new WhileValue(true, expr);
    this.values.push(while_start);
    this.compileFunctionStatement(whileSt.statement);
    const while_end = new WhileValue(false);
    this.values.push(while_end);
  }

  compileDoWhileStatement(doSt: ts.DoStatement){
    const expr = this.compileExpression(doSt.expression);
    const do_start = new DoWhileValue(true);
    this.values.push(do_start);
    this.compileFunctionStatement(doSt.statement);
    const do_end = new DoWhileValue(false, expr);
    this.values.push(do_end);
  }

  compileSwitchStatement(swicthSt: ts.SwitchStatement){
    const expr = this.compileExpression(swicthSt.expression);
    const switch_start = new SwitchValue(true, expr);
    this.values.push(switch_start);
    this.compileCaseBlock(swicthSt.caseBlock);
    const switch_end = new SwitchValue(false);
    this.values.push(switch_end);
  }

  compileBreakStatement(brSt: ts.BreakStatement){ //
    const break_value = new BreakValue();
    this.values.push(break_value);
  }

  compileCaseBlock(n: ts.CaseBlock){
    for(let e of n.clauses){
      if(e.kind == ts.SyntaxKind.CaseClause){
        this.compileCaseClause(e);
      }
      else{
        this.compileDefaultClause(e);
      }
    }
  }

  compileCaseClause(n: ts.CaseClause){
    const expr = this.compileExpression(n.expression);
    const case_value = new CaseValue(false, expr);
    this.values.push(case_value);
    for(let st of n.statements){
      this.compileFunctionStatement(st);
    }
  }

  compileDefaultClause(n: ts.DefaultClause){
    const default_value = new CaseValue(true);
    this.values.push(default_value);
    for(let st of n.statements){
      this.compileFunctionStatement(st);
    }
  }

  compileReturnExpression(expr: ts.Expression) {
    if (expr) {
      const kind = expr.kind;
      let retValue = new VarValue(this.getCurrentFunctionReturnType(), StorageScope.kReturn, 0);
      if (kind == ts.SyntaxKind.CallExpression) {
        this.compileCallExpression((expr as ts.CallExpression), retValue);
      } else {
        this.values.push(new BinaryOpValue(retValue,
                       ts.SyntaxKind.EqualsToken,
                     this.compileExpression(expr)));
      }
    }
    this.values.push(new ReturnValue());
  }

  compileExpression(expr: ts.Expression) : Value {
    switch(expr.kind) {
      case ts.SyntaxKind.BinaryExpression:
        return this.compileBinaryExpression(expr as ts.BinaryExpression);
      case ts.SyntaxKind.CallExpression:
        return this.compileCallExpression(expr as ts.CallExpression, undefined);
      case ts.SyntaxKind.PropertyAccessExpression:
        return this.compilePropertyAccessExpression(expr as ts.PropertyAccessExpression);
      case ts.SyntaxKind.Identifier:
        return this.compileIdentifier(expr as ts.Identifier);
      case ts.SyntaxKind.StringLiteral:
        return new LiterialValue(PrimitiveValueType.String, (expr as ts.StringLiteral).text);
      case ts.SyntaxKind.NumericLiteral:
        return new LiterialValue(PrimitiveValueType.Number, (expr as ts.NumericLiteral).text);
      case ts.SyntaxKind.ThisKeyword:
        return this.resolveThis();
      case ts.SyntaxKind.TrueKeyword:
        return new LiterialValue(PrimitiveValueType.Boolean, true);
      case ts.SyntaxKind.FalseKeyword:
        return new LiterialValue(PrimitiveValueType.Boolean, false);
      case ts.SyntaxKind.NewExpression:
        return this.compileNewExpression(expr as ts.NewExpression);
      case ts.SyntaxKind.ElementAccessExpression:
        return this.compileElementAccessExpression(expr as ts.ElementAccessExpression);
      case ts.SyntaxKind.PrefixUnaryExpression:
        return this.compilePrefixUnaryExpression(expr as ts.PrefixUnaryExpression);
      case ts.SyntaxKind.PostfixUnaryExpression:
        return this.compilePostfixUnaryExpression(expr as ts.PostfixUnaryExpression);
      case ts.SyntaxKind.ObjectLiteralExpression:
        return this.compileObjectLiteralExpression(expr as ts.ObjectLiteralExpression);
      case ts.SyntaxKind.ObjectLiteralExpression:
        return this.compileObjectLiteralExpression(expr as ts.ObjectLiteralExpression);
      case ts.SyntaxKind.TemplateExpression:
        return this.compileTemplateExpression(expr as ts.TemplateExpression);
      default:
        console.error(`unknown the expresstion: ${nodeToString(expr)}`);
    }
    return new NoneValue();
  }

  compilePropertyAccessExpression(expr: ts.PropertyAccessExpression) : Value {
    const thiz_value = this.compileExpression(expr.expression);
    const name = (expr.name as ts.Identifier).text;
    if (thiz_value.kind == ValueKind.kEnum) {
      const enum_value = thiz_value as EnumValue;
      const m = enum_value.enumNode.find(name);
      return new PropertyAccessValue(thiz_value, m as EnumMemberNode);
    } else if (thiz_value.type.kind == ValueTypeKind.kObject) {
      const m = (thiz_value.type as ObjectValueType).clazz.find(name);

      if (!m) {
       // TODO
       console.error(`cannot resolve the ${name}`);
       return new NoneValue();
      }

      if (m.kind == SemanticsType.kMethod)
        return new PropertyAccessValue(thiz_value, m as MethodNode);
      else if (m.kind == SemanticsType.kField)
        return new PropertyAccessValue(thiz_value, m as FieldNode);
    } else {
      console.error(`compilePropertyAccessExpression this value type: ${ValueTypeKind[thiz_value.type.kind]}`);
    }
    return new NoneValue();
  }

  compileTemplateExpression(expr: ts.TemplateExpression) : Value {
    const tmpl = this.createTemporaryValue(PrimitiveValueType.String);
    const start = this.cur_temporary;
    const builder = new BuildStringValue(tmpl, expr.head.text);

    for (const t of expr.templateSpans) {
      builder.add(this.compileExpression(t.expression), t.literal.text);
    }
    this.values.push(builder);

    this.cur_temporary = start;
    return tmpl;
  }

  compileObjectLiteralExpression(expr: ts.ObjectLiteralExpression) : Value {
    const module = this.module;
    let clazz = module.getTempClass(expr);
    //console.log("=== get clazz", clazz);

    const values: {p: FieldNode, v: Value}[] = [];
    let i = 0;
    for (const p of expr.properties) {
      if (p.kind == ts.SyntaxKind.PropertyAssignment) {
        const value = this.compileExpression(p.initializer);
        const f = clazz.find(p.name.getText()) as FieldNode;
        f.type = value.type;
        values.push({p: f, v: value});
      }
      i ++;
    }
    (clazz as ClassNode).updateFieldOffsets();

    let has_methods: boolean = false;
    this.push(clazz);
    for (const p of expr.properties) {
      if (p.kind == ts.SyntaxKind.MethodDeclaration) {
        const m = clazz.find(p.name.getText());
        this.compileFunction(m as MethodNode);
        has_methods = true;
      }
    }
    this.pop();

    if (!has_methods) {
      const new_class = module.combineTempClass(clazz);
      if (new_class) {
        clazz = new_class;
      } else { // remove the class
        module.uploadTempClass(clazz);
      }
    } else {
      module.uploadTempClass(clazz);
    }

    const pre_type = this.getPreType();
    if (pre_type  && pre_type.kind == ValueTypeKind.kObject) {
      clazz.addImplements((pre_type as ObjectValueType).clazz);
    }

    const clazzType : ObjectValueType = {kind: ValueTypeKind.kObject, clazz: clazz};
    const v = this.createTemporaryValue(clazzType);
    const start = this.cur_temporary;
    // new object value
    this.values.push(new BinaryOpValue(v, ts.SyntaxKind.EqualsToken,
                      NewValue.FromClazzType(clazzType, -1)));


    for (const pv of values) {
      this.values.push(new BinaryOpValue(
          new PropertyAccessValue(v, pv.p),
          ts.SyntaxKind.EqualsToken,
          pv.v));
    }

    this.cur_temporary = start;

    return v;
  }

  compileElementAccessExpression(expr: ts.ElementAccessExpression) : Value {
    const element = this.compileExpression(expr.expression);
    const arg = this.compileExpression(expr.argumentExpression);

    return new ElementAccessValue(element, arg);
  }

  compileNewExpression(expr: ts.NewExpression) : Value {
    if (expr.expression.kind != ts.SyntaxKind.Identifier) {
      console.error("NewExpression Need Identifier");
      return new NoneValue();
    }

    const class_name = (expr.expression as ts.Identifier).text;
    const clazzType = this.resolveClassLikeType(class_name);
    if (!clazzType) {
      console.error(`Cannot resolve class or interface: "${class_name}"`);
      return new NoneValue();
    }
    const clazz = clazzType.clazz;

    let start: number = -1;
    let ctr = clazz.getConstructor();
    if (ctr && expr.arguments && expr.arguments.length > 0) {
      this.compileParamters(ctr, expr.arguments);
      this.subTemporary(expr.arguments.length + 1);
      start = this.cur_temporary;
    }

    return NewValue.FromClazzType(clazzType, start);
  }

  isFunctionCallLikeExpression(kind: ts.SyntaxKind) : boolean {
    return kind == ts.SyntaxKind.CallExpression
         || kind == ts.SyntaxKind.NewExpression;
  }

  isNeedReturnExpression(kind: ts.SyntaxKind) : boolean {
    return kind == ts.SyntaxKind.CallExpression;
  }

  compileFunctionCallLikeExpression(expr: ts.Expression, ret: Value | undefined) : Value {
    switch(expr.kind) {
      case ts.SyntaxKind.CallExpression:
        return this.compileCallExpression(expr as ts.CallExpression, ret);
      case ts.SyntaxKind.NewExpression:
    return this.compileNewExpression(expr as ts.NewExpression);
    }
    return new NoneValue();
  }

  compileBinaryExpression(expr: ts.BinaryExpression) : Value {
    if (isEqualOperator(expr.operatorToken.kind)) {
      if (this.isNeedReturnExpression(expr.right.kind)) {
    const left_value = this.compileExpression(expr.left);
        const right_value = this.compileFunctionCallLikeExpression(expr.right, left_value);
    if (left_value.equals(right_value))
      return left_value;

    return new BinaryOpValue(left_value, expr.operatorToken.kind, right_value);
      }
    }

    const right_value = this.compileExpression(expr.right);
    const left_value = this.compileExpression(expr.left);
    return new BinaryOpValue(left_value, expr.operatorToken.kind, right_value);
  }
  compilePrefixUnaryExpression(expr : ts.PrefixUnaryExpression):Value{
    const operand_value = this.compileExpression(expr.operand);
    return new UnaryOpValue(expr.operator, operand_value, true);
  }
  compilePostfixUnaryExpression(expr : ts.PostfixUnaryExpression):Value{
    const operand_value = this.compileExpression(expr.operand);
    return new UnaryOpValue(expr.operator, operand_value, false);
  }
  compileIdentifier(id: ts.Identifier) : Value {
    return this.resolve(id.text, isVarValue);
  }

  compileParamters(func: FunctionLikeNode, args: ts.NodeArray<ts.Expression>) {
    let i = 0;
    this.values.push(this.createParameterCountValue(args.length));
    for (const arg of args) {
      const arg_value = this.compileExpression(arg);
      const type = func.getParamterType(i);
      this.pushPreType(type);
      if (arg_value.kind == ValueKind.kVar && ((arg_value as VarValue).storage == StorageScope.kTemporary)) {
        // in temporary
        if (type.kind == arg_value.type.kind) {
          this.popPreType();
          continue; // same type, use the return result directly
        } else {
         // reuse the temporary
         this.cur_temporary --;
        }
      }
      const arg_target = this.createParameterValue(type, arg_value);
      i++;
      this.values.push(arg_target);
      this.popPreType();
      //console.log(`parameter type ${ValueTypeKind[arg_target.type.kind]} value type: ${ValueTypeKind[arg_target.value.type.kind]}`);
    }
  }

  compileCallExpression(expr: ts.CallExpression, ret: Value|undefined) : Value {

    let ret_value = ret;
    let need_reset = false;
    const funcValue = this.compileExpression(expr.expression);
    if (!ret || ! IsLeftValue(ret)
             || ret.type.kind != funcValue.type.kind) {
      if (ret && ret.type.kind != ValueTypeKind.kAny) {
        ret_value.type = funcValue.type;
      } else {
        ret_value = this.createTemporaryValue(funcValue.type);
        need_reset = true;
      }
    }

    let i = 0;
    let func : FunctionLikeNode | undefined;
    if (funcValue.kind == ValueKind.kFunction) {
      func = (funcValue as FunctionValue).func;
    } else if (funcValue.kind == ValueKind.kPropertyAccess) {
      func = (funcValue as PropertyAccessValue).member as FunctionLikeNode;
    } else {
      // TODO
      console.error(`cannot resolve call object: funcValue: ${ValueKind[funcValue.kind]}`);
    }

    this.compileParamters(func, expr.arguments);

    this.subTemporary(expr.arguments.length + 1);
    this.values.push(new FunctionCallValue(funcValue, this.cur_temporary, ret_value));
    if (need_reset && ret && func.returnValueType.kind != ValueTypeKind.kVoid) {
      this.values.push(new BinaryOpValue(ret, ts.SyntaxKind.EqualsToken, ret_value));
    }
    return ret ? ret: ret_value;
  }
}


let std_module : StdModuleNode | undefined;
function GetStdModuleResolved() {
  if (!std_module) {
    const std_file =  path.join(__dirname, "../lib/std.d.ts");
    let program = compileFiles([std_file], {
                        noEmitOnError: true,
                        noImplicitAny: true,
                        target: ts.ScriptTarget.ES5,
                        module: ts.ModuleKind.CommonJS,
                        noEmit: true,
          });

    const sourceFile = program.getSourceFiles().filter(
              sourceFile => sourceFile.fileName == std_file
            )[0];

     const context = new BuildSemanticsContext(<SemanticsNode[]>[]);
     context.build(sourceFile, true);
     std_module = context.module as StdModuleNode;

     if (is_debug)
       std_module.dump(CreateDumpWriter());
  }

  return std_module;
}

export function CompileModule(sourceFile: ts.SourceFile, writer: Writer) {
  const buildContext = new BuildSemanticsContext([GetStdModuleResolved()]);
  buildContext.build(sourceFile, false);
  const module = buildContext.module;

  const compileContext = new CompilerContext(writer, module, GetStdModuleResolved());
  compileContext.compile();
  DumpModule(module);
}

export function ValueTypeToString(value: ValueType) : string {
  if (!value) {
    return "Undefined";
  }

  switch(value.kind) {
    case ValueTypeKind.kArray:
      return `[${ValueTypeToString((value as ArrayValueType).element)}]`;
    case ValueTypeKind.kSet:
      return `Set<${ValueTypeToString((value as SetValueType).element)}>`;
    case ValueTypeKind.kMap:
      return `Map<${ValueTypeToString((value as MapValueType).key)}, ${ValueTypeToString((value as MapValueType).value)}>`;
    case ValueTypeKind.kUnion: {
      const uv = value as UnionValueType;
      return uv.types.filter(t => ValueTypeToString(t)).join('|');
    }
    default:
      return ValueTypeKind[value.kind];
  }
}


function DumpModule(module: ModuleNode) {
  module.dump(CreateDumpWriter());
}

