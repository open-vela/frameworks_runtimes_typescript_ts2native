import * as ts from "typescript";
import * as s from "./node";
import {nodeToString} from '../compiler';

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


function createMethodDeclaration(m: ts.MethodDeclaration) : s.MethodDeclaration {
  let md : s.MethodDeclaration = {
    kind: s.NodeType.kMethod,
    name: (m.name as ts.Identifier).text,
    returnType: m.type,
    parameters: m.parameters
  }

  return md
}

function processClassDeclaration(clazz : ts.ClassDeclaration, mod: s.Module) {
  let c: s.Class = {
    kind: s.NodeType.kClass,
    name: clazz.name ? clazz.name.text : "unknown_class",
    node: clazz
  }

  if (clazz.modifiers) {
    // TODO
  }

  if (clazz.typeParameters) {
    // TODO
  }

  if (clazz.heritageClauses) {
    // TODO
  }

  if (clazz.members) {
    for (const m of clazz.members) {
      if (m.kind == ts.SyntaxKind.MethodDeclaration) {
        const md = createMethodDeclaration(m as ts.MethodDeclaration);
	if (c.methods) {
          c.methods.push(md);
	} else {
          c.methods = [md];
	}
      }
    }
  }

  if (mod.classes) {
    mod.classes.push(c)
  } else {
    mod.classes = [c];
  }
}

function processModuleVariable(var_st: ts.VariableStatement, mod: s.Module) {
  const declarations = var_st.declarationList.declarations;

  for (const decl of declarations) {
    const v : s.Variable = {
      kind: s.NodeType.kVariable,
      name: (decl.name as ts.Identifier).text,
      node: decl.type
    };
    if (mod.vars)
      mod.vars.push(v);
    else
      mod.vars = [v];
  }
}

function processModuleMember(node: ts.Node, mod: s.Module) {
  switch(node.kind) {
    case ts.SyntaxKind.ClassDeclaration:
      return processClassDeclaration(node as ts.ClassDeclaration, mod);
    case ts.SyntaxKind.VariableStatement:
      return processModuleVariable(node as ts.VariableStatement, mod);

    default:
      console.log("STD:", nodeToString(node)); 
  }
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

  ts.forEachChild(sourceFile, (node) => processModuleMember(node, mod));

  return mod;
}
