import * as ts from "typescript";
import * as s from "./node";

function readBlockStatement(statements: ts.NodeArray<ts.Statement>) : s.BlockStatement {
  let block : s.BlockStatement = {
    kind: s.NodeType.kBlockStatement,
    statements: []
  };

  for (const s of statements) {
    if (s.kind >= ts.SyntaxKind.FirstStatement
	 && s.kind <= ts.SyntaxKind.LastStatement) {
      //let v : any = s as unknown;
      //v.index = 10;
      block.statements.push(s);
    }
  }

  return block;
}

export function buildModule(sourceFile: ts.SourceFile): s.Module | undefined {

  let mod_init : s.MethodDeclaration = {
    kind: s.NodeType.kMethod,
    name: "_module_intialize",
    block: readBlockStatement(sourceFile.statements)
  }

  let mod : s.Module = {
    kind: s.NodeType.kModule,
    node: sourceFile, 
    name: sourceFile.fileName,
    methods: [mod_init]
  }

  return mod;
}
