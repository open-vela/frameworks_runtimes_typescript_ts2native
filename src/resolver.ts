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
}

export const VoidOrAnyValueType: UnionValueType = {kind: ValueTypeKind.kUnion, types: [ PrimitiveValueType.Void,  PrimitiveValueType.Any]};
export const PrimitiveArrayValueType : ArrayValueType[] = [
  {kind: ValueTypeKind.kArray, element: PrimitiveValueType.Any},
  {kind: ValueTypeKind.kArray, element: PrimitiveValueType.Int},
  {kind: ValueTypeKind.kArray, element: PrimitiveValueType.Number},
  {kind: ValueTypeKind.kArray, element: PrimitiveValueType.Boolean},
  {kind: ValueTypeKind.kArray, element: PrimitiveValueType.String},
]


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
  kLiteral,
  kBinaryOp,
  kCall,
  kParameter,
  kFunction,
  kPropertyAccess
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

export class FunctionCallValue extends Value {
  self: Value;
  param_start: number;
  ret: Value;

  constructor(funcValue: Value, start: number, ret: Value) {
    super(ValueKind.kCall, ret.type);
    this.self = funcValue;
    this.param_start = start;
    this.ret = ret;
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

function GetMemberValueType(m: MemberNode) : ValueType {
  if (m.kind == SemanticsType.kMethod)
    return (m as MethodNode).returnValueType;
  return PrimitiveValueType.Void;
}

export class PropertyAccessValue extends Value {
  thiz: Value;
  member: MemberNode; 
  
  constructor(thiz: Value, member: MemberNode) {
    super(ValueKind.kPropertyAccess, GetMemberValueType(member));
    this.thiz = thiz;
    this.member = member;
  }
}


const kCustroumerMemberStart = 4;

export interface Writer {
  setModule(m: ModuleNode); 

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

  subBlocks: BlockLikeNode[];

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

    const b = this.block;
    for (const v of m.vars) {
      if (!v.usedByClosure) {
        b.add(v);
      }
    }

    m.vars = m.vars.filter((v) => v.usedByClosure);
    let i = 0;
    for (const v of m.vars) {
      m.index = i ++;
    }

    super.calcLocalVars();
  }
}

export class ConstructorNode extends FunctionLikeNode {
  constructor(astNode: ts.Node) {
    super(SemanticsType.kConstructor, "__ctr__", astNode);
  }
}

export type MemberNode = MethodNode; // | FieldNode;

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
      //this.addMember(n as FieldNode);
    }
  }

  find(name: string) : SemanticsNode | undefined {
    for (const m of this.members) {
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
}

export class ClassNode extends ClassLikeNode {

  constructor(name: string, astNode: ts.Node) {
    super(SemanticsType.kClass, name, astNode);
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
    writer.writeLine(`VarNode: {type: ${ValueTypeToString(this.type)}, closure: ${this.usedByClosure}}`);
  }
}


type ModuleLikeNodeType = SemanticsType.kModule | SemanticsType.kStdModule;

export class ModuleLikeNode extends NamedNode {
  // imports
  classes: ClassNode[] = [];
  functions: FunctionNode[] = [];
  // interfaces
  vars: VarNode[] = [];

  initialize: ModuleInitializeNode;

  constructor(kind: ModuleLikeNodeType, name: string, astNode: ts.SourceFile) {
    super(kind, name, astNode);
    this.initialize = this.createModuleInitialzeMethod(astNode);
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
      default:
	// TODO ERROR
	break;
    }
  }

  createModuleInitialzeMethod(node: ts.SourceFile) : MethodNode {
    const m = new ModuleInitializeNode(node);
    m.add(new BlockNode(node));
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
	  || this.findFrom(name, this.classes);
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

class ContextBase {
  stacks: SemanticsNode[];
  module: ModuleLikeNode;
  tasks: BuildTask[];

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
    }
    console.error(`resolve "${name}" unknown type ${SemanticsType[node.kind]}`);
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

  createVarValue(v: ClosureableDataNode, index: number) {
    const parent = v.parent;
    if (parent.kind == SemanticsType.kModule) {
      return new VarValue(v.type, StorageScope.kModule, v.index);
    }
    if (parent.kind == SemanticsType.kStdModule) {
      return new VarValue(v.type, StorageScope.kGlobal, v.index);
    }

    // make closure
    let v_closure : ClosureDataNode | undefined = undefined;
    if (parent.kind == SemanticsType.kBlock
	|| parent.kind == SemanticsType.kFunction
        || parent.kind == SemanticsType.kMethod) {
      for(let i = this.stacks.length - 1; i > index; i --) {
        const n = this.stacks[i]
	if(n.kind == SemanticsType.kFunction
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
      return new VarValue(v.type, StorageScope.kParameter, v.index);
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
      }
    })

    this.flushTasks();

    this.buildModuleInitialize();
  }

  buildModuleInitialize() {
    const m = new MethodNode('initialize', this.module.astNode);
    m.index = 0;
    m.parent = this.module;
    m.returnValueType = PrimitiveValueType.Void;
    m.param_count = 0;
    this.module.initialize = m;
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

  buildClassLikeMember(m: ts.ClassElement) {
    switch(m.kind) {
      case ts.SyntaxKind.MethodDeclaration:
        this.buildMethodDeclaration(m as ts.MethodDeclaration);
        break;
      case ts.SyntaxKind.PropertyDeclaration:
	//TODO
        break;	
    }
  }

  buildMethodDeclaration(method: ts.MethodDeclaration) {
    const m = new MethodNode((method.name as ts.Identifier).text, method);
    this.addTo(m, [SemanticsType.kClass, SemanticsType.kInterface]);
    this.buildFunctionLike(m, method);
  }

  buildFunctionLike(m: FunctionLikeNode, method: ts.MethodDeclaration | ts.FunctionDeclaration) {
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

  createParameterCountValue(count: number) : VarValue {
    return this.createParameterValue(PrimitiveValueType.Int,
				     new LiterialValue(PrimitiveValueType.Int, count));
  }

  createParameterValue(type: ValueType, value: Value) : VarValue {
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

  compileClass(clazz: ClassNode) {

  }

  compileModuleInitialize() {
    this.compileFunction(this.module.initialize); 
  }

  compileFunction(func: FunctionLikeNode) {
    this.values = [];
    this.push(func);
    this.max_temporary = 0;
    this.cur_temporary = 0;

    if (func.astNode.kind == ts.SyntaxKind.SourceFile) {
      const sourceFile = func.astNode as ts.SourceFile;
      for (const s of sourceFile.statements) {
        this.compileFunctionStatement(s);
      }
    } else {
      const node = func.astNode as ts.FunctionLikeDeclaration;
      if (node.body) {
        if (node.body.kind == ts.SyntaxKind.Block) {
          this.compileFunctionStatement(node.body);
        } else {
          // one_expr = node.body as ts.Expression;
        }
      }
    }
    this.pop();
    func.temporary_count = this.max_temporary;
    func.calcLocalVars();
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
		SemanticsType.kMethod]);
	ts.forEachChild(n,  (node) => this.compileFunctionStatement(n));
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

      case ts.SyntaxKind.VariableStatement: {
	this.compileVariableStatement((n as ts.VariableStatement));
        break;
      }
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
	  if (!v.type) value_type = right.type;
          this.values.push(new BinaryOpValue(value, ts.SyntaxKind.EqualsToken, right));
	}
      }

      const vnode = new VarNode((v.name as ts.Identifier).text, value_type, v);
      this.addTo(vnode, [SemanticsType.kBlock]);
      value.index = vnode.index;
    }
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
    }
    return new NoneValue();
  }

  compilePropertyAccessExpression(expr: ts.PropertyAccessExpression) : Value {
    const thiz_value = this.compileExpression(expr.expression); 
    if (thiz_value.type.kind == ValueTypeKind.kObject) {
      const name = (expr.name as ts.Identifier).text;
      const m = (thiz_value.type as ObjectValueType).clazz.find(name);
      if (!m) {
	 // TODO
	 console.error(`cannot resolve the ${name}`);
	 return new NoneValue();
      }

      if (m.kind == SemanticsType.kMethod)
        return new PropertyAccessValue(thiz_value, m as MethodNode);
      else if (m.kind == SemanticsType.kField) {
        // TODO
      }
    } else {
      console.error(`compilePropertyAccessExpression this value type: ${ValueTypeKind[thiz_value.type.kind]}`);
    }
    return new NoneValue();
  }

  compileBinaryExpression(expr: ts.BinaryExpression) : Value {
    if (isEqualOperator(expr.operatorToken.kind)) {
      if (expr.right.kind == ts.SyntaxKind.CallExpression) {
	const left_value = this.compileExpression(expr.left);
        const right_value = this.compileCallExpression(expr.right as ts.CallExpression, left_value);
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

  compileCallExpression(expr: ts.CallExpression, ret: Value|undefined) : Value {

    let ret_value = ret;
    let need_reset = false;
    const funcValue = this.compileExpression(expr.expression);
    if (!ret || !(ret.kind == ValueKind.kVar
	          || ret.kind == ValueKind.kParameter
                  || ret.kind == ValueKind.kPropertyAccess)
             || ret.type.kind != funcValue.type.kind) {
      ret_value = this.createTemporaryValue(funcValue.type);
      need_reset = true;
    }

    this.values.push(this.createParameterCountValue(expr.arguments.length));
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

    for (const arg of expr.arguments) {
      const arg_value = this.compileExpression(arg);
      const arg_target = this.createParameterValue(func.getParamterType(i), arg_value);
      i++;
      this.values.push(arg_target);
    }
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

