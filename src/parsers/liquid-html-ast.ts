import {
  ConcreteNodeTypes,
  toLiquidHtmlCST,
  LiquidHtmlConcreteNode,
  ConcreteAttributeNode,
  ConcreteLiquidNode,
  ConcreteTextNode,
  ConcreteTagClose,
  ConcreteLiquidTagClose,
  LiquidHtmlCST,
} from './liquid-html-cst';
import { assertNever } from '../utils';
import * as R from 'ramda';

class ParsingError extends Error {}

export enum NodeTypes {
  Document = 'Document',
  LiquidTag = 'LiquidTag',
  LiquidDrop = 'LiquidDrop',
  SelfClosingElementNode = 'SelfClosingElementNode',
  VoidElementNode = 'VoidElementNode',
  ElementNode = 'ElementNode',
  AttrSingleQuoted = 'AttrSingleQuoted',
  AttrDoubleQuoted = 'AttrDoubleQuoted',
  AttrUnquoted = 'AttrUnquoted',
  AttrEmpty = 'AttrEmpty',
  TextNode = 'TextNode',
}

export type LiquidHtmlAST = LiquidHtmlNode[];

export type LiquidHtmlNode = DocumentNode | LiquidNode | HtmlNode | AttributeNode | TextNode;

export interface DocumentNode extends ASTNode<NodeTypes.Document> {
  source: string;
  children: LiquidHtmlAST;
}

export type LiquidNode = LiquidTag | LiquidDrop;

export interface LiquidTag extends ASTNode<NodeTypes.LiquidTag> {
  name: string;
  markup: string;
  children?: LiquidHtmlAST;
  whitespaceStart: '-' | '';
  whitespaceEnd: '-' | '';
  delimiterWhitespaceStart?: '-' | '';
  delimiterWhitespaceEnd?: '-' | '';
}

export interface LiquidDrop extends ASTNode<NodeTypes.LiquidDrop> {
  markup: string;
  whitespaceStart: '-' | '';
  whitespaceEnd: '-' | '';
}

export type HtmlNode =
  | ElementNode
  | SelfClosingElementNode
  | VoidElementNode;

export interface ElementNode extends HtmlNodeBase<NodeTypes.ElementNode> {
  children: LiquidHtmlAST;
}
export interface SelfClosingElementNode
  extends HtmlNodeBase<NodeTypes.SelfClosingElementNode> {}
export interface VoidElementNode
  extends HtmlNodeBase<NodeTypes.VoidElementNode> {}

export interface HtmlNodeBase<T> extends ASTNode<T> {
  name: string;
  attributes: AttributeNode[];
}

export type AttributeNode =
  | AttrSingleQuoted
  | AttrDoubleQuoted
  | AttrUnquoted
  | AttrEmpty;

export interface AttrSingleQuoted
  extends AttributeNodeBase<NodeTypes.AttrSingleQuoted> {}
export interface AttrDoubleQuoted
  extends AttributeNodeBase<NodeTypes.AttrDoubleQuoted> {}
export interface AttrUnquoted
  extends AttributeNodeBase<NodeTypes.AttrUnquoted> {}
export interface AttrEmpty extends ASTNode<NodeTypes.AttrEmpty> {
  name: string;
}

export interface AttributeNodeBase<T> extends ASTNode<T> {
  name: string;
  value: (TextNode | LiquidNode)[];
}

export interface TextNode extends ASTNode<NodeTypes.TextNode> {
  value: string;
}

export interface ASTNode<T> {
  type: T;
  position: {
    start: number;
    end: number;
  };
}

export function toLiquidHtmlAST(text: string): DocumentNode {
  const cst = toLiquidHtmlCST(text);
  return {
    type: NodeTypes.Document,
    source: text,
    children: cstToAst(cst),
    position: {
      start: 0,
      end: text.length,
    },
  };
}

class ASTBuilder {
  ast: LiquidHtmlAST;
  cursor: (string | number)[];

  constructor() {
    this.ast = [];
    this.cursor = [];
  }

  get current() {
    return R.path<LiquidHtmlAST>(
      this.cursor,
      this.ast,
    ) as LiquidHtmlAST;
  }

  get currentPosition(): number {
    return R.length(this.current || []) - 1;
  }

  get parent(): LiquidTag | ElementNode | undefined {
    if (this.cursor.length == 0) return undefined;
    return R.path<LiquidTag | ElementNode>(
      R.dropLast(1, this.cursor),
      this.ast,
    );
  }

  open(node: LiquidHtmlNode) {
    this.current.push(node);
    this.cursor.push(this.currentPosition);
    this.cursor.push('children');
  }

  push(node: LiquidHtmlNode) {
    this.current.push(node);
  }

  close(
    node: ConcreteLiquidTagClose | ConcreteTagClose,
    nodeType: NodeTypes.LiquidTag | NodeTypes.ElementNode,
  ) {
    if (
      this.parent?.name !== node.name ||
      this.parent?.type !== nodeType
    ) {
      throw new ParsingError(
        `Attempting to close ${nodeType} '${node.name}' before ${this.parent?.type} '${this.parent?.name}' was closed`,
      );
    }
    // The parent end is the end of the outer tag.
    this.parent.position.end = node.locEnd;
    if (this.parent.type == NodeTypes.LiquidTag && node.type == ConcreteNodeTypes.LiquidTagClose) {
      this.parent.delimiterWhitespaceStart = node.whitespaceStart ?? '';
      this.parent.delimiterWhitespaceEnd = node.whitespaceEnd ?? '';
    }
    this.cursor.pop();
    this.cursor.pop();
  }
}

export function cstToAst(cst: LiquidHtmlCST): LiquidHtmlAST {
  const builder = new ASTBuilder();

  for (const node of cst) {
    switch (node.type) {
      case ConcreteNodeTypes.TextNode: {
        builder.push({
          type: NodeTypes.TextNode,
          value: node.value,
          position: position(node),
        });
        break;
      }

      case ConcreteNodeTypes.LiquidDrop: {
        builder.push({
          type: NodeTypes.LiquidDrop,
          markup: node.markup,
          whitespaceStart: node.whitespaceStart ?? '',
          whitespaceEnd: node.whitespaceEnd ?? '',
          position: position(node),
        });
        break;
      }

      case ConcreteNodeTypes.LiquidTagOpen: {
        builder.open({
          type: NodeTypes.LiquidTag,
          markup: node.markup,
          position: position(node),
          children: [],
          name: node.name,
          whitespaceStart: node.whitespaceStart ?? '',
          whitespaceEnd: node.whitespaceEnd ?? '',
        });
        break;
      }

      case ConcreteNodeTypes.LiquidTagClose: {
        builder.close(node, NodeTypes.LiquidTag);
        break;
      }

      case ConcreteNodeTypes.LiquidTag: {
        builder.push({
          type: NodeTypes.LiquidTag,
          markup: node.markup,
          position: position(node),
          name: node.name,
          whitespaceStart: node.whitespaceStart ?? '',
          whitespaceEnd: node.whitespaceEnd ?? '',
        });
        break;
      }

      case ConcreteNodeTypes.TagOpen: {
        builder.open({
          type: NodeTypes.ElementNode,
          name: node.name,
          attributes: node.attrList
            ? node.attrList.map(toAttribute)
            : [],
          position: position(node),
          children: [],
        } as HtmlNode);
        break;
      }

      case ConcreteNodeTypes.TagClose: {
        builder.close(node, NodeTypes.ElementNode);
        break;
      }

      case ConcreteNodeTypes.SelfClosingElement: {
        builder.push({
          type: NodeTypes.SelfClosingElementNode,
          name: node.name,
          attributes: node.attrList
            ? node.attrList.map(toAttribute)
            : [],
          position: position(node),
        } as HtmlNode);
        break;
      }

      case ConcreteNodeTypes.VoidElement: {
        builder.push({
          type: NodeTypes.VoidElementNode,
          name: node.name,
          attributes: node.attrList
            ? node.attrList.map(toAttribute)
            : [],
          position: position(node),
        } as HtmlNode);
        break;
      }

      default: {
        assertNever(node);
      }
    }
  }

  return builder.ast;
}

function toAttribute(node: ConcreteAttributeNode): AttributeNode {
  switch (node.type) {
    case ConcreteNodeTypes.AttrEmpty: {
      return {
        type: NodeTypes.AttrEmpty,
        name: node.name,
        position: position(node),
      };
    }

    case ConcreteNodeTypes.AttrSingleQuoted:
    case ConcreteNodeTypes.AttrDoubleQuoted:
    case ConcreteNodeTypes.AttrUnquoted: {
      return {
        type: node.type as unknown as
          | NodeTypes.AttrUnquoted
          | NodeTypes.AttrDoubleQuoted
          | NodeTypes.AttrUnquoted,
        name: node.name,
        value: toAttributeValue(node.value),
        position: position(node),
      };
    }

    default: {
      return assertNever(node);
    }
  }
}

function toAttributeValue(
  value: (ConcreteLiquidNode | ConcreteTextNode)[],
): (LiquidNode | TextNode)[] {
  return cstToAst(value) as (LiquidNode | TextNode)[];
}

function position(
  node: LiquidHtmlConcreteNode | ConcreteAttributeNode,
): { start: number; end: number } {
  return {
    start: node.locStart,
    end: node.locEnd,
  };
}
