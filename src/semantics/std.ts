////////////////////////////////////////
// implements the std module

import * as ts from "typescript";
import * as s from "./node";
import {compileFiles} from '../compiler';
import {buildModule} from './builder';

export function loadStandareLibrary(std_file: string) : s.Module {
  let program = compileFiles([std_file], {
                        noEmitOnError: true,
                        noImplicitAny: true,
                        target: ts.ScriptTarget.ES5,
                        module: ts.ModuleKind.CommonJS,
                        noEmit: true,
          });

  
  
  return buildModule(program.getSourceFiles().filter(
        sourceFile => sourceFile.fileName == std_file
      )[0]);
}
