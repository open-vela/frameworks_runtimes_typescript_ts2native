
import * as ts from "typescript";

export enum NodeType {

  kModule,
}

export interface Node {
  readonly kind: NodeType;
  node?: ts.Node;
}

export interface Module extends Node {
  readonly kind: NodeType.kModule;
  node: ts.SourceFile;
  readonly name: string;
}
