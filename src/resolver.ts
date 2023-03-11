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
}

export class Value {
  readonly kind: ValueKind;
  type: ValueType;

  constructor(kind: ValueKind, type: ValueType) {
    this.kind = kind;
    this.type = type;
  }

  equal(v: Value) : boolean {
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

  equal(v: Value) : boolean {
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

  equal(v: Value) : boolean {
    if (super.equal(v)) {
      const p = v as ParameterValue;
      return p.storage == this.storage
           && p.index == this.index
           && this.value.equal(p.value);
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

  equal(v: Value) : boolean {
    if (super.equal(v)) {
      const b = v as BinaryOpValue;
      return b.op == this.op
           && this.left.equal(b.left)
	   && this.right.equal(b.right);
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
}

export class EnumNode extends NamedNode {
  type: ValueType = PrimitiveValueType.Undefined;
  members: EnumMemberNode[] = [];
  constructor(name: string, node: ts.Node) {
    super(SemanticsType.kEnum, name, node);
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
  offset32: number;
  offset64: number;

  constructor(name: string, type: ValueType, astNode: ts.Node) {
    super(SemanticsType.kField, name, astNode);
    this.type = type;
    this.offset32 = -1;
    this.offset64 = -1;
  }

  dump(writer: DumpWriter) {
    writer.writeLine(`Field '${this.name}':${ValueTypeToString(this.type)} @${this.index} Offset: ${this.offset32}, ${this.offset64}`);
  }
}


export type MemberNode = MethodNode | FieldNode;

type ClassLikeNodeType = SemanticsType.kClass | SemanticsType.kInterface;

class ClassLikeNode extends NamedNode {
  members: MemberNode[] = [];
  
  constructor(kind: ClassLikeNodeType, name: string, astNode: ts.Node) {
    super(kind, name, astNode);
  }

  addMember(member: MemberNode | undefined) {
    if (member) {
      member.index = this.members.length;
      member.parent = this;
      this.members.push(member);
    }
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

export class ClassNode extends ClassLikeNode {
  ctr?: ConstructorNode;
  fieldSize32: number = 0;
  fieldSize64: number = 0;

  constructor(name: string, astNode: ts.Node) {
    super(SemanticsType.kClass, name, astNode);
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
  vars: VarNode[] = [];
  enums: EnumNode[] = [];

  initialize: ModuleInitializeNode;

  constructor(kind: ModuleLikeNodeType, name: string, astNode: ts.SourceFile) {
    super(kind, name, astNode);
    this.initialize = this.createModuleInitialzeMethod(astNode);
    console.log("=== initalize:", SemanticsType[this.initialize.kind]);
  }

  addTo(nodes: SemanticsNode[], n: SemanticsNode) {
    n.index = nodes.length;
    nodes.push(n);
    n.parent = this;
  }

  add(n: SemanticsNode) {
    switch(n.kind) {
      case SemanticsType.kClass:
        this.addTo(this.classes, n);
        break;
      case SemanticsType.kFunction:
	this.addTo(this.functions, n);
        break;
      case SemanticsType.kVar:
	this.addTo(this.vars, n);
        break;
      case SemanticsType.kEnum:
	this.addTo(this.enums, n);
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

    ts.forEachChild(sourceFile, (node) => {
      switch(node.kind) {
      case ts.SyntaxKind.ClassDeclaration:
        this.buildClassDeclaration(node as ts.ClassDeclaration);
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
      }
    })

    this.flushTasks();
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

  buildClassLikeMember(m: ts.ClassElement) {
    switch(m.kind) {
      case ts.SyntaxKind.MethodDeclaration:
        this.buildMethodDeclaration(m as ts.MethodDeclaration);
        break;
      case ts.SyntaxKind.PropertyDeclaration:
	this.buildPropertyDeclaration(m as ts.PropertyDeclaration);
        break;	
      case ts.SyntaxKind.Constructor:
        this.buildConstructor(m as ts.ConstructorDeclaration);
        break;
    }
  }

  buildMethodDeclaration(method: ts.MethodDeclaration) {
    const m = new MethodNode((method.name as ts.Identifier).text, method);
    this.addTo(m, [SemanticsType.kClass, SemanticsType.kInterface]);
    this.buildFunctionLike(m, method);
  }

  buildConstructor(ctr: ts.ConstructorDeclaration) {
    const c = new ConstructorNode(ctr);
    this.addTo(c, [SemanticsType.kClass]);
    this.buildFunctionLike(c, ctr);
  }

  buildFunctionLike(m: FunctionLikeNode, method: ts.MethodDeclaration | ts.FunctionDeclaration | ts.ConstructorDeclaration) {
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
  }

  buildVariableStatement(varDec: ts.VariableStatement) {
    for (const v of varDec.declarationList.declarations) {
      let value : ValueType = PrimitiveValueType.Any;

      if (v.type) {
        value = this.getValueTypeFrom(v.type);
      } else if (v.initializer) {
        // TODO from initialize
      }

      const vnode = new VarNode((v.name as ts.Identifier).text, value, v);
      this.addToModule(vnode);
    }
  }

  buildPropertyDeclaration(p: ts.PropertyDeclaration) {
    let value: ValueType = PrimitiveValueType.Any;

    if (p.type) {
      value = this.getValueTypeFrom(p.type);
    }

    const field = new FieldNode((p.name as ts.Identifier).text, value, p);
    this.addTo(field, [SemanticsType.kClass, SemanticsType.kInterface]);
  }
}

class CompilerContext extends ContextBase {

  values: Value[];
  writer: Writer;
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
    this.values = [];
    this.push(func);
    this.max_temporary = 0;
    this.cur_temporary = 0;

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
    this.writer.writeFunction(func, this.values);
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
        }
        break;

      case ts.SyntaxKind.VariableStatement:
	this.compileVariableStatement((n as ts.VariableStatement));
        break;
      case ts.SyntaxKind.ReturnStatement:
	this.compileReturnStatement((n as ts.ReturnStatement));
        break;
    }
  }

  compileVariableStatement(varSt: ts.VariableStatement) {
    for (const v of varSt.declarationList.declarations) {
      let value_type : ValueType = PrimitiveValueType.Any;
      if (v.type) {
        value_type = this.getValueTypeFrom(v.type);
      }

      let value: VarValue | undefined = undefined;

      if (v.initializer) {
        value = new VarValue(value_type, StorageScope.kLocal, 0);
	if (v.initializer.kind == ts.SyntaxKind.CallExpression) {
	  let new_value = this.compileCallExpression(v.initializer as ts.CallExpression, value);
	  if (!v.type){
	    value_type = new_value.type;
	    value.type = value_type; // reset the value type
	  }
	} else {
          const right = this.compileExpression(v.initializer);
	  console.log("=========++++ ", ValueTypeKind[right.type.kind]);
	  if (!v.type) {
	    value_type = right.type;
	    value.type = value_type; // reset the value type
	  }
          this.values.push(new BinaryOpValue(value, ts.SyntaxKind.EqualsToken, right));
	}
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
      case ts.SyntaxKind.NewExpression:
	return this.compileNewExpression(expr as ts.NewExpression);
      case ts.SyntaxKind.ElementAccessExpression:
	return this.compileElementAccessExpression(expr as ts.ElementAccessExpression);
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
	if (left_value.equal(right_value))
	  return left_value;

	return new BinaryOpValue(left_value, expr.operatorToken.kind, right_value);
      }
    }

    const right_value = this.compileExpression(expr.right);
    const left_value = this.compileExpression(expr.left);
    return new BinaryOpValue(left_value, expr.operatorToken.kind, right_value);
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
      if (arg_value.kind == ValueKind.kVar && ((arg_value as VarValue).storage == StorageScope.kTemporary)) {
        // in temporary
	if (type.kind == arg_value.type.kind) {
	  continue; // same type, use the return result directly
	} else {
	  // reuse the temporary
	  this.cur_temporary --;
	}
      }
      const arg_target = this.createParameterValue(type, arg_value);
      i++;
      this.values.push(arg_target);
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

