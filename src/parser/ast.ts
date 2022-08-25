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
  toLiquidHtmlCST,
  ConcreteHtmlSelfClosingElement,
  ConcreteAttrSingleQuoted,
  ConcreteAttrDoubleQuoted,
  ConcreteAttrUnquoted,
  ConcreteLiquidVariable,
  ConcreteLiquidLiteral,
  ConcreteLiquidFilter,
  ConcreteLiquidExpression,
  ConcreteLiquidNamedArgument,
  ConcreteLiquidTagNamed,
  ConcreteLiquidTag,
  ConcreteLiquidTagAssignMarkup,
  ConcreteLiquidTagRenderMarkup,
  ConcreteRenderVariableExpression,
  ConcreteLiquidTagOpenNamed,
  ConcreteLiquidTagOpen,
  ConcreteLiquidArgument,
  ConcretePaginateMarkup,
  ConcreteLiquidCondition,
  ConcreteLiquidComparison,
  ConcreteLiquidTagForMarkup,
  ConcreteLiquidTagCycleMarkup,
  ConcreteHtmlRawTag,
} from '~/parser/cst';
import {
  Comparators,
  isLiquidHtmlNode,
  NamedTags,
  NodeTypes,
  Position,
} from '~/types';
import { assertNever, deepGet, dropLast } from '~/utils';
import { LiquidHTMLASTParsingError } from '~/parser/errors';
import { TAGS_WITHOUT_MARKUP } from '~/parser/grammar';

interface HasPosition {
  locStart: number;
  locEnd: number;
}

export type LiquidHtmlNode =
  | DocumentNode
  | YAMLFrontmatter
  | LiquidNode
  | HtmlNode
  | AttributeNode
  | LiquidVariable
  | LiquidExpression
  | LiquidFilter
  | LiquidNamedArgument
  | AssignMarkup
  | CycleMarkup
  | ForMarkup
  | RenderMarkup
  | PaginateMarkup
  | RawMarkup
  | RenderVariableExpression
  | LiquidLogicalExpression
  | LiquidComparison
  | TextNode;

export interface DocumentNode extends ASTNode<NodeTypes.Document> {
  children: LiquidHtmlNode[];
  name: '#document';
}

export interface YAMLFrontmatter extends ASTNode<NodeTypes.YAMLFrontmatter> {
  body: string;
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

export type LiquidTag = LiquidTagNamed | LiquidTagBaseCase;
export type LiquidTagNamed =
  | LiquidTagAssign
  | LiquidTagCase
  | LiquidTagCapture
  | LiquidTagCycle
  | LiquidTagDecrement
  | LiquidTagEcho
  | LiquidTagFor
  | LiquidTagForm
  | LiquidTagIf
  | LiquidTagInclude
  | LiquidTagIncrement
  | LiquidTagLayout
  | LiquidTagPaginate
  | LiquidTagRender
  | LiquidTagSection
  | LiquidTagTablerow
  | LiquidTagUnless;

export interface LiquidTagNode<Name, Markup>
  extends ASTNode<NodeTypes.LiquidTag> {
  /**
   * e.g. if, ifchanged, for, etc.
   */
  name: Name;

  /**
   * The body of the tag. May contain arguments. Excludes the name of the tag. Left trimmed if string.
   */
  markup: Markup;
  children?: LiquidHtmlNode[];
  whitespaceStart: '-' | '';
  whitespaceEnd: '-' | '';
  delimiterWhitespaceStart?: '-' | '';
  delimiterWhitespaceEnd?: '-' | '';
  blockStartPosition: Position;
  blockEndPosition?: Position;
}

export interface LiquidTagBaseCase extends LiquidTagNode<string, string> {}
export interface LiquidTagEcho
  extends LiquidTagNode<NamedTags.echo, LiquidVariable> {}

export interface LiquidTagAssign
  extends LiquidTagNode<NamedTags.assign, AssignMarkup> {}
export interface AssignMarkup extends ASTNode<NodeTypes.AssignMarkup> {
  name: string;
  value: LiquidVariable;
}

export interface LiquidTagIncrement
  extends LiquidTagNode<NamedTags.increment, LiquidVariableLookup> {}
export interface LiquidTagDecrement
  extends LiquidTagNode<NamedTags.decrement, LiquidVariableLookup> {}

export interface LiquidTagCapture
  extends LiquidTagNode<NamedTags.capture, LiquidVariableLookup> {}

export interface LiquidTagCycle
  extends LiquidTagNode<NamedTags.cycle, CycleMarkup> {}
export interface CycleMarkup extends ASTNode<NodeTypes.CycleMarkup> {
  groupName: LiquidExpression | null;
  args: LiquidExpression[];
}

export interface LiquidTagCase
  extends LiquidTagNode<NamedTags.case, LiquidExpression> {}
export interface LiquidBranchWhen
  extends LiquidBranchNode<NamedTags.when, LiquidExpression[]> {}

export interface LiquidTagForm
  extends LiquidTagNode<NamedTags.form, LiquidArgument[]> {}

export interface LiquidTagFor extends LiquidTagNode<NamedTags.for, ForMarkup> {}
export interface ForMarkup extends ASTNode<NodeTypes.ForMarkup> {
  variableName: string;
  collection: LiquidExpression;
  reversed: boolean;
  args: LiquidNamedArgument[];
}

export interface LiquidTagTablerow
  extends LiquidTagNode<NamedTags.tablerow, ForMarkup> {}

export interface LiquidTagIf extends LiquidTagConditional<NamedTags.if> {}
export interface LiquidTagUnless
  extends LiquidTagConditional<NamedTags.unless> {}
export interface LiquidBranchElsif
  extends LiquidBranchNode<NamedTags.elsif, LiquidConditionalExpression> {}
export interface LiquidTagConditional<Name>
  extends LiquidTagNode<Name, LiquidConditionalExpression> {}

export type LiquidConditionalExpression =
  | LiquidLogicalExpression
  | LiquidComparison
  | LiquidExpression;

export interface LiquidLogicalExpression
  extends ASTNode<NodeTypes.LogicalExpression> {
  relation: 'and' | 'or';
  left: LiquidConditionalExpression;
  right: LiquidConditionalExpression;
}

export interface LiquidComparison extends ASTNode<NodeTypes.Comparison> {
  comparator: Comparators;
  left: LiquidConditionalExpression;
  right: LiquidConditionalExpression;
}

export interface LiquidTagPaginate
  extends LiquidTagNode<NamedTags.paginate, PaginateMarkup> {}
export interface PaginateMarkup extends ASTNode<NodeTypes.PaginateMarkup> {
  collection: LiquidExpression;
  pageSize: LiquidExpression;
  args: LiquidNamedArgument[];
}

export interface LiquidTagRender
  extends LiquidTagNode<NamedTags.render, RenderMarkup> {}
export interface LiquidTagInclude
  extends LiquidTagNode<NamedTags.include, RenderMarkup> {}

export interface LiquidTagSection
  extends LiquidTagNode<NamedTags.section, LiquidString> {}
export interface LiquidTagLayout
  extends LiquidTagNode<NamedTags.layout, LiquidExpression> {}

export interface RenderMarkup extends ASTNode<NodeTypes.RenderMarkup> {
  snippet: LiquidString | LiquidVariableLookup;
  alias: string | null;
  variable: RenderVariableExpression | null;
  args: LiquidNamedArgument[];
}

export interface RenderVariableExpression
  extends ASTNode<NodeTypes.RenderVariableExpression> {
  kind: 'for' | 'with';
  name: LiquidExpression;
}

export type LiquidBranch =
  | LiquidBranchUnnamed
  | LiquidBranchBaseCase
  | LiquidBranchNamed;
export type LiquidBranchNamed = LiquidBranchElsif | LiquidBranchWhen;

interface LiquidBranchNode<Name, Markup>
  extends ASTNode<NodeTypes.LiquidBranch> {
  /**
   * e.g. else, elsif, when | null when in the main branch
   */
  name: Name;

  /**
   * The body of the branch tag. May contain arguments. Excludes the name of the tag. Left trimmed.
   */
  markup: Markup;
  children: LiquidHtmlNode[];
  whitespaceStart: '-' | '';
  whitespaceEnd: '-' | '';
  blockStartPosition: Position;
}

export interface LiquidBranchUnnamed extends LiquidBranchNode<null, string> {}
export interface LiquidBranchBaseCase
  extends LiquidBranchNode<string, string> {}

export interface LiquidDrop extends ASTNode<NodeTypes.LiquidDrop> {
  /**
   * The body of the drop. May contain filters. Not trimmed.
   */
  markup: string | LiquidVariable;
  whitespaceStart: '-' | '';
  whitespaceEnd: '-' | '';
}

interface LiquidVariable extends ASTNode<NodeTypes.LiquidVariable> {
  expression: LiquidExpression;
  filters: LiquidFilter[];
  rawSource: string;
}

export type LiquidExpression =
  | LiquidString
  | LiquidNumber
  | LiquidLiteral
  | LiquidRange
  | LiquidVariableLookup;

interface LiquidFilter extends ASTNode<NodeTypes.LiquidFilter> {
  name: string;
  args: LiquidArgument[];
}

type LiquidArgument = LiquidExpression | LiquidNamedArgument;

interface LiquidNamedArgument extends ASTNode<NodeTypes.NamedArgument> {
  name: string;
  value: LiquidExpression;
}

interface LiquidString extends ASTNode<NodeTypes.String> {
  single: boolean;
  value: string;
}

interface LiquidNumber extends ASTNode<NodeTypes.Number> {
  value: string;
}

interface LiquidRange extends ASTNode<NodeTypes.Range> {
  start: LiquidExpression;
  end: LiquidExpression;
}

interface LiquidLiteral extends ASTNode<NodeTypes.LiquidLiteral> {
  keyword: ConcreteLiquidLiteral['keyword'];
  value: ConcreteLiquidLiteral['value'];
}

interface LiquidVariableLookup extends ASTNode<NodeTypes.VariableLookup> {
  name: string | null;
  lookups: LiquidExpression[];
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
  body: RawMarkup;
  name: string;
  blockEndPosition: Position;
}

export enum RawMarkupKinds {
  css = 'css',
  html = 'html',
  javascript = 'javascript',
  json = 'json',
  markdown = 'markdown',
  typescript = 'typescript',
  text = 'text',
}

export interface RawMarkup extends ASTNode<NodeTypes.RawMarkup> {
  kind: RawMarkupKinds;
  value: string;
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
function isLiquidBranchDisguisedAsTag(
  node: LiquidHtmlNode,
): node is LiquidTagBaseCase {
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
      this.open(toUnnamedLiquidBranch(node, this.source));
    }
  }

  push(node: LiquidHtmlNode) {
    if (
      node.type === NodeTypes.LiquidTag &&
      isLiquidBranchDisguisedAsTag(node)
    ) {
      this.cursor.pop();
      this.cursor.pop();
      this.open(toNamedLiquidBranchBaseCase(node, this.source));
    } else if (node.type === NodeTypes.LiquidBranch) {
      this.cursor.pop();
      this.cursor.pop();
      this.open(node);
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
      if (typeof node.name === 'string') {
        return node.name;
      } else if (typeof node.name.markup === 'string') {
        return `{{${node.name.markup.trim()}}}`;
      } else {
        return `{{${node.name.markup.rawSource}}}`;
      }
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
        builder.open(toLiquidTag(node, source, { isBlockTag: true }));
        break;
      }

      case ConcreteNodeTypes.LiquidTagClose: {
        builder.close(node, NodeTypes.LiquidTag);
        break;
      }

      case ConcreteNodeTypes.LiquidTag: {
        builder.push(toLiquidTag(node, source));
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
          body: toRawMarkup(node, source),
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

      case ConcreteNodeTypes.YAMLFrontmatter: {
        builder.push({
          type: NodeTypes.YAMLFrontmatter,
          body: node.body,
          position: position(node),
          source,
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

function liquidTagBaseAttributes(
  node: ConcreteLiquidTag | ConcreteLiquidTagOpen,
  source: string,
): Omit<LiquidTag, 'name' | 'markup'> {
  return {
    type: NodeTypes.LiquidTag,
    position: position(node),
    whitespaceStart: node.whitespaceStart ?? '',
    whitespaceEnd: node.whitespaceEnd ?? '',
    blockStartPosition: position(node),
    source,
  };
}

function liquidBranchBaseAttributes(
  node: ConcreteLiquidTag,
  source: string,
): Omit<LiquidBranch, 'name' | 'markup'> {
  return {
    type: NodeTypes.LiquidBranch,
    children: [],
    position: position(node),
    whitespaceStart: node.whitespaceStart ?? '',
    whitespaceEnd: node.whitespaceEnd ?? '',
    blockStartPosition: position(node),
    source,
  };
}

function toLiquidTag(
  node: ConcreteLiquidTag | ConcreteLiquidTagOpen,
  source: string,
  { isBlockTag } = { isBlockTag: false },
): LiquidTag | LiquidBranch {
  if (typeof node.markup !== 'string') {
    return toNamedLiquidTag(node as ConcreteLiquidTagNamed, source);
  } else if (isBlockTag) {
    return {
      name: node.name,
      markup: markup(node.name, node.markup),
      children: isBlockTag ? [] : undefined,
      ...liquidTagBaseAttributes(node, source),
    };
  }
  return {
    name: node.name,
    markup: markup(node.name, node.markup),
    ...liquidTagBaseAttributes(node, source),
  };
}

function toNamedLiquidTag(
  node: ConcreteLiquidTagNamed | ConcreteLiquidTagOpenNamed,
  source: string,
): LiquidTagNamed | LiquidBranchNamed {
  switch (node.name) {
    case NamedTags.echo: {
      return {
        ...liquidTagBaseAttributes(node, source),
        name: NamedTags.echo,
        markup: toLiquidVariable(node.markup, source),
      };
    }

    case NamedTags.assign: {
      return {
        ...liquidTagBaseAttributes(node, source),
        name: NamedTags.assign,
        markup: toAssignMarkup(node.markup, source),
      };
    }

    case NamedTags.cycle: {
      return {
        ...liquidTagBaseAttributes(node, source),
        name: node.name,
        markup: toCycleMarkup(node.markup, source),
      };
    }

    case NamedTags.increment:
    case NamedTags.decrement: {
      return {
        ...liquidTagBaseAttributes(node, source),
        name: node.name,
        markup: toExpression(node.markup, source) as LiquidVariableLookup,
      };
    }

    case NamedTags.capture: {
      return {
        ...liquidTagBaseAttributes(node, source),
        name: node.name,
        markup: toExpression(node.markup, source) as LiquidVariableLookup,
        children: [],
      };
    }

    case NamedTags.include:
    case NamedTags.render: {
      return {
        ...liquidTagBaseAttributes(node, source),
        name: node.name,
        markup: toRenderMarkup(node.markup, source),
      };
    }

    case NamedTags.layout:
    case NamedTags.section: {
      return {
        ...liquidTagBaseAttributes(node, source),
        name: node.name,
        markup: toExpression(node.markup, source) as LiquidString,
      };
    }

    case NamedTags.form: {
      return {
        ...liquidTagBaseAttributes(node, source),
        name: node.name,
        markup: node.markup.map((arg) => toLiquidArgument(arg, source)),
        children: [],
      };
    }

    case NamedTags.tablerow:
    case NamedTags.for: {
      return {
        ...liquidTagBaseAttributes(node, source),
        name: node.name,
        markup: toForMarkup(node.markup, source),
        children: [],
      };
    }

    case NamedTags.paginate: {
      return {
        ...liquidTagBaseAttributes(node, source),
        name: node.name,
        markup: toPaginateMarkup(node.markup, source),
        children: [],
      };
    }

    case NamedTags.if:
    case NamedTags.unless: {
      return {
        ...liquidTagBaseAttributes(node, source),
        name: node.name,
        markup: toConditionalExpression(node.markup, source),
        children: [],
      };
    }

    case NamedTags.elsif: {
      return {
        ...liquidBranchBaseAttributes(node, source),
        name: node.name,
        markup: toConditionalExpression(node.markup, source),
      };
    }

    case NamedTags.case: {
      return {
        ...liquidTagBaseAttributes(node, source),
        name: node.name,
        markup: toExpression(node.markup, source),
        children: [],
      };
    }

    case NamedTags.when: {
      return {
        ...liquidBranchBaseAttributes(node, source),
        name: node.name,
        markup: node.markup.map((arg) => toExpression(arg, source)),
      };
    }

    default: {
      return assertNever(node);
    }
  }
}

function toNamedLiquidBranchBaseCase(
  node: LiquidTagBaseCase,
  source: string,
): LiquidBranchBaseCase {
  return {
    name: node.name,
    type: NodeTypes.LiquidBranch,
    markup: node.markup,
    position: { ...node.position },
    children: [],
    blockStartPosition: { ...node.position },
    whitespaceStart: node.whitespaceStart,
    whitespaceEnd: node.whitespaceEnd,
    source,
  };
}

function toUnnamedLiquidBranch(
  parentNode: LiquidHtmlNode,
  source: string,
): LiquidBranchUnnamed {
  return {
    type: NodeTypes.LiquidBranch,
    name: null,
    markup: '',
    position: {
      start: parentNode.position.end,
      end: parentNode.position.end, // tmp value
    },
    blockStartPosition: {
      start: parentNode.position.end,
      end: parentNode.position.end,
    },
    children: [],
    whitespaceStart: '',
    whitespaceEnd: '',
    source,
  };
}

function toAssignMarkup(
  node: ConcreteLiquidTagAssignMarkup,
  source: string,
): AssignMarkup {
  return {
    type: NodeTypes.AssignMarkup,
    name: node.name,
    value: toLiquidVariable(node.value, source),
    position: position(node),
    source,
  };
}

function toCycleMarkup(
  node: ConcreteLiquidTagCycleMarkup,
  source: string,
): CycleMarkup {
  return {
    type: NodeTypes.CycleMarkup,
    groupName: node.groupName ? toExpression(node.groupName, source) : null,
    args: node.args.map((arg) => toExpression(arg, source)),
    position: position(node),
    source,
  };
}

function toForMarkup(
  node: ConcreteLiquidTagForMarkup,
  source: string,
): ForMarkup {
  return {
    type: NodeTypes.ForMarkup,
    variableName: node.variableName,
    collection: toExpression(node.collection, source),
    args: node.args.map((arg) => toNamedArgument(arg, source)),
    reversed: !!node.reversed,
    position: position(node),
    source,
  };
}

function toPaginateMarkup(
  node: ConcretePaginateMarkup,
  source: string,
): PaginateMarkup {
  return {
    type: NodeTypes.PaginateMarkup,
    collection: toExpression(node.collection, source),
    pageSize: toExpression(node.pageSize, source),
    position: position(node),
    args: node.args ? node.args.map((arg) => toNamedArgument(arg, source)) : [],
    source,
  };
}

function toRawMarkupKind(
  nodeName: string,
  node: ConcreteHtmlRawTag,
): RawMarkupKinds {
  switch (nodeName) {
    case 'script': {
      const scriptAttr = node.attrList?.find(
        (attr) => 'name' in attr && attr.name === 'type',
      );
      if (
        !scriptAttr ||
        !('value' in scriptAttr) ||
        scriptAttr.value.length === 0 ||
        scriptAttr.value[0].type !== ConcreteNodeTypes.TextNode
      ) {
        return RawMarkupKinds.javascript;
      }
      const type = scriptAttr.value[0].value;

      if (type === 'text/markdown') {
        return RawMarkupKinds.markdown;
      }

      if (type === 'application/x-typescript') {
        return RawMarkupKinds.typescript;
      }

      if (type === 'text/html') {
        return RawMarkupKinds.html;
      }

      if (
        (type && (type.endsWith('json') || type.endsWith('importmap'))) ||
        type === 'speculationrules'
      ) {
        return RawMarkupKinds.json;
      }

      return RawMarkupKinds.javascript;
    }
    case 'style':
      return RawMarkupKinds.css;
    default:
      return RawMarkupKinds.text;
  }
}

function toRawMarkup(node: ConcreteHtmlRawTag, source: string): RawMarkup {
  return {
    type: NodeTypes.RawMarkup,
    kind: toRawMarkupKind(node.name, node),
    value: node.body,
    position: {
      start: node.blockStartLocEnd,
      end: node.blockEndLocStart,
    },
    source,
  };
}

function toRenderMarkup(
  node: ConcreteLiquidTagRenderMarkup,
  source: string,
): RenderMarkup {
  return {
    type: NodeTypes.RenderMarkup,
    snippet: toExpression(node.snippet, source) as
      | LiquidString
      | LiquidVariableLookup,
    alias: node.alias,
    variable: toRenderVariableExpression(node.variable, source),
    args: node.args.map((arg) => toNamedArgument(arg, source)),
    position: position(node),
    source,
  };
}

function toRenderVariableExpression(
  node: ConcreteRenderVariableExpression | null,
  source: string,
): RenderVariableExpression | null {
  if (!node) return null;
  return {
    type: NodeTypes.RenderVariableExpression,
    kind: node.kind,
    name: toExpression(node.name, source),
    position: position(node),
    source,
  };
}

function toConditionalExpression(
  nodes: ConcreteLiquidCondition[],
  source: string,
): LiquidConditionalExpression {
  if (nodes.length === 1) {
    return toComparisonOrExpression(nodes[0], source);
  }

  const [first, second] = nodes;
  const [, ...rest] = nodes;
  return {
    type: NodeTypes.LogicalExpression,
    relation: second.relation as 'and' | 'or',
    left: toComparisonOrExpression(first, source),
    right: toConditionalExpression(rest, source),
    position: {
      start: first.locStart,
      end: nodes[nodes.length - 1].locEnd,
    },
    source,
  };
}

function toComparisonOrExpression(
  node: ConcreteLiquidCondition,
  source: string,
): LiquidComparison | LiquidExpression {
  const expression = node.expression;
  switch (expression.type) {
    case ConcreteNodeTypes.Comparison:
      return toComparison(expression, source);
    default:
      return toExpression(expression, source);
  }
}

function toComparison(
  node: ConcreteLiquidComparison,
  source: string,
): LiquidComparison {
  return {
    type: NodeTypes.Comparison,
    comparator: node.comparator,
    left: toExpression(node.left, source),
    right: toExpression(node.right, source),
    position: position(node),
    source,
  };
}

function toLiquidDrop(node: ConcreteLiquidDrop, source: string): LiquidDrop {
  return {
    type: NodeTypes.LiquidDrop,
    markup:
      typeof node.markup === 'string'
        ? node.markup
        : toLiquidVariable(node.markup, source),
    whitespaceStart: node.whitespaceStart ?? '',
    whitespaceEnd: node.whitespaceEnd ?? '',
    position: position(node),
    source,
  };
}

function toLiquidVariable(
  node: ConcreteLiquidVariable,
  source: string,
): LiquidVariable {
  return {
    type: NodeTypes.LiquidVariable,
    expression: toExpression(node.expression, source),
    filters: node.filters.map((filter) => toFilter(filter, source)),
    position: position(node),
    rawSource: node.rawSource,
    source,
  };
}

function toExpression(
  node: ConcreteLiquidExpression,
  source: string,
): LiquidExpression {
  switch (node.type) {
    case ConcreteNodeTypes.String: {
      return {
        type: NodeTypes.String,
        position: position(node),
        single: node.single,
        value: node.value,
        source,
      };
    }
    case ConcreteNodeTypes.Number: {
      return {
        type: NodeTypes.Number,
        position: position(node),
        value: node.value,
        source,
      };
    }
    case ConcreteNodeTypes.LiquidLiteral: {
      return {
        type: NodeTypes.LiquidLiteral,
        position: position(node),
        value: node.value,
        keyword: node.keyword,
        source,
      };
    }
    case ConcreteNodeTypes.Range: {
      return {
        type: NodeTypes.Range,
        start: toExpression(node.start, source),
        end: toExpression(node.end, source),
        position: position(node),
        source,
      };
    }
    case ConcreteNodeTypes.VariableLookup: {
      return {
        type: NodeTypes.VariableLookup,
        name: node.name,
        lookups: node.lookups.map((lookup) => toExpression(lookup, source)),
        position: position(node),
        source,
      };
    }
    default: {
      return assertNever(node);
    }
  }
}

function toFilter(node: ConcreteLiquidFilter, source: string): LiquidFilter {
  return {
    type: NodeTypes.LiquidFilter,
    name: node.name,
    args: node.args.map((arg) => toLiquidArgument(arg, source)),
    position: position(node),
    source,
  };
}

function toLiquidArgument(
  node: ConcreteLiquidArgument,
  source: string,
): LiquidArgument {
  switch (node.type) {
    case ConcreteNodeTypes.NamedArgument: {
      return toNamedArgument(node, source);
    }
    default: {
      return toExpression(node, source);
    }
  }
}

function toNamedArgument(
  node: ConcreteLiquidNamedArgument,
  source: string,
): LiquidNamedArgument {
  return {
    type: NodeTypes.NamedArgument,
    name: node.name,
    value: toExpression(node.value, source),
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

function markup(name: string, markup: string) {
  if (TAGS_WITHOUT_MARKUP.includes(name)) return '';
  return markup;
}

function position(node: HasPosition): Position {
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
  for (const key of Object.keys(ast)) {
    if (
      ['parentNode', 'prev', 'next', 'firstChild', 'lastChild'].includes(key)
    ) {
      continue;
    }
    const value = (ast as any)[key];
    if (Array.isArray(value)) {
      value
        .filter(isLiquidHtmlNode)
        .forEach((node: LiquidHtmlNode) => walk(node, fn, ast));
    } else if (isLiquidHtmlNode(value)) {
      walk(value, fn, ast);
    }
  }

  fn(ast, parentNode);
}
