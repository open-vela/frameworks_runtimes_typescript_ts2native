/// <reference types="node" />

import * as p from './package';

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');


export class NativeWriter implements p.PackageWriter {
  readonly mode : p.PackageWriterMode;
  fdSource: number = 0;
  fdPackage: number = 0;
  sourcePath: string;
  outDir: string;

  constructor(outDir: string, mode: p.PackageWriterMode = p.PackageWriterMode.kBinary) {
    this.mode = mode;
    this.outDir = outDir;
  }

  createPackage(pkgName: string) : void {
    let file_path = this._makePath(pkgName, 'pkg');
    this.fdPackage = fs.openSync(file_path, "w");
  }

  writePackage(buffer: Uint8Array, size: number) : void {
    fs.writeSync(this.fdPackage, buffer, 0, size);
  }

  finishPackage() : void {
    if (this.fdPackage != 0) {
      fs.closeSync(this.fdPackage);
      this.fdPackage = 0;
    }
  }

  _makePath(name, ext_name) : string {
    let basename = path.basename(name, '.ts');
    return `${this.outDir}/${basename}.${ext_name}`;
  }

  createSourceFile(pkgName: string) : void {
    let file_path = this._makePath(pkgName, "c");
    this.fdSource = fs.openSync(file_path, "w");
    this.sourcePath = file_path;
    // add the header
    this.addSource("#define TS_NO_STD_LIBC\n");
    this.addSource("#include <ts_runtime.h>\n");
    this.addSource("#include <ts_lang.h>\n");
    this.addSource("#include <ts_std.h>\n");
  }

  addSource(source: string) : void {
    fs.writeSync(this.fdSource, source);
  }

  buildSource() : Promise<p.int32_t> {
    if (this.fdSource != 0) {
      fs.closeSync(this.fdSource);
      this.fdSource = 0;
    }

    let outObject = this.sourcePath.slice(0, -2) + ".o";
    let command = "cc";
    let args = [
	 "-Iruntime",
	 //"-O3",
	 "-DNODEBUG",
	 "-fno-stack-protector",
	 "-o",
	 outObject,
	 "-c",
	 this.sourcePath
    ];
    // build the source
    let build = child_process.spawn(command, args);

    console.log(command, args.join(' '))
    return new Promise<p.int32_t>((resolve, reject) => {
      build.stdout.on("data", (data) => {
        console.log("cc:", data.toString());
      });
      build.stderr.on("data", (data) => {
	console.error("[ERROR] cc:", data.toString());
      });
      build.on("error", (err) => {
	 console.error("[ERROR] cc:", err.toString());
      });
      build.on("exit", (code) => {
        if (code == 0)
          resolve(0);
        else
	  reject(code);
      });
    });
  }

  readExecuteCode() : Promise<Uint8Array|string> {
    let outObject = this.sourcePath.slice(0, -2) + ".o";
    let result = child_process.spawn("objdump", [
	    "-h", outObject]);
    return new Promise<number[]|string>((resolve, reject) => {
       let err_str = "";
       let text_size : number = -1;
       let text_offset : number = -1;
       result.stdout.on("data", (data) => {
         let lines = data.toString().split("\n");
	 for (let line of lines) {
           let cols = line.trim().split(/[ \t]+/);
  	   if (cols.length == 7 && cols[1] == '.text') {
             text_size = parseInt(cols[2], 16);
	     text_offset = parseInt(cols[5], 16);
	     //console.log("text :" , cols);
	     console.log(`==read text: offset: ${text_offset} size: ${text_size}`);
	     break;
	   }
	 } 
       });
       result.on("error", (err) => {
	 console.error("[ERROR] objdump:", err.toString());
	 err_str = err_str + "\n" +  err.toString();
       });

       result.on("exit", (code) => {
	 console.log("== exit:", code, text_size, text_offset);
         if (code == 0) {
	   if (text_size < 0)
	     reject(`${outObject} need .text section`)
           else
	     resolve([text_offset, text_size]);
	 } else
	   reject(err_str);
       });

    }).then<Uint8Array|string>((offsets: number[]) => {
      //console.log("======== offsets:", offsets);
      return new Promise< Uint8Array|string>((resolve, reject) => {
        fs.readFile(outObject, (err, data) => {
          if (err) reject(err.toString());
	  else {
	    //console.log("===== read:", data);
	    resolve(new Uint8Array(data.buffer, offsets[0], offsets[1]));
	  }
	});
      });
    });
  }

  readSymbolList(perfix: string) : Promise<p.ExecuteCodeSymbols> {
    let outObject = this.sourcePath.slice(0, -2) + ".o";
    let result = child_process.spawn("objdump", [
	    "-t", outObject]);
    return new Promise<p.ExecuteCodeSymbols>((resolve, reject) => {
      let symbols: p.ExecuteCodeSymbols = {};
      result.stdout.on("data", (data) => {
        let lines = data.toString().split("\n");
	//console.log("=== lines", lines);
	for (let line of lines) {
          let cols = line.trim().split(/[ \t]+/);
          if (cols.length == 6 && cols[5].startsWith(p.TS_IMPL_PREFIX)) {
	    //console.log("=== cols", cols);
	    symbols[cols[5]] = {
		    symbol: cols[5],
		    address: parseInt(cols[0], 16),
		    size: parseInt(cols[4], 16)
	         }
	  }
	}
      });
      result.on("error", (err) => {
        reject(err.toString());
      });
      result.on("exit", (code) => {
        if (code == 0) {
          resolve(symbols);
	} else {
          reject(`objdump -t ${outObject} failed: ${code}`);
	}
      });
    });
  }
}
