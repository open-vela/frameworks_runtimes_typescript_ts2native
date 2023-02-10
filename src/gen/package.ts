import * as ts from "typescript";
import * as s from '../semantics/node';

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
  offset: offset_t;

  constructor(kind: MemberType, name: string) {
    this.kind = kind;
    this.name = name;
    this.offset = 0;
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

  constructor(name: string) {
    super();
    this.name = name;
    this.object_size = PTR_SIZE;
    this.class_interface = new InterfaceEntry();
    this.size = 0;
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

  addMember(member: Member) {
    member.impl_name = `${TS_IMPL_PREFIX}${this.name}_${member.name}`;
    this.members.push(member);
    this.member_count ++;
  }

  writeSource(writer: PackageWriter) {
    for (const m of this.members) {
      writer.addSource(
`static int ${m.impl_name} (ts_object_t* self, ts_argument_t args, ts_return_t ret) {

`);

      writer.addSource(
`  // TODO
  return 0;
}`
      );
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
    printer(`${prefix}object vtable: ${this.name} (pool offset: ${this.object_name})`);
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
      printer(`${prefix}    name: ${m.name}`);
      printer(`${prefix}    offset: ${m.offset}`);
      printer("");
    }
  }
}

export class ConstPool {
  buffer: ArrayBuffer;
  view: DataView;
  current: number;

  constructor(size: number) {
    this.buffer = new ArrayBuffer(size);
    this.view = new DataView(this.buffer);
    this.current = 0;
  }

  pushStringUTF8(str: string) : offset_t {
   this.align(4);
   let pos = this.current;
   for (let i = 0; i < str.length; i ++) {
     this.view.setUint8(this.current++, str.charCodeAt(i));
   }
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

export class Module extends VTable {
  intialize: offset_t;

  module: s.Module;
  
  constructor(module: s.Module) {
    super('__ts_module');
    this.module = module;
    this.base_type = ts_object_base_type_t.ts_object_module;
    this.size = super.size + OFFSET_SIZE;
    this.addMember(new Member(MemberType.kMethod, 'initialize'));
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
}

export class Package {
  magic: int32_t;  // 'MVTP'
  size:  int32_t;
  pool_offset: offset_t;
  text_offset: offset_t;

  pool: ConstPool;
  module: Module;
  vtables: VTable[];
  executeCode?: Uint8Array;
  executeCodeSymbols?: ExecuteCodeSymbols;

  fileName: string;

  constructor(module: s.Module) {
    this.magic = 77 + (86 << 8)  + (84 << 16) + (80 << 24); // 'MVTP'
    this.size = 8; // header size

    this.fileName = module.name;

    this.pool = new ConstPool(1024*100);
    this.module = new Module(module);
    this.module.object_name = this.pool.pushStringUTF8(module.name);
    this.vtables = [];
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

  calcVTablesSize() : int32_t {
    let size = this.module.calcSize();
    for (const v of this.vtables) {
      size += v.calcSize();
    }
    return size;
  }

  updateSize() {
    this.size = 8;
    let vtables_size = this.calcVTablesSize();
    this.size += (vtables_size + 3) & ~3;
    this.pool_offset = this.size;
    this.size += this.pool.getSize();
    this.text_offset = this.size;
    this.size += this.executeCode.length;
  }

  writeSource(writer: PackageWriter) {
    this.module.writeSource(writer);
    for (const v of this.vtables) {
      v.writeSource(writer);
    }
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
    for (const v of this.vtables) {
      v.dump(printer, prefix + '  ');
    }
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
    for (const v of this.vtables) {
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
