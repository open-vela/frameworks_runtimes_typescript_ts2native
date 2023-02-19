
import * as ts from "typescript";

export enum NodeType {
  kUnkown,
  kBlockStatement,
  kVariable,
  kFunction,
  kMethod,
  kClass,
  kModule,
}

export interface Node {
  readonly kind: NodeType;
  node?: ts.Node;
}

export interface BlockStatement extends Node {
  readonly kind: NodeType.kBlockStatement;
  statements: ts.Statement[];
}

export interface MethodDeclaration extends Node {
  readonly kind: NodeType.kMethod;
  readonly name: string;
  returnType?: ts.TypeNode;
  parameters?: ts.NodeArray<ts.ParameterDeclaration>;
  block?: BlockStatement;
}

export interface Class extends Node {
  readonly kind: NodeType.kClass | NodeType.kModule;
  readonly name: string;
  methods?: MethodDeclaration[];
}

export interface Variable extends Node {
  readonly kind: NodeType.kVariable;
  readonly name: string;
  node?: ts.TypeNode;
}

export interface Module extends Class {
  readonly kind: NodeType.kModule;
  node?: ts.SourceFile;
  classes?: Class[];
  vars?: Variable[];
}

