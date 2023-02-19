/// <reference types="node" />

import * as ts from "typescript";
import * as s from '../semantics/node';
import {loadStandareLibrary} from '../semantics/std';

const path = require('path');

export type int8_t = number;
export type int16_t = number;
export type int24_t = number;
export type int32_t = number;
export type offset_t = number;

export const BUILD_64_BIT = true;

export const PTR_SIZE = BUILD_64_BIT ? 8 : 4;
export const VTABLE_BASE_COUNT = 4;
export const OFFSET_SIZE = BUILD_64_BIT ? 8 : 4;
export const TS_IMPL_PREFIX = "_ts_impl_";
export const LITTLE_ENDIAN = true;

export enum ts_object_base_type_t {
  ts_object_object,
  ts_object_primitive_begin,
  ts_object_int32,
  ts_object_uint32,
  ts_object_int64,
  ts_object_uint64,
  ts_object_boolean,
  ts_object_float,
  ts_object_double,
  ts_object_primitive_end = ts_object_double,
  ts_object_builtin_begin,
  ts_object_bigint = ts_object_builtin_begin,
  ts_object_string,
  ts_object_array,
  ts_object_map,
  ts_object_set,
  ts_object_builtin_end = ts_object_set,

  ts_object_function,
  ts_object_function_awaiter, // awaiter wrapper of async function
  ts_object_module,
}


function AlignPointer(size: offset_t) : offset_t {
  if (BUILD_64_BIT)
    return (size + 7) & ~7;
  else
    return (size + 3) & ~3;
}

function WriteOffset(view: DataView, pos: offset_t, size: offset_t) {
  if (BUILD_64_BIT) {
    if (LITTLE_ENDIAN) {
      view.setUint32(pos, size, LITTLE_ENDIAN);
      view.setUint32(pos + 4, 0, LITTLE_ENDIAN);
    } else {
      view.setUint32(pos, 0, LITTLE_ENDIAN);
      view.setUint32(pos + 4, size, LITTLE_ENDIAN);
    }
    return 8;
  } else {
    view.setUint32(pos, size, LITTLE_ENDIAN);
    return 4;
  }
}

function Write24(view: DataView, pos: offset_t, size: offset_t) {
  if (LITTLE_ENDIAN) {
    view.setUint16(pos, size & 0xffff, LITTLE_ENDIAN);
    view.setUint8(pos, size >> 8);
    return 3;
  } else {
    view.setUint8(pos, size >> 8);
    view.setUint16(pos, size & 0xffff, LITTLE_ENDIAN);
  }
}

function GetNodeData(node: ts.Node) : any | undefined {
  let v = node as unknown as any;
  return v.__data;
}

function GetNodeDataIndex(node: ts.Node) : offset_t {
  const d = GetNodeData(node);
  return d ? d.index : 0;
}

function SetNodeData(node: ts.Node, data: any) {
  let v = node as unknown as any;
  if (v.__data == undefined) {
    v.__data = data;
  } else {
    Object.assign(v.__data, data);
  }
}

export interface ExecuteCodeSymbol {
  symbol: string;
  address: offset_t;
  size:    int32_t;
}

export interface ExecuteCodeSymbols {
  [key: string] : ExecuteCodeSymbol;
}

export interface PackageWriter {
  createPackage(pkgName: string) : void;
  writePackage(buffer: Uint8Array, size: number) : void;
  finishPackage() : void;

  createSourceFile(pkgName: string) : void;
  addSource(source: string) : void;
  buildSource() : Promise<int32_t>;
  readExecuteCode() : Promise<Uint8Array|string>;
  readSymbolList(perfix: string) : Promise<ExecuteCodeSymbols|string>;
}

export function normalize_name(name: string) : string {
  let ret = path.parse(name);
  return ret.name;
}

class ObjectBase {
  size: int32_t;
}

export enum MemberType {
  kField,
  kMethod
};

export class Member {
  readonly kind: MemberType;
  name: string;
  impl_name: string;
  index: string;
  offset: offset_t;
  node: s.Node;

  constructor(kind: MemberType, name: string, node: s.Node, index: string) {
    this.kind = kind;
    this.name = name;
    this.node = node;
    this.offset = 0;
    this.index = index;
  }
}

enum VariableType {
  kUnknown,
  kPrimitiveTypeBegin,
  kInt = kPrimitiveTypeBegin,
  kUInt,
  kInt64,
  kUInt64,
  kBoolean,
  kFloat,
  kDouble,
  kNumber = kDouble,
  kVoid,
  kPrimitiveTypeEnd,
  kObject,
}

export class Variable {
  readonly kind: VariableType;
  value: s.Variable;
  type?: VTable; 

  constructor(kind: VariableType, v: s.Variable, type?: VTable) {
    this.kind = kind;
    this.value = v;
    this.type = type;
  }
}

export class InterfaceEntry extends ObjectBase {
  object_offset: int16_t; // uint16  
  member_offset: int16_t; // uint16

  constructor() {
    super();
    this.size = 4;
    this.object_offset = 0;
    this.member_offset = VTABLE_BASE_COUNT * PTR_SIZE;
  }

  write(view: DataView, pos: offset_t) : offset_t {
    view.setUint16(pos, this.object_offset, LITTLE_ENDIAN);
    view.setUint16(pos + 2, this.member_offset, LITTLE_ENDIAN);
    return 4;
  }

  dump(printer: { (...args: any[]) : void}, prefix: string) {
    printer(`${prefix}object_offset: ${this.object_offset}`);
    printer(`${prefix}member_offset: ${this.member_offset}`);
  }
}

export class ConstPool {
  buffer: ArrayBuffer;
  view: DataView;
  current: number;
  maps: Map<string, offset_t>;

  constructor(size: number) {
    this.buffer = new ArrayBuffer(size);
    this.view = new DataView(this.buffer);
    this.maps = new Map();
    this.current = 0;
  }

  pushStringUTF8(str: string) : offset_t {
    if(this.maps.has(str)) {
      return this.maps.get(str);
    }

    this.align(4);
    let pos = this.current;
    for (let i = 0; i < str.length; i ++) {
      this.view.setUint8(this.current++, str.charCodeAt(i));
    }
    this.maps.set(str, pos);
    return pos;
  }

  align(size: int32_t) {
    while((this.current % size) != 0) {
      this.view.setUint8(this.current ++, 0);
    }
  }

  getSize() : int32_t {
    this.align(8);
    return this.current;
  }
}

export class VTable extends ObjectBase {
  class_interface: InterfaceEntry;
  object_name: offset_t            = 0; // the offset of const pool
  super?: VTable;
  object_size: int24_t             = 0; // 24
  interfaces_count: int8_t         = 0;
  base_type: int8_t                = 0;
  function_return_type: int8_t     = 0;
  member_count: int16_t            = 0;
  ctr: offset_t                    = 0;
  destroy: offset_t                = 0;
  to_string: offset_t              = 0;
  gc_visit: offset_t               = 0;

  offset: offset_t                 = 0;
  index_in_module: int32_t         = 0;
  members: Member[] = [];

  name: string;
  clazz: s.Class;

  owner?: Package;

  constructor(clazz: s.Class, owner?: Package) {
    super();
    this.owner = owner;
    this.name = normalize_name(clazz.name);
    this.clazz = clazz;
    this.object_size = PTR_SIZE;
    this.class_interface = new InterfaceEntry();
    this.size = 0;
    this.updateMembers();
  }

  calcSize() : int32_t {
    this.size = AlignPointer(
	     this.class_interface.size // class_interface
           + OFFSET_SIZE // object_name
	   + PTR_SIZE // super index
	   + 3 // object_size
	   + 1 // interfaces_count
	   + 1 // base_type
	   + 1 // function_return_type
	   + 2 // member_count
	   + OFFSET_SIZE * VTABLE_BASE_COUNT
	   + OFFSET_SIZE * this.members.length);
    return this.size;
  }

  updateMembers() {
    if (this.clazz.methods) {
     let i : int32_t = 0;
     for (const m of this.clazz.methods) {
       if (m.kind == s.NodeType.kMethod) {
         this.addMember(new Member(MemberType.kMethod,
                        m.name, m, (i++) + ''));
       }
     }
    }
  }

  addMember(member: Member) {
    member.impl_name = `${TS_IMPL_PREFIX}${this.name}_${member.name}`;
    this.members.push(member);
    this.member_count ++;
  }

  writeSource(writer: PackageWriter) {
    for (const m of this.members) {
      if (m.kind == MemberType.kMethod) {
        writer.addSource(
`int ${m.impl_name} (ts_object_t* self, ts_argument_t args, ts_return_t ret) {
`);

        let context: MethodContext = new MethodContext(this, m);
	context.writeSource(writer);

        writer.addSource(
`  // TODO
  return 0;
}`
        );
      }
    }
  }

  updateConstPoolOffset(pool_offset: offset_t) {
    this.object_name += pool_offset;
  }

  updateExecuteOffset(symbols: ExecuteCodeSymbols, offset: offset_t) {
    for(const m of this.members) {
      if (m.impl_name in symbols) {
        m.offset = offset + symbols[m.impl_name].address;
      }
    }
  }

  write(view: DataView, pos: offset_t) : offset_t {
    this.offset = pos;
    pos += this.class_interface.write(view, pos);
    if (BUILD_64_BIT) { // align 8
      view.setUint32(pos, 0, LITTLE_ENDIAN);
      pos += 4;
    }
    pos += WriteOffset(view, pos, this.object_name - this.offset);
    pos += WriteOffset(view, pos, this.super ? this.super.index_in_module : 0);
    pos += Write24(view, pos, this.object_size);
    view.setUint8(pos, this.interfaces_count);
    pos ++;
    view.setUint8(pos, this.base_type);
    pos ++;
    view.setUint8(pos, this.function_return_type);
    pos ++;
    view.setUint16(pos, this.member_count, LITTLE_ENDIAN);
    pos += 2;
    pos += WriteOffset(view, pos, this.ctr > 0 ? this.ctr - this.offset : 0);
    pos += WriteOffset(view, pos, this.destroy > 0 ? this.destroy - this.offset : 0);
    pos += WriteOffset(view, pos, this.to_string > 0 ? this.to_string - this.offset : 0);
    pos += WriteOffset(view, pos, this.gc_visit > 0 ? this.gc_visit - this.offset : 0);

    for (const m of this.members) {
      if (m.kind == MemberType.kField) {
	pos += WriteOffset(view, pos, m.offset&0x7fffffff);
      } else {
        pos += WriteOffset(view, pos, (m.offset - this.offset)|0x80000000);
      }
    }
    return pos - this.offset;
  }

  dump(printer: { (...args: any[]) : void}, prefix: string) {
    printer(`${prefix}object vtable: ${this.name}@${this.offset} (pool offset: ${this.object_name})`);
    this.class_interface.dump(printer, prefix + '  ');
    printer(`${prefix}  object_size: ${this.object_size}`);
    printer(`${prefix}  interfaces_count: ${this.interfaces_count}`);
    printer(`${prefix}  base_type: ${ts_object_base_type_t[this.base_type]}`);
    printer(`${prefix}  function_return_type: ${this.function_return_type}`);
    printer(`${prefix}  member_count: ${this.member_count}`);
    printer(`${prefix}  constructor: ${this.ctr}`);
    printer(`${prefix}  destroy: ${this.destroy}`);
    printer(`${prefix}  to_string: ${this.to_string}`);
    printer(`${prefix}  gc_visit: ${this.gc_visit}`);
    printer(`${prefix}  vtable offset: ${this.offset}`);
    printer(`${prefix}  index_in_module: ${this.index_in_module}`);
    printer(`${prefix}  ==== members: ===`);
    for (const m of this.members) {
      printer(`${prefix}    kind: ${MemberType[m.kind]}`);
      printer(`${prefix}    name: ${m.name} (${m.impl_name})`);
      printer(`${prefix}    offset: ${m.offset}`);
      printer(`${prefix}    index: ${m.index}`);
      printer("");
    }
  }

  ////////////////////////////////////
  resolve(name: string) : Resolver | undefined {
    let i = 0;
    if (name == "contructor") {
      // TODO gen constructor 
      // return MemberResolver(ctr, "ts_method_constructor");
    } else if (name == "__finalize") {
      // TODO  ts_method_destroy
    } else if (name == "__gc_visitor") {
      // TODO ts_method_gc_visit
    } else if (name == "toString") {
      // TODO ts_method_to_string
    } else {
      for (const m of this.members) {
        if (m.name == name) {
          return new MemberResolver(m, "ts_method_last + " + i);
        }
        i ++;
      }
    }
    return undefined;
  }
}



export class Module extends VTable {
  vtables: VTable[];
  vars: Variable[];

  is_std: boolean = false;

  constructor(module: s.Module, owner?: Package) {
    super(module, owner);
    this.base_type = ts_object_base_type_t.ts_object_module;
    this.size = super.size + OFFSET_SIZE;

    this.vtables = [];
    if (module.classes) {
      for (const c of module.classes) {
        this.vtables.push(new VTable(c, owner));
      }
    }

    this.vars = [];
    if (module.vars) {
      for (const v of module.vars) {
        this.vars.push(this.createVariable(v));
      }
    }
  }

  createVariable(v : s.Variable) : Variable {
    let kind : VariableType = VariableType.kUnknown;
    let vtable: VTable | undefined = undefined;
    if (v.node) {
      switch(v.node.kind) {
        case ts.SyntaxKind.TypeReference: {
	    kind = VariableType.kObject;
	    const ref = v.node as ts.TypeReferenceNode;
	    if (ref.typeName.kind == ts.SyntaxKind.Identifier) {
  	      vtable = this.findVTable((ref.typeName as ts.Identifier).text);
	    } else if (ref.typeName.kind == ts.SyntaxKind.QualifiedName) {
	      // TODO
	    }
	  }
	  break;
	default:
	  break;
      }
    }

    return new Variable(kind, v, vtable);
  }

  get module() : s.Module {
    return this.clazz as s.Module;
  }

  calcObjectSize() {
    this.object_size = PTR_SIZE // vtable size
          + PTR_SIZE // package
	  + PTR_SIZE // runtime
	  + PTR_SIZE // imports
	  + PTR_SIZE // values
	  + PTR_SIZE // functions
	  + PTR_SIZE // classes
	  + PTR_SIZE // interfaces;
	  + PTR_SIZE * 5; // sizeof(ts_vtable_env_t)
  }

  calcSize() : int32_t {
    let size = super.calcSize();
    this.size = size;
    for (const v of this.vtables) {
      v.offset = size;
      size += v.calcSize();
    }
    return size;
  }

  writeSource(writer: PackageWriter) {
    super.writeSource(writer);
    for (const v of this.vtables) {
      v.writeSource(writer);
    }
  }

  dump(printer: { (...args: any[]): void}, prefix: string) {
    super.dump(printer, prefix);

    for (const v of this.vtables) {
      v.dump(printer, prefix + '  ');
    }
  }

  findVTable(name: string) : VTable | undefined {
    for (const c of this.vtables) {
      if (c.name == name) {
	return c;
      }
    }
    return undefined;
  }

  //////////////////////////////////////////////
  resolve(name: string) : Resolver | undefined {
    // resolve as class

    let i = 0;
    for (const c of this.vtables) {
      if (c.name == name) {
        return new ClassResolver(i+"", c, this);
      }
      i ++;
    }

    // resolve the module object
    i = 0;
    for (const v of this.vars) {
      if (v.value.name == name) {
        return new ObjectResolver(
		this.is_std ? ScopeType.kStdModuleScope : ScopeType.kModuleScope,
		i + "", v.type);
      }
      i ++;
    }

    return undefined;
  }
}

export class Package {
  magic: int32_t;  // 'MVTP'
  size:  int32_t;
  pool_offset: offset_t;
  text_offset: offset_t;

  pool: ConstPool;
  module: Module;
  executeCode?: Uint8Array;
  executeCodeSymbols?: ExecuteCodeSymbols;

  fileName: string;
  stdModule: Module;

  constructor(module: s.Module) {
    this.magic = 77 + (86 << 8)  + (84 << 16) + (80 << 24); // 'MVTP'
    this.size = 8; // header size

    this.fileName = module.name;
    this.stdModule = GetStdModule();

    this.pool = new ConstPool(1024*100);
    this.module = new Module(module, this);
    this.module.object_name = this.pool.pushStringUTF8(module.name);

    this.processSourceFile(module.node);
    this.updateSize(); // calc the size except executed code
  }

  processSourceFile(sourceFile: ts.SourceFile) {
    ts.forEachChild(sourceFile, (node) => this.processNode(node));
  }

  processNode(node: ts.Node) {
    switch(node.kind) {
      case ts.SyntaxKind.StringLiteral:
        // add the string
	SetNodeData(node, {index: this.pool.pushStringUTF8(
		(node as ts.StringLiteral).text)});
	break;
    }

    ts.forEachChild(node, (node) => this.processNode(node));
  }

  async makeExecute(writer: PackageWriter) {
    writer.createSourceFile(this.fileName);
    this.writeSource(writer);
    let code = await writer.buildSource();
    if (code == 0) {
      console.log("=== build source success!");
      this.executeCode = await writer.readExecuteCode() as Uint8Array;
      //console.log("execute:", this.executeCode);
      this.executeCodeSymbols = await writer.readSymbolList(TS_IMPL_PREFIX) as ExecuteCodeSymbols;
      console.log("symbols:", this.executeCodeSymbols);
      console.log("===== end");
    }
  }

  updateSize() {
    this.size = 8;
    this.module.offset = this.size;
    let vtables_size = this.module.calcSize();
    this.size += (vtables_size + 3) & ~3;
    this.pool_offset = this.size;
    this.size += this.pool.getSize();
    this.text_offset = this.size;
    if (this.executeCode)
      this.size += this.executeCode.length;
  }

  writeSource(writer: PackageWriter) {
    this.module.writeSource(writer);
  }

  writePackage(writer: PackageWriter) {
    this.updateSize();
    // write header
    writer.createPackage(this.fileName);
    this.writeHeaderAndVTables(writer);
    this.writeConstPool(writer);
    this.writeExecuteCode(writer);
    writer.finishPackage();
  }

  dump(printer : { (...args: any[]): void}, prefix: string) {
    printer(`${prefix}>>>>>>>>>${this.fileName}>>>>>>>>>>>`)
    printer(`${prefix}pool_offset: ${this.pool_offset}`);
    printer(`${prefix}text_offset: ${this.text_offset}`);
    this.module.dump(printer, prefix + '  ');
    printer(`${prefix}<<<<<<<<<${this.fileName}<<<<<<<<<<<`)
  }

  writeHeaderAndVTables(writer: PackageWriter) {
    console.log(`===== size: ${this.size} pool_offset: ${this.pool_offset}`);
    let array = new ArrayBuffer(this.pool_offset);
    let view = new DataView(array);
    let pos = 0;
    view.setUint32(pos, this.magic, LITTLE_ENDIAN);
    pos += 4;
    view.setUint32(pos, this.size, LITTLE_ENDIAN);
    pos += 4;
    this.module.updateConstPoolOffset(this.pool_offset);
    this.module.updateExecuteOffset(this.executeCodeSymbols, this.text_offset);
    pos += this.module.write(view, pos);
    for (const v of this.module.vtables) {
      v.updateConstPoolOffset(this.pool_offset);
      v.updateExecuteOffset(this.executeCodeSymbols, this.text_offset);
      pos += v.write(view, pos);
    }
    while(pos % 8 != 0) {
      view.setUint8(pos++, 0);
    }

    writer.writePackage(new Uint8Array(array), pos);
  }

  writeConstPool(writer: PackageWriter) {
    writer.writePackage(new Uint8Array(this.pool.buffer), this.pool.getSize());
  }

  writeExecuteCode(writer: PackageWriter) {
    writer.writePackage(this.executeCode, this.executeCode.length);
  }


  //////////////////////////////////////
  resolve(name: string) : Resolver | undefined {
    let resolver = this.module.resolve(name);
    if (resolver) return resolver;
    return this.stdModule.resolve(name);
  }
}


export function makePackage(module: s.Module) : Package {
  let pkg : Package = new Package(module);


  return pkg;
}

export async function writePackage(pkg: Package, writer: PackageWriter) {
  await pkg.makeExecute(writer);
  pkg.writePackage(writer);
  pkg.dump(console.log, '');
}

/////////////////////////////////////////////////////////
enum ResolverType {
  kUnknownResolver,
  kObjectResolver,
  kFunctionResolver,
  kClassResolver,
  kEnumResolver,
  kMemberResolver,
  kPropertyAccessResolver,
  kCallResolver 
}

enum ScopeType {
  kScopeUnknown,
  kThisScope,
  kParamterScope,
  kLocalScope,
  kStdModuleScope,
  kModuleScope
}

function ObjectFromScope(type: ScopeType, obj_idx: string) : string {
  switch(type) {
    case ScopeType.kLocalScope:
      return `TS_LOCAL_OBJECT(${obj_idx})`;
    case ScopeType.kStdModuleScope:
      return `ts_module_object_of(rt->std_module, ${obj_idx})`;
    case ScopeType.kModuleScope:
      return `ts_module_object_of(module, ${obj_idx})`;
  }
  return '';
}

interface Resolver {
  readonly kind: ResolverType;
  parent?: Resolver;
  resolve(name: string): Resolver | undefined;
}

class UnknownResolver implements Resolver {
  readonly kind: ResolverType.kUnknownResolver;
  resolve(name: string): Resolver | undefined {
    return undefined;
  }

  constructor() {
    this.kind = ResolverType.kUnknownResolver;
  }
}

class ObjectResolver implements Resolver {
  readonly kind: ResolverType.kObjectResolver;
  scope: ScopeType;
  object_index: string;
  vtable?: VTable;

  constructor(scope: ScopeType, object_index: string, vtable?: VTable) {
    this.kind = ResolverType.kObjectResolver;
    this.scope = scope;
    this.object_index = object_index;
    this.vtable = vtable;
  }

  resolve(name: string): Resolver | undefined {
    if (this.vtable) return this.vtable.resolve(name);
    return undefined;
  }
}

class ClassResolver implements Resolver {
  readonly kind: ResolverType.kClassResolver;
  object_index: string;
  vtable: VTable;
  own: Module;

  constructor(object_index: string, vtable: VTable, own: Module) {
    this.object_index = object_index;
    this.vtable = vtable;
    this.own = own;
  }

  resolve(name: string) : Resolver | undefined {
    // TODO read static member of class
    return undefined;
  }
}

class MemberResolver implements Resolver {
  readonly kind: ResolverType.kMemberResolver;
  member: Member;
  index: string;

  constructor(m: Member, idx: string) {
    this.kind = ResolverType.kMemberResolver;
    this.member = m;
    this.index = idx;
  }

  resolve(name: string) : Resolver | undefined {
    return undefined;
  }
}

interface PropertyAccessResolver extends Resolver {
  readonly kind: ResolverType.kPropertyAccessResolver;
  type: MemberType;
  index: string;
}

interface CallResolver extends Resolver {
  readonly kind: ResolverType.kCallResolver;
  scope: ScopeType;
  object_index: string;
  method_index: string; 
}

class FunctionResolver implements Resolver {
  readonly kind: ResolverType.kFunctionResolver;
  this_vtable: VTable;
  pkg: Package;
  //arguments: 
  //local_vars

  constructor(thiz_vt: VTable, pkg: Package/*, arguments*/) {
    this.kind = ResolverType.kFunctionResolver;
    this.this_vtable = thiz_vt;
    this.pkg = pkg;
  }

  resolve(name: string): Resolver | undefined {
    if (name == "this") {
      return new ObjectResolver(ScopeType.kThisScope, "self", this.this_vtable);
    }
    // if (arguments) { // find in arguments
    // }
    // if (local_vars) { // find in local_vars
    // }

    // find in pkg
    return this.pkg.resolve(name);
  }
}


class MethodContext {
  pkg: Package;
  self: VTable;
  member: Member;
  method: s.MethodDeclaration;
  blockSource: string;
  localObjectCount: int32_t;
  resolvers: Resolver[];
  rootResover: FunctionResolver;
  prefix: string;
  call_deep: int32_t = 0;

  constructor(self: VTable, m: Member) {
    this.pkg = self.owner;
    this.self = self;
    this.member = m;
    this.method = m.node as s.MethodDeclaration;
    this.blockSource = "";
    this.localObjectCount = 0;
    this.rootResover = new FunctionResolver(self, this.pkg);
    this.resolvers = [this.rootResover];
    this.prefix = "";
  }

  topResolver() : Resolver {
    return this.resolvers[this.resolvers.length - 1];
  }

  writeSource(writer: PackageWriter) {
    this.buildSource(); 
    
    writer.addSource(`  ts_module_t* module = ts_module_from_object(self);\n`)
    writer.addSource(`  ts_runtime_t* rt = module->runtime;\n`)
    if (this.localObjectCount > 0) {
      writer.addSource(
`  TS_PUSH_LOCAL_SCOPE(rt, ${this.localObjectCount});\n`
      );
    }

    writer.addSource(this.blockSource);
    if (this.localObjectCount > 0) {
      writer.addSource(`  TS_POP_LOCAL_SCOPE(rt);`);
    }
  }

  buildSource() {
    for (const statement of this.method.block.statements) {
      this.buildNodeSource(statement);
    } 
  }

  buildNodeSource(statement: ts.Statement) {
    switch(statement.kind) {
      case ts.SyntaxKind.ExpressionStatement:
        this.buildExpression((statement as ts.ExpressionStatement).expression);
        break;
      case ts.SyntaxKind.IfStatement:
	break;
      case ts.SyntaxKind.DoStatement:
	break;
      case ts.SyntaxKind.WhileStatement:
        break;
      case ts.SyntaxKind.ForStatement:
	break;
      case ts.SyntaxKind.ForInStatement:
	break;
      case ts.SyntaxKind.ForOfStatement:
	break;
      case ts.SyntaxKind.ReturnStatement:
	break;
      case ts.SyntaxKind.WithStatement:
	break;
      case ts.SyntaxKind.SwitchStatement:
	break;
      case ts.SyntaxKind.LabeledStatement:
	break;
      case ts.SyntaxKind.ThrowStatement:
	break;
      case ts.SyntaxKind.TryStatement:
	break;
    }
  }

  buildExpression(expression: ts.Expression) {
    switch(expression.kind) {
      case ts.SyntaxKind.CallExpression:
	this.buildCallExpression((expression as ts.CallExpression));
        break;
      case ts.SyntaxKind.PropertyAccessExpression:
	this.buildPropertyAccessExpression((expression as ts.PropertyAccessExpression));
        break;
      case ts.SyntaxKind.Identifier:
	this.resolveIdentifier((expression as ts.Identifier).text);
        break;
    }
  }

  buildPropertyAccessExpression(propexpr: ts.PropertyAccessExpression) {
    this.buildExpression(propexpr.expression);
    if (propexpr.questionDotToken) {
      // TODO
    }

    this.resolveMember(propexpr.name.text);
  }

  resolveIdentifier(name: string) {
    console.log(`=== ${ResolverType[this.topResolver().kind]}`);
    let resolver = this.topResolver().resolve(name); 
    if (!resolver) {
      console.log(`==== error! cannot resolve the name: "${name}"`);
      return;
    }

    this.pushResolver(resolver);
  }

  resolveMember(name: string) {
    let resolver = this.topResolver().resolve(name);
    if (!resolver) {
      // TODO ERROR
      return; 
    }

    this.pushResolver(resolver);
  }

  pushResolver(resolver: Resolver) {
    if (resolver.kind == ResolverType.kUnknownResolver) {
       // TODO
       console.error("unknown resolver");
       return;
    }
    this.resolvers.push(resolver);
  }

  pushAndMergeResolver(resolver: Resolver) {
    const len = this.resolvers.length;
    if (len >= 2) {
      if (this.resolvers[len - 2].kind == ResolverType.kCallResolver) {
        if (this.resolvers[len -1].kind == ResolverType.kObjectResolver
	    && resolver.kind == ResolverType.kPropertyAccessResolver
            && (resolver as PropertyAccessResolver).type == MemberType.kMethod) {
	  const obj = this.resolvers.pop() as ObjectResolver;
	  const call = this.resolvers[len - 2] as CallResolver;
	  call.scope = obj.scope;
	  call.object_index = obj.object_index;
	  call.method_index = (resolver as PropertyAccessResolver).index;
	  return;
	}
      }
    }
 
    this.pushResolver(resolver);
  }

  buildCallExpression(callexpr: ts.CallExpression) {
    this.buildExpression(callexpr.expression);
    const resolver = this.resolvers.pop();
    if (!resolver) {
      // TODO Error
      return;
    }

    let param_deep = this.call_deep ++;

    this.addSource(`  ${this.prefix}do {\n`);

    if (callexpr.questionDotToken) {
      // TODO
    }
    if (callexpr.typeArguments) {
      // TODO
    }

    this.addSource(`  ${this.prefix}  ts_value_t __return${param_deep};`);
    this.addSource(`    ${this.prefix}ts_value_t __arguments${param_deep}[${callexpr.arguments.length + 1}];\n`);
    this.addSource(`    ${this.prefix}__arguments${param_deep}[0].lval = ${callexpr.arguments.length} & 0xff;\n`);
    for (let i = 0; i < callexpr.arguments.length; i ++) {
      // TODO
      this.makeCallParam(`__arguments${param_deep}[${i+1}]`, callexpr.arguments[i]);
    }

    //callexpr.arguments
    if (resolver.kind == ResolverType.kMemberResolver) {
      const member_resolver = resolver as MemberResolver;
      const object_resolver = this.resolvers.pop() as ObjectResolver;
      let object_module : string = ObjectFromScope(object_resolver.scope, object_resolver.object_index)
      this.addSource(
`    ${this.prefix}ts_method_call(
	${this.prefix}${object_module},
	${this.prefix}${member_resolver.index},
	${this.prefix}__arguments${param_deep},
	${this.prefix}&__return${param_deep});

`
        );
    } else if (resolver.kind == ResolverType.kObjectResolver) {
      const object_resolver = resolver as ObjectResolver;
      const object_module : string = ObjectFromScope(object_resolver.scope, object_resolver.object_index);
      this.addSource(
`    ${this.prefix}ts_function_call(${object_module}, __arguments${param_deep}, &__return${param_deep});
`
        );
    }
    this.addSource(`  ${this.prefix}}while(0);\n`);
    this.call_deep --;
  }

  makeCallParam(outname: string, arg: ts.Expression) {
    switch(arg.kind) {
      case ts.SyntaxKind.StringLiteral:
	this.addSource(
`    ${this.prefix}${outname}.object = (ts_object_t*)(TS_STRING_NEW_STACK(rt, TS_OFFSET(const char, OBJECT_VTABLE(self), ${this.pkg.pool_offset} + ${GetNodeDataIndex(arg)} - ${this.self.offset})));
`
          );
        break;
      // TODO
    }
  }

  addSource(s: string) {
    this.blockSource = this.blockSource + s;
  }
}

////////////////////////////////////////////////////////
// std module
let std_module : Module | undefined;

function GetStdModule() : Module {
  if (std_module) return std_module;

  const std_file =  path.join(__dirname, "../../lib/std.d.ts");

  std_module = new Module(loadStandareLibrary(std_file));
  std_module.is_std = true;
  console.log("=============== standare library ==============");
  std_module.dump(console.log, '');
  console.log("===============================================");
  return std_module;
}


