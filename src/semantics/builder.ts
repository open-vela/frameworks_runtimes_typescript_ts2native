import * as ts from "typescript";
import * as s from "./node";


export function buildModule(sourceFile: ts.SourceFile): s.Module | undefined {
  let mod : s.Module = {
    kind: s.NodeType.kModule,
    node: sourceFile, 
    name: sourceFile.fileName
  }

  // TODO

  return mod;
}
