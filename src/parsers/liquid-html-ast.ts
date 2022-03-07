import * as R from 'ramda';
import {
  ConcreteNodeTypes,
  toLiquidHtmlCST,
  LiquidHtmlConcreteNode,
  ConcreteAttributeNode,
  ConcreteLiquidNode,
  ConcreteTextNode,
  ConcreteHtmlTagClose,
  ConcreteLiquidTagClose,
  LiquidHtmlCST,
} from './liquid-html-cst';
import { assertNever } from '../utils';
import { LiquidHTMLASTParsingError } from './utils';

export enum NodeTypes {
  Document = 'Document',
  LiquidRawTag = 'LiquidRawTag',
  LiquidTag = 'LiquidTag',
  LiquidBranch = 'LiquidBranch',
  LiquidDrop = 'LiquidDrop',
  HtmlSelfClosingElement = 'HtmlSelfClosingElement',
  HtmlVoidElement = 'HtmlVoidElement',
  HtmlElement = 'HtmlElement',
  HtmlRawNode = 'HtmlRawNode',
  AttrSingleQuoted = 'AttrSingleQuoted',
  AttrDoubleQuoted = 'AttrDoubleQuoted',
  AttrUnquoted = 'AttrUnquoted',
  AttrEmpty = 'AttrEmpty',
  TextNode = 'TextNode',
}

export type LiquidHtmlAST = LiquidHtmlNode[];

export type LiquidHtmlNode =
  | DocumentNode
  | LiquidNode
  | HtmlNode
  | AttributeNode
  | TextNode;

export interface DocumentNode extends ASTNode<NodeTypes.Document> {
  source: string;
  children: LiquidHtmlAST;
}

export type LiquidNode =
  | LiquidRawTag
  | LiquidTag
  | LiquidDrop
  | LiquidBranch;

export interface LiquidRawTag
  extends ASTNode<NodeTypes.LiquidRawTag> {
  /**
   * e.g. raw, style, javascript
   */
  name: string;

  /**
   * String body of the tag. So we don't try to parse it.
   */
  body: string;
  whitespaceStart: '-' | '';
  whitespaceEnd: '-' | '';
  delimiterWhitespaceStart: '-' | '';
  delimiterWhitespaceEnd: '-' | '';
}

export interface LiquidTag extends ASTNode<NodeTypes.LiquidTag> {
  /**
   * e.g. if, ifchanged, for, etc.
   */
  name: string;

  /**
   * The body of the tag. May contain arguments. Excludes the name of the tag. Left trimmed.
   */
  markup: string;
  children?: LiquidHtmlAST;
  whitespaceStart: '-' | '';
  whitespaceEnd: '-' | '';
  delimiterWhitespaceStart?: '-' | '';
  delimiterWhitespaceEnd?: '-' | '';
}

export interface LiquidBranch
  extends ASTNode<NodeTypes.LiquidBranch> {
  /**
   * e.g. else, elsif, when | null when in the main branch
   */
  name: string | null;

  /**
   * The body of the branch tag. May contain arguments. Excludes the name of the tag. Left trimmed.
   */
  markup: string;
  children: LiquidHtmlAST;
  whitespaceStart: '-' | '';
  whitespaceEnd: '-' | '';
}

export interface LiquidDrop extends ASTNode<NodeTypes.LiquidDrop> {
  /**
   * The body of the drop. May contain filters. Not trimmed.
   */
  markup: string;
  whitespaceStart: '-' | '';
  whitespaceEnd: '-' | '';
}

export type HtmlNode =
  | HtmlElement
  | HtmlVoidElement
  | HtmlSelfClosingElement
  | HtmlRawNode;

export interface HtmlElement
  extends HtmlNodeBase<NodeTypes.HtmlElement> {
  children: LiquidHtmlAST;
}
export interface HtmlVoidElement
  extends HtmlNodeBase<NodeTypes.HtmlVoidElement> {}
export interface HtmlSelfClosingElement
  extends HtmlNodeBase<NodeTypes.HtmlSelfClosingElement> {}
export interface HtmlRawNode
  extends HtmlNodeBase<NodeTypes.HtmlRawNode> {
  /**
   * The innerHTML of the tag as a string. Not trimmed. Not parsed.
   */
  body: string;
}

export interface HtmlNodeBase<T> extends ASTNode<T> {
  /**
   * e.g. div, span, h1, h2, h3...
   */
  name: string;
  attributes: AttributeNode[];
}

export type AttributeNode =
  | LiquidNode
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

export function isBranchedTag(node: LiquidHtmlNode) {
  return (
    node.type === NodeTypes.LiquidTag &&
    ['if', 'for', 'unless', 'case'].includes(node.name)
  );
}

function isBranchTag(node: LiquidHtmlNode) {
  return (
    node.type === NodeTypes.LiquidTag &&
    ['else', 'elsif', 'when'].includes(node.name)
  );
}

export function toLiquidHtmlAST(text: string): DocumentNode {
  const cst = toLiquidHtmlCST(text);
  return {
    type: NodeTypes.Document,
    source: text,
    children: cstToAst(cst, text),
    position: {
      start: 0,
      end: text.length,
    },
  };
}

class ASTBuilder {
  ast: LiquidHtmlAST;
  cursor: (string | number)[];
  source: string;

  constructor(source: string) {
    this.ast = [];
    this.cursor = [];
    this.source = source;
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

  get parent(): LiquidTag | LiquidBranch | HtmlElement | undefined {
    if (this.cursor.length == 0) return undefined;
    return R.path<LiquidTag | HtmlElement>(
      R.dropLast(1, this.cursor),
      this.ast,
    );
  }

  open(node: LiquidHtmlNode) {
    this.current.push(node);
    this.cursor.push(this.currentPosition);
    this.cursor.push('children');

    if (isBranchedTag(node)) {
      this.open({
        type: NodeTypes.LiquidBranch,
        name: null,
        markup: '',
        position: {
          start: node.position.end,
          end: node.position.end,
        },
        children: [],
        whitespaceStart: '',
        whitespaceEnd: '',
      });
    }
  }

  push(node: LiquidHtmlNode) {
    if (node.type === NodeTypes.LiquidTag && isBranchTag(node)) {
      this.cursor.pop();
      this.cursor.pop();
      this.open({
        name: node.name,
        type: NodeTypes.LiquidBranch,
        markup: node.markup,
        position: node.position,
        children: [],
        whitespaceStart: node.whitespaceStart,
        whitespaceEnd: node.whitespaceEnd,
      });
    } else {
      this.current.push(node);
    }
  }

  close(
    node: ConcreteLiquidTagClose | ConcreteHtmlTagClose,
    nodeType: NodeTypes.LiquidTag | NodeTypes.HtmlElement,
  ) {
    if (this.parent?.type === NodeTypes.LiquidBranch) {
      this.cursor.pop();
      this.cursor.pop();
    }

    if (
      this.parent?.name !== node.name ||
      this.parent?.type !== nodeType
    ) {
      throw new LiquidHTMLASTParsingError(
        `Attempting to close ${nodeType} '${node.name}' before ${this.parent?.type} '${this.parent?.name}' was closed`,
        this.source,
        this.parent?.position?.start || 0,
        node.locEnd,
      );
    }
    // The parent end is the end of the outer tag.
    this.parent.position.end = node.locEnd;
    if (
      this.parent.type == NodeTypes.LiquidTag &&
      node.type == ConcreteNodeTypes.LiquidTagClose
    ) {
      this.parent.delimiterWhitespaceStart =
        node.whitespaceStart ?? '';
      this.parent.delimiterWhitespaceEnd = node.whitespaceEnd ?? '';
    }
    this.cursor.pop();
    this.cursor.pop();
  }
}

export function cstToAst(
  cst: LiquidHtmlCST | ConcreteAttributeNode[],
  source: string,
): LiquidHtmlAST {
  const builder = new ASTBuilder(source);

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

      case ConcreteNodeTypes.LiquidRawTag: {
        builder.push({
          type: NodeTypes.LiquidRawTag,
          name: node.name,
          body: node.body,
          whitespaceStart: node.whitespaceStart ?? '',
          whitespaceEnd: node.whitespaceEnd ?? '',
          delimiterWhitespaceStart:
            node.delimiterWhitespaceStart ?? '',
          delimiterWhitespaceEnd: node.delimiterWhitespaceEnd ?? '',
          position: position(node),
        });
        break;
      }

      case ConcreteNodeTypes.HtmlTagOpen: {
        builder.open({
          type: NodeTypes.HtmlElement,
          name: node.name,
          attributes: toAttributes(node.attrList || [], source),
          position: position(node),
          children: [],
        } as HtmlNode);
        break;
      }

      case ConcreteNodeTypes.HtmlTagClose: {
        builder.close(node, NodeTypes.HtmlElement);
        break;
      }

      case ConcreteNodeTypes.HtmlVoidElement: {
        builder.push({
          type: NodeTypes.HtmlVoidElement,
          name: node.name,
          attributes: toAttributes(node.attrList || [], source),
          position: position(node),
        } as HtmlNode);
        break;
      }

      case ConcreteNodeTypes.HtmlSelfClosingElement: {
        builder.push({
          type: NodeTypes.HtmlSelfClosingElement,
          name: node.name,
          attributes: toAttributes(node.attrList || [], source),
          position: position(node),
        } as HtmlNode);
        break;
      }

      case ConcreteNodeTypes.HtmlRawTag: {
        builder.push({
          type: NodeTypes.HtmlRawNode,
          name: node.name,
          body: node.body,
          attributes: toAttributes(node.attrList || [], source),
          position: position(node),
        });
        break;
      }

      case ConcreteNodeTypes.AttrEmpty: {
        builder.push({
          type: NodeTypes.AttrEmpty,
          name: node.name,
          position: position(node),
        });
        break;
      }

      case ConcreteNodeTypes.AttrSingleQuoted:
      case ConcreteNodeTypes.AttrDoubleQuoted:
      case ConcreteNodeTypes.AttrUnquoted: {
        builder.push({
          type: node.type as unknown as
            | NodeTypes.AttrUnquoted
            | NodeTypes.AttrDoubleQuoted
            | NodeTypes.AttrUnquoted,
          name: node.name,
          value: toAttributeValue(node.value, source),
          position: position(node),
        });
        break;
      }

      default: {
        assertNever(node);
      }
    }
  }

  return builder.ast;
}

function toAttributeValue(
  value: (ConcreteLiquidNode | ConcreteTextNode)[],
  source: string,
): (LiquidNode | TextNode)[] {
  return cstToAst(value, source) as (LiquidNode | TextNode)[];
}

function toAttributes(
  attrList: ConcreteAttributeNode[],
  source: string,
): AttributeNode[] {
  return cstToAst(attrList, source) as AttributeNode[];
}

function position(
  node: LiquidHtmlConcreteNode | ConcreteAttributeNode,
): { start: number; end: number } {
  return {
    start: node.locStart,
    end: node.locEnd,
  };
}
