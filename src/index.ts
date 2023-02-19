import * as ts from "typescript";

import {buildModule} from './semantics/builder';
import {makePackage, writePackage} from './gen/package';
import {NativeWriter} from './gen/writer';
import {compileFiles, nodeToString} from './compiler';


function visit(node: ts.Node, prefix) {
  console.log(prefix, nodeToString(node));
  ts.forEachChild(node, (node) => visit(node, prefix + '  '));
}

function debugAST(sourceFile: ts.SourceFile) {
  ts.forEachChild(sourceFile, (node) => visit(node, ''));
}

function translateToNativePackage(sourceFile: ts.SourceFile, out_dir: string) {
  let module = buildModule(sourceFile);
  let pkg = makePackage(module);
  let writer = new NativeWriter(out_dir);
  writePackage(pkg, writer).then(() => {
    console.log(`write package success: ${sourceFile.fileName}`);
  }).catch((e) => {
    console.error(`write package failed: ${sourceFile.fileName}`);
    console.error("[ERROR]", e);
  });
}


function compile(fileNames: string[], out_dir: string, options: ts.CompilerOptions): void {
  let program = compileFiles(fileNames, options);

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.fileName == fileNames[0]) {
      // Walk the tree to search for classes
      console.log("===========================================");
      debugAST(sourceFile);
      console.log("===========================================");
      //console.log("====== build the cpp bridget ====");
      //genCPPBridge(sourceFile, 'test/out');
      translateToNativePackage(sourceFile, out_dir);
    }
  }
}

function show_programer(program: ts.Program) {
  console.log("NodeCount:", program.getNodeCount());
  console.log("IdentifierCount:", program.getIdentifierCount());
  console.log("SymbolCount:", program.getSymbolCount());
  console.log("TypeCount:", program.getTypeCount());
  console.log("InstantiationCount", program.getInstantiationCount())
  console.log("ReleationCacheSizes", program.getRelationCacheSizes())
}


compile(process.argv.slice(2, -1), process.argv[process.argv.length-1], {
  noEmitOnError: true,
  noImplicitAny: true,
  target: ts.ScriptTarget.ES5,
  module: ts.ModuleKind.CommonJS,
  noEmit: true,
});
