
import * as ts from "typescript";

export enum NodeType {
  kUnkown,
  kBlockStatement,
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
  returnType?: ts.Node;
  parameters?: ts.Node[];
  block?: BlockStatement;
}

export interface Class extends Node {
  readonly kind: NodeType.kClass | NodeType.kModule;
  readonly name: string;
  methods?: MethodDeclaration[];
}

export interface Module extends Class {
  readonly kind: NodeType.kModule;
  node: ts.SourceFile;
}

