import {
  ConcreteAttributeNode,
  ConcreteHtmlTagClose,
  ConcreteHtmlTagOpen,
  ConcreteHtmlVoidElement,
  ConcreteLiquidDrop,
  ConcreteLiquidNode,
  ConcreteLiquidTagClose,
  ConcreteNodeTypes,
  ConcreteTextNode,
  LiquidHtmlCST,
  LiquidHtmlConcreteNode,
  toLiquidHtmlCST,
  ConcreteHtmlSelfClosingElement,
  ConcreteAttrSingleQuoted,
  ConcreteAttrDoubleQuoted,
  ConcreteAttrUnquoted,
} from '~/parser/cst';
import { NodeTypes, Position } from '~/types';
import { assertNever, deepGet, dropLast } from '~/utils';
import { LiquidHTMLASTParsingError } from '~/parser/errors';

export type LiquidHtmlNode =
  | DocumentNode
  | LiquidNode
  | HtmlNode
  | AttributeNode
  | TextNode;

export interface DocumentNode extends ASTNode<NodeTypes.Document> {
  children: LiquidHtmlNode[];
  name: '#document';
}

export type LiquidNode = LiquidRawTag | LiquidTag | LiquidDrop | LiquidBranch;

export interface HasChildren {
  children?: LiquidHtmlNode[];
}
export interface HasAttributes {
  attributes: AttributeNode[];
}
export interface HasValue {
  value: (TextNode | LiquidNode)[];
}
export interface HasName {
  name: string | LiquidDrop;
}

export type ParentNode = Extract<
  LiquidHtmlNode,
  HasChildren | HasAttributes | HasValue | HasName
>;

export interface LiquidRawTag extends ASTNode<NodeTypes.LiquidRawTag> {
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
  blockStartPosition: Position;
  blockEndPosition: Position;
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
  children?: LiquidHtmlNode[];
  whitespaceStart: '-' | '';
  whitespaceEnd: '-' | '';
  delimiterWhitespaceStart?: '-' | '';
  delimiterWhitespaceEnd?: '-' | '';
  blockStartPosition: Position;
  blockEndPosition?: Position;
}

export interface LiquidBranch extends ASTNode<NodeTypes.LiquidBranch> {
  /**
   * e.g. else, elsif, when | null when in the main branch
   */
  name: string | null;

  /**
   * The body of the branch tag. May contain arguments. Excludes the name of the tag. Left trimmed.
   */
  markup: string;
  children: LiquidHtmlNode[];
  whitespaceStart: '-' | '';
  whitespaceEnd: '-' | '';
  blockStartPosition: Position;
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
  | HtmlComment
  | HtmlElement
  | HtmlVoidElement
  | HtmlSelfClosingElement
  | HtmlRawNode;

export interface HtmlElement extends HtmlNodeBase<NodeTypes.HtmlElement> {
  blockEndPosition: Position;
  children: LiquidHtmlNode[];
}
export interface HtmlVoidElement
  extends HtmlNodeBase<NodeTypes.HtmlVoidElement> {
  name: string;
}
export interface HtmlSelfClosingElement
  extends HtmlNodeBase<NodeTypes.HtmlSelfClosingElement> {}
export interface HtmlRawNode extends HtmlNodeBase<NodeTypes.HtmlRawNode> {
  /**
   * The innerHTML of the tag as a string. Not trimmed. Not parsed.
   */
  body: string;
  name: string;
  blockEndPosition: Position;
}
export interface HtmlComment extends ASTNode<NodeTypes.HtmlComment> {
  body: string;
}

export interface HtmlNodeBase<T> extends ASTNode<T> {
  /**
   * e.g. div, span, h1, h2, h3...
   */
  name: string | LiquidDrop;
  attributes: AttributeNode[];
  blockStartPosition: Position;
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

export type ValueNode = TextNode | LiquidNode;

export interface AttributeNodeBase<T> extends ASTNode<T> {
  name: string;
  value: ValueNode[];
  attributePosition: Position;
}

export interface TextNode extends ASTNode<NodeTypes.TextNode> {
  value: string;
}

export interface ASTNode<T> {
  type: T;
  position: Position;
  source: string;
}

export function isBranchedTag(node: LiquidHtmlNode) {
  return (
    node.type === NodeTypes.LiquidTag &&
    ['if', 'for', 'unless', 'case'].includes(node.name)
  );
}

// Not exported because you can use node.type === NodeTypes.LiquidBranch.
function isBranchTag(node: LiquidHtmlNode) {
  return (
    node.type === NodeTypes.LiquidTag &&
    ['else', 'elsif', 'when'].includes(node.name)
  );
}

export function toLiquidHtmlAST(text: string): DocumentNode {
  const cst = toLiquidHtmlCST(text);
  const root: DocumentNode = {
    type: NodeTypes.Document,
    source: text,
    children: cstToAst(cst, text),
    name: '#document',
    position: {
      start: 0,
      end: text.length,
    },
  };
  return root;
}

class ASTBuilder {
  ast: LiquidHtmlNode[];
  cursor: (string | number)[];
  source: string;

  constructor(source: string) {
    this.ast = [];
    this.cursor = [];
    this.source = source;
  }

  get current() {
    return deepGet<LiquidHtmlNode[]>(this.cursor, this.ast) as LiquidHtmlNode[];
  }

  get currentPosition(): number {
    return (this.current || []).length - 1;
  }

  get parent(): ParentNode | undefined {
    if (this.cursor.length == 0) return undefined;
    return deepGet<LiquidTag | HtmlElement>(dropLast(1, this.cursor), this.ast);
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
        blockStartPosition: {
          start: node.position.end,
          end: node.position.end,
        },
        children: [],
        whitespaceStart: '',
        whitespaceEnd: '',
        source: this.source,
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
        position: { ...node.position },
        children: [],
        blockStartPosition: { ...node.position },
        whitespaceStart: node.whitespaceStart,
        whitespaceEnd: node.whitespaceEnd,
        source: this.source,
      });
    } else {
      if (this.parent?.type === NodeTypes.LiquidBranch) {
        this.parent.position.end = node.position.end;
      }
      this.current.push(node);
    }
  }

  close(
    node: ConcreteLiquidTagClose | ConcreteHtmlTagClose,
    nodeType: NodeTypes.LiquidTag | NodeTypes.HtmlElement,
  ) {
    if (this.parent?.type === NodeTypes.LiquidBranch) {
      this.parent.position.end = node.locStart;
      this.cursor.pop();
      this.cursor.pop();
    }

    if (
      getName(this.parent) !== getName(node) ||
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
    this.parent.blockEndPosition = position(node);
    if (
      this.parent.type == NodeTypes.LiquidTag &&
      node.type == ConcreteNodeTypes.LiquidTagClose
    ) {
      this.parent.delimiterWhitespaceStart = node.whitespaceStart ?? '';
      this.parent.delimiterWhitespaceEnd = node.whitespaceEnd ?? '';
    }
    this.cursor.pop();
    this.cursor.pop();
  }
}

function getName(
  node: ConcreteLiquidTagClose | ConcreteHtmlTagClose | ParentNode | undefined,
): string | LiquidDrop | null {
  if (!node) return null;
  switch (node.type) {
    case NodeTypes.HtmlElement:
    case ConcreteNodeTypes.HtmlTagClose:
      if (typeof node.name === 'string') return node.name;
      return `{{${node.name.markup.trim()}}}`;
    default:
      return node.name;
  }
}

export function cstToAst(
  cst: LiquidHtmlCST | ConcreteAttributeNode[],
  source: string,
): LiquidHtmlNode[] {
  const builder = new ASTBuilder(source);

  for (const node of cst) {
    switch (node.type) {
      case ConcreteNodeTypes.TextNode: {
        builder.push({
          type: NodeTypes.TextNode,
          value: node.value,
          position: position(node),
          source,
        });
        break;
      }

      case ConcreteNodeTypes.LiquidDrop: {
        builder.push(toLiquidDrop(node, source));
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
          blockStartPosition: position(node),
          source,
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
          blockStartPosition: position(node),
          source,
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
          delimiterWhitespaceStart: node.delimiterWhitespaceStart ?? '',
          delimiterWhitespaceEnd: node.delimiterWhitespaceEnd ?? '',
          position: position(node),
          blockStartPosition: {
            start: node.blockStartLocStart,
            end: node.blockStartLocEnd,
          },
          blockEndPosition: {
            start: node.blockEndLocStart,
            end: node.blockEndLocEnd,
          },
          source,
        });
        break;
      }

      case ConcreteNodeTypes.HtmlTagOpen: {
        builder.open(toHtmlElement(node, source));
        break;
      }

      case ConcreteNodeTypes.HtmlTagClose: {
        builder.close(node, NodeTypes.HtmlElement);
        break;
      }

      case ConcreteNodeTypes.HtmlVoidElement: {
        builder.push(toHtmlVoidElement(node, source));
        break;
      }

      case ConcreteNodeTypes.HtmlSelfClosingElement: {
        builder.push(toHtmlSelfClosingElement(node, source));
        break;
      }

      case ConcreteNodeTypes.HtmlComment: {
        builder.push({
          type: NodeTypes.HtmlComment,
          body: node.body,
          position: position(node),
          source,
        });
        break;
      }

      case ConcreteNodeTypes.HtmlRawTag: {
        builder.push({
          type: NodeTypes.HtmlRawNode,
          name: node.name,
          body: node.body,
          attributes: toAttributes(node.attrList || [], source),
          position: position(node),
          source,
          blockStartPosition: {
            start: node.blockStartLocStart,
            end: node.blockStartLocEnd,
          },
          blockEndPosition: {
            start: node.blockEndLocStart,
            end: node.blockEndLocEnd,
          },
        });
        break;
      }

      case ConcreteNodeTypes.AttrEmpty: {
        builder.push({
          type: NodeTypes.AttrEmpty,
          name: node.name,
          position: position(node),
          source,
        });
        break;
      }

      case ConcreteNodeTypes.AttrSingleQuoted:
      case ConcreteNodeTypes.AttrDoubleQuoted:
      case ConcreteNodeTypes.AttrUnquoted: {
        const abstractNode: AttrUnquoted | AttrSingleQuoted | AttrDoubleQuoted =
          {
            type: node.type as unknown as
              | NodeTypes.AttrSingleQuoted
              | NodeTypes.AttrDoubleQuoted
              | NodeTypes.AttrUnquoted,
            name: node.name,
            position: position(node),
            source,

            // placeholders
            attributePosition: { start: -1, end: -1 },
            value: [],
          };
        const value = toAttributeValue(node.value, source);
        abstractNode.value = value;
        abstractNode.attributePosition = toAttributePosition(node, value);
        builder.push(abstractNode);
        break;
      }

      default: {
        assertNever(node);
      }
    }
  }

  return builder.ast;
}

function toAttributePosition(
  node:
    | ConcreteAttrSingleQuoted
    | ConcreteAttrDoubleQuoted
    | ConcreteAttrUnquoted,
  value: (LiquidNode | TextNode)[],
): Position {
  if (value.length === 0) {
    // This is bugged when there's whitespace on either side. But I don't
    // think it's worth solving.
    return {
      start: node.locStart + node.name.length + '='.length + '"'.length,
      // name=""
      // 012345678
      // 0 + 4 + 1 + 1
      // = 6
      end: node.locStart + node.name.length + '='.length + '"'.length,
      // name=""
      // 012345678
      // 0 + 4 + 1 + 2
      // = 6
    };
  }

  return {
    start: value[0].position.start,
    end: value[value.length - 1].position.end,
  };
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

function toName(name: string | ConcreteLiquidDrop, source: string) {
  if (typeof name === 'string') return name;
  return toLiquidDrop(name, source);
}

function toLiquidDrop(node: ConcreteLiquidDrop, source: string): LiquidDrop {
  return {
    type: NodeTypes.LiquidDrop,
    markup: node.markup,
    whitespaceStart: node.whitespaceStart ?? '',
    whitespaceEnd: node.whitespaceEnd ?? '',
    position: position(node),
    source,
  };
}

function toHtmlElement(node: ConcreteHtmlTagOpen, source: string): HtmlElement {
  return {
    type: NodeTypes.HtmlElement,
    name: toName(node.name, source),
    attributes: toAttributes(node.attrList || [], source),
    position: position(node),
    blockStartPosition: position(node),
    blockEndPosition: { start: -1, end: -1 },
    children: [],
    source,
  };
}

function toHtmlVoidElement(
  node: ConcreteHtmlVoidElement,
  source: string,
): HtmlVoidElement {
  return {
    type: NodeTypes.HtmlVoidElement,
    name: node.name,
    attributes: toAttributes(node.attrList || [], source),
    position: position(node),
    blockStartPosition: position(node),
    source,
  };
}

function toHtmlSelfClosingElement(
  node: ConcreteHtmlSelfClosingElement,
  source: string,
): HtmlSelfClosingElement {
  return {
    type: NodeTypes.HtmlSelfClosingElement,
    name: toName(node.name, source),
    attributes: toAttributes(node.attrList || [], source),
    position: position(node),
    blockStartPosition: position(node),
    source,
  };
}

function position(
  node: LiquidHtmlConcreteNode | ConcreteAttributeNode,
): Position {
  return {
    start: node.locStart,
    end: node.locEnd,
  };
}

export function walk(
  ast: LiquidHtmlNode,
  fn: (ast: LiquidHtmlNode, parentNode: LiquidHtmlNode | undefined) => void,
  parentNode?: LiquidHtmlNode,
) {
  for (const key of ['children', 'attributes']) {
    if (key in ast) {
      (ast as any)[key].forEach((node: LiquidHtmlNode) => walk(node, fn, ast));
    }
  }

  if ('value' in ast) {
    if (Array.isArray(ast.value)) {
      ast.value.forEach((node) => walk(node, fn, ast));
    }
  }

  if ('name' in ast) {
    if (ast.name && typeof ast.name !== 'string' && ast.name.type) {
      fn(ast.name, ast);
    }
  }

  fn(ast, parentNode);
}
