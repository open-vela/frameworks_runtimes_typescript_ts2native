import * as ts from "typescript";

import {compileFiles, nodeToString} from './compiler';
import {CompileModule} from './resolver';
import {CCodeWriter} from './cwriter';
import {enable_debug, debug} from './debug';

interface GeneratorOptions {
  sources: string[];
  outDir: string;
  noEmit?: boolean;
  //outMode: PackageWriterMode;
  debug: boolean;
}

function visit(node: ts.Node, prefix) {
  console.log(prefix, nodeToString(node));
  ts.forEachChild(node, (node) => visit(node, prefix + '  '));
}

function debugAST(sourceFile: ts.SourceFile) {
  ts.forEachChild(sourceFile, (node) => visit(node, ''));
}

/*
function translateToNativePackage(sourceFile: ts.SourceFile, out_dir: string, mode: PackageWriterMode) {
  let module = buildModule(sourceFile);
  let pkg = makePackage(module);
  let writer = new NativeWriter(out_dir, mode);
  writePackage(pkg, writer).then(() => {
    console.log(`write package success: ${sourceFile.fileName}`);
  }).catch((e) => {
    console.error(`write package failed: ${sourceFile.fileName}`);
    console.error("[ERROR]", e);
  });
}*/


function compile(gen_options: GeneratorOptions, out_dir: string, options: ts.CompilerOptions): void {
  let program = compileFiles(gen_options.sources, options);

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.fileName == gen_options.sources[0]) {
      // Walk the tree to search for classes
      console.log("===========================================");
      debugAST(sourceFile);
      //ResolveSourceFile(sourceFile);
      //DumpResolvedNode(sourceFile);
      console.log("===========================================");
      //console.log("====== build the cpp bridget ====");
      //genCPPBridge(sourceFile, 'test/out');
      CompileModule(sourceFile, new CCodeWriter(gen_options.outDir));

      //if (!gen_options.noEmit)
      //  translateToNativePackage(sourceFile, gen_options.outDir, gen_options.outMode);
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

/////////////////////////////////////////////////////////
function parseArgs() : GeneratorOptions {
  let options: GeneratorOptions = {
    sources: [],
    outDir: "",
    noEmit: false,
    //outMode: PackageWriterMode.kSource,
    debug: true,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const opts = arg.slice(2).split('=');
      if (opts[0] == 'no-emit')
        options.noEmit = true;
      /*else if (opts[0] == 'out-mode') {
        if (opts[1] == 'source')
          options.outMode = PackageWriterMode.kSource;
        else if (opts[1] == 'binary')
          options.outMode = PackageWriterMode.kBinary;
      }*/ else if (opts[0] == 'out-dir') {
          options.outDir = opts[1];
      } else if (opts[0] == 'debug') {
	  options.debug = true;
      } else if (opts[0] == 'no-debug') {
          options.debug = false;
      }
    } else {
      options.sources.push(arg);
    }
  }
  return options;
}

const command_options = parseArgs();

console.log("== command:", command_options);

enable_debug(command_options.debug);

compile(command_options, process.argv[process.argv.length-1], {
  noEmitOnError: true,
  noImplicitAny: true,
  target: ts.ScriptTarget.ES5,
  module: ts.ModuleKind.CommonJS,
  allowJs: true,
  noEmit: true,
});
