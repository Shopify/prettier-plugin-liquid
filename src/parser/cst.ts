import { Parser } from 'prettier';
import { Node } from 'ohm-js';
import { toAST } from 'ohm-js/extras';
import { liquidHtmlGrammar } from '~/parser/grammar';
import { LiquidHTMLCSTParsingError } from '~/parser/errors';
import { Comparators, NamedTags } from '~/types';

export enum ConcreteNodeTypes {
  HtmlComment = 'HtmlComment',
  HtmlRawTag = 'HtmlRawTag',
  HtmlVoidElement = 'HtmlVoidElement',
  HtmlSelfClosingElement = 'HtmlSelfClosingElement',
  HtmlTagOpen = 'HtmlTagOpen',
  HtmlTagClose = 'HtmlTagClose',
  AttrSingleQuoted = 'AttrSingleQuoted',
  AttrDoubleQuoted = 'AttrDoubleQuoted',
  AttrUnquoted = 'AttrUnquoted',
  AttrEmpty = 'AttrEmpty',
  LiquidDrop = 'LiquidDrop',
  LiquidRawTag = 'LiquidRawTag',
  LiquidTag = 'LiquidTag',
  LiquidTagOpen = 'LiquidTagOpen',
  LiquidTagClose = 'LiquidTagClose',
  TextNode = 'TextNode',
  YAMLFrontmatter = 'YAMLFrontmatter',

  LiquidVariable = 'LiquidVariable',
  LiquidFilter = 'LiquidFilter',
  NamedArgument = 'NamedArgument',
  LiquidLiteral = 'LiquidLiteral',
  VariableLookup = 'VariableLookup',
  String = 'String',
  Number = 'Number',
  Range = 'Range',
  Comparison = 'Comparison',
  Condition = 'Condition',

  AssignMarkup = 'AssignMarkup',
  CycleMarkup = 'CycleMarkup',
  ForMarkup = 'ForMarkup',
  RenderMarkup = 'RenderMarkup',
  PaginateMarkup = 'PaginateMarkup',
  RenderVariableExpression = 'RenderVariableExpression',
}

export const LiquidLiteralValues = {
  nil: null,
  null: null,
  true: true as true,
  false: false as false,
  blank: '' as '',
  empty: '' as '',
};

export interface Parsers {
  [astFormat: string]: Parser;
}

export interface ConcreteBasicNode<T> {
  type: T;
  locStart: number;
  locEnd: number;
}

export interface ConcreteHtmlNodeBase<T> extends ConcreteBasicNode<T> {
  name: string | ConcreteLiquidDrop;
  attrList?: ConcreteAttributeNode[];
}

export interface ConcreteHtmlComment
  extends ConcreteHtmlNodeBase<ConcreteNodeTypes.HtmlComment> {
  body: string;
}

export interface ConcreteHtmlRawTag
  extends ConcreteHtmlNodeBase<ConcreteNodeTypes.HtmlRawTag> {
  name: string;
  body: string;
  blockStartLocStart: number;
  blockStartLocEnd: number;
  blockEndLocStart: number;
  blockEndLocEnd: number;
}
export interface ConcreteHtmlVoidElement
  extends ConcreteHtmlNodeBase<ConcreteNodeTypes.HtmlVoidElement> {
  name: string;
}
export interface ConcreteHtmlSelfClosingElement
  extends ConcreteHtmlNodeBase<ConcreteNodeTypes.HtmlSelfClosingElement> {}
export interface ConcreteHtmlTagOpen
  extends ConcreteHtmlNodeBase<ConcreteNodeTypes.HtmlTagOpen> {}
export interface ConcreteHtmlTagClose
  extends ConcreteHtmlNodeBase<ConcreteNodeTypes.HtmlTagClose> {}

export interface ConcreteAttributeNodeBase<T> extends ConcreteBasicNode<T> {
  name: string;
  value: (ConcreteLiquidNode | ConcreteTextNode)[];
}

export type ConcreteAttributeNode =
  | ConcreteLiquidNode
  | ConcreteAttrSingleQuoted
  | ConcreteAttrDoubleQuoted
  | ConcreteAttrUnquoted
  | ConcreteAttrEmpty;

export interface ConcreteAttrSingleQuoted
  extends ConcreteAttributeNodeBase<ConcreteNodeTypes.AttrSingleQuoted> {}
export interface ConcreteAttrDoubleQuoted
  extends ConcreteAttributeNodeBase<ConcreteNodeTypes.AttrDoubleQuoted> {}
export interface ConcreteAttrUnquoted
  extends ConcreteAttributeNodeBase<ConcreteNodeTypes.AttrUnquoted> {}
export interface ConcreteAttrEmpty
  extends ConcreteBasicNode<ConcreteNodeTypes.AttrEmpty> {
  name: string;
}

export type ConcreteLiquidNode =
  | ConcreteLiquidRawTag
  | ConcreteLiquidTagOpen
  | ConcreteLiquidTagClose
  | ConcreteLiquidTag
  | ConcreteLiquidDrop;

interface ConcreteBasicLiquidNode<T> extends ConcreteBasicNode<T> {
  whitespaceStart: null | '-';
  whitespaceEnd: null | '-';
}

export interface ConcreteLiquidRawTag
  extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidRawTag> {
  name: string;
  body: string;
  delimiterWhitespaceStart: null | '-';
  delimiterWhitespaceEnd: null | '-';
  blockStartLocStart: number;
  blockStartLocEnd: number;
  blockEndLocStart: number;
  blockEndLocEnd: number;
}

export type ConcreteLiquidTagOpen =
  | ConcreteLiquidTagOpenBaseCase
  | ConcreteLiquidTagOpenNamed;
export type ConcreteLiquidTagOpenNamed =
  | ConcreteLiquidTagOpenCase
  | ConcreteLiquidTagOpenIf
  | ConcreteLiquidTagOpenUnless
  | ConcreteLiquidTagOpenForm
  | ConcreteLiquidTagOpenFor
  | ConcreteLiquidTagOpenPaginate
  | ConcreteLiquidTagOpenTablerow;

export interface ConcreteLiquidTagOpenNode<Name, Markup>
  extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidTagOpen> {
  name: Name;
  markup: Markup;
}

export interface ConcreteLiquidTagOpenBaseCase
  extends ConcreteLiquidTagOpenNode<string, string> {}

export interface ConcreteLiquidTagOpenCase
  extends ConcreteLiquidTagOpenNode<NamedTags.case, ConcreteLiquidExpression> {}
export interface ConcreteLiquidTagWhen
  extends ConcreteLiquidTagNode<NamedTags.when, ConcreteLiquidExpression[]> {}

export interface ConcreteLiquidTagOpenIf
  extends ConcreteLiquidTagOpenNode<NamedTags.if, ConcreteLiquidCondition[]> {}
export interface ConcreteLiquidTagOpenUnless
  extends ConcreteLiquidTagOpenNode<
    NamedTags.unless,
    ConcreteLiquidCondition[]
  > {}
export interface ConcreteLiquidTagElsif
  extends ConcreteLiquidTagNode<NamedTags.elsif, ConcreteLiquidCondition[]> {}

export interface ConcreteLiquidCondition
  extends ConcreteBasicNode<ConcreteNodeTypes.Condition> {
  relation: 'and' | 'or' | null;
  expression: ConcreteLiquidComparison | ConcreteLiquidExpression;
}

export interface ConcreteLiquidComparison
  extends ConcreteBasicNode<ConcreteNodeTypes.Comparison> {
  comparator: Comparators;
  left: ConcreteLiquidExpression;
  right: ConcreteLiquidExpression;
}

export interface ConcreteLiquidTagOpenForm
  extends ConcreteLiquidTagOpenNode<NamedTags.form, ConcreteLiquidArgument[]> {}

export interface ConcreteLiquidTagOpenFor
  extends ConcreteLiquidTagOpenNode<
    NamedTags.for,
    ConcreteLiquidTagForMarkup
  > {}
export interface ConcreteLiquidTagForMarkup
  extends ConcreteBasicNode<ConcreteNodeTypes.ForMarkup> {
  variableName: string;
  collection: ConcreteLiquidExpression;
  reversed: 'reversed' | null;
  args: ConcreteLiquidNamedArgument[];
}

export interface ConcreteLiquidTagOpenTablerow
  extends ConcreteLiquidTagOpenNode<
    NamedTags.tablerow,
    ConcreteLiquidTagForMarkup
  > {}

export interface ConcreteLiquidTagOpenPaginate
  extends ConcreteLiquidTagOpenNode<
    NamedTags.paginate,
    ConcretePaginateMarkup
  > {}

export interface ConcretePaginateMarkup
  extends ConcreteBasicNode<ConcreteNodeTypes.PaginateMarkup> {
  collection: ConcreteLiquidExpression;
  pageSize: ConcreteLiquidExpression;
  args: ConcreteLiquidNamedArgument[] | null;
}

export interface ConcreteLiquidTagClose
  extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidTagClose> {
  name: string;
}

export type ConcreteLiquidTag =
  | ConcreteLiquidTagNamed
  | ConcreteLiquidTagBaseCase;
export type ConcreteLiquidTagNamed =
  | ConcreteLiquidTagAssign
  | ConcreteLiquidTagCycle
  | ConcreteLiquidTagEcho
  | ConcreteLiquidTagElsif
  | ConcreteLiquidTagInclude
  | ConcreteLiquidTagLayout
  | ConcreteLiquidTagRender
  | ConcreteLiquidTagSection
  | ConcreteLiquidTagWhen;

export interface ConcreteLiquidTagNode<Name, Markup>
  extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidTag> {
  markup: Markup;
  name: Name;
}

export interface ConcreteLiquidTagBaseCase
  extends ConcreteLiquidTagNode<string, string> {}
export interface ConcreteLiquidTagEcho
  extends ConcreteLiquidTagNode<NamedTags.echo, ConcreteLiquidVariable> {}
export interface ConcreteLiquidTagSection
  extends ConcreteLiquidTagNode<NamedTags.section, ConcreteStringLiteral> {}
export interface ConcreteLiquidTagLayout
  extends ConcreteLiquidTagNode<NamedTags.layout, ConcreteLiquidExpression> {}

export interface ConcreteLiquidTagAssign
  extends ConcreteLiquidTagNode<
    NamedTags.assign,
    ConcreteLiquidTagAssignMarkup
  > {}
export interface ConcreteLiquidTagAssignMarkup
  extends ConcreteBasicNode<ConcreteNodeTypes.AssignMarkup> {
  name: string;
  value: ConcreteLiquidVariable;
}

export interface ConcreteLiquidTagCycle
  extends ConcreteLiquidTagNode<
    NamedTags.cycle,
    ConcreteLiquidTagCycleMarkup
  > {}
export interface ConcreteLiquidTagCycleMarkup
  extends ConcreteBasicNode<ConcreteNodeTypes.CycleMarkup> {
  groupName: ConcreteLiquidExpression | null;
  args: ConcreteLiquidExpression[];
}

export interface ConcreteLiquidTagRender
  extends ConcreteLiquidTagNode<
    NamedTags.render,
    ConcreteLiquidTagRenderMarkup
  > {}
export interface ConcreteLiquidTagInclude
  extends ConcreteLiquidTagNode<
    NamedTags.include,
    ConcreteLiquidTagRenderMarkup
  > {}

export interface ConcreteLiquidTagRenderMarkup
  extends ConcreteBasicNode<ConcreteNodeTypes.RenderMarkup> {
  snippet: ConcreteStringLiteral | ConcreteLiquidVariableLookup;
  alias: string | null;
  variable: ConcreteRenderVariableExpression | null;
  args: ConcreteLiquidNamedArgument[];
}

export interface ConcreteRenderVariableExpression
  extends ConcreteBasicNode<ConcreteNodeTypes.RenderVariableExpression> {
  kind: 'for' | 'with';
  name: ConcreteLiquidExpression;
}

export interface ConcreteLiquidDrop
  extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidDrop> {
  markup: ConcreteLiquidVariable | string;
}

// The variable is the name + filters, like shopify/liquid.
export interface ConcreteLiquidVariable
  extends ConcreteBasicNode<ConcreteNodeTypes.LiquidVariable> {
  expression: ConcreteLiquidExpression;
  filters: ConcreteLiquidFilter[];
  rawSource: string;
}

export interface ConcreteLiquidFilter
  extends ConcreteBasicNode<ConcreteNodeTypes.LiquidFilter> {
  name: string;
  args: ConcreteLiquidArgument[];
}

export type ConcreteLiquidArgument =
  | ConcreteLiquidExpression
  | ConcreteLiquidNamedArgument;

export interface ConcreteLiquidNamedArgument
  extends ConcreteBasicNode<ConcreteNodeTypes.NamedArgument> {
  name: string;
  value: ConcreteLiquidExpression;
}

export type ConcreteLiquidExpression =
  | ConcreteStringLiteral
  | ConcreteNumberLiteral
  | ConcreteLiquidLiteral
  | ConcreteLiquidRange
  | ConcreteLiquidVariableLookup;

export interface ConcreteStringLiteral
  extends ConcreteBasicNode<ConcreteNodeTypes.String> {
  value: string;
  single: boolean;
}

export interface ConcreteNumberLiteral
  extends ConcreteBasicNode<ConcreteNodeTypes.Number> {
  value: string; // float parsing is weird but supported
}

export interface ConcreteLiquidLiteral
  extends ConcreteBasicNode<ConcreteNodeTypes.LiquidLiteral> {
  keyword: keyof typeof LiquidLiteralValues;
  value: typeof LiquidLiteralValues[keyof typeof LiquidLiteralValues];
}

export interface ConcreteLiquidRange
  extends ConcreteBasicNode<ConcreteNodeTypes.Range> {
  start: ConcreteLiquidExpression;
  end: ConcreteLiquidExpression;
}

export interface ConcreteLiquidVariableLookup
  extends ConcreteBasicNode<ConcreteNodeTypes.VariableLookup> {
  name: string | null;
  lookups: ConcreteLiquidExpression[];
}

export type ConcreteHtmlNode =
  | ConcreteHtmlComment
  | ConcreteHtmlRawTag
  | ConcreteHtmlVoidElement
  | ConcreteHtmlSelfClosingElement
  | ConcreteHtmlTagOpen
  | ConcreteHtmlTagClose;

export interface ConcreteTextNode
  extends ConcreteBasicNode<ConcreteNodeTypes.TextNode> {
  value: string;
}

export interface ConcreteYamlFrontmatterNode
  extends ConcreteBasicNode<ConcreteNodeTypes.YAMLFrontmatter> {
  body: string;
}

export type LiquidHtmlConcreteNode =
  | ConcreteHtmlNode
  | ConcreteLiquidNode
  | ConcreteTextNode
  | ConcreteYamlFrontmatterNode;

export type LiquidHtmlCST = LiquidHtmlConcreteNode[];

const markup = (i: number) => (tokens: Node[]) => tokens[i].sourceString.trim();

export function toLiquidHtmlCST(text: string): LiquidHtmlCST {
  const locStart = (tokens: Node[]) => tokens[0].source.startIdx;
  const locEnd = (tokens: Node[]) => tokens[tokens.length - 1].source.endIdx;
  const textNode = {
    type: ConcreteNodeTypes.TextNode,
    value: function () {
      return (this as any).sourceString;
    },
    locStart,
    locEnd,
  };
  const res = liquidHtmlGrammar.match(text);

  if (res.failed()) {
    throw new LiquidHTMLCSTParsingError(res);
  }

  const ohmAST = toAST(res, {
    HtmlComment: {
      body: markup(1),
      locStart,
      locEnd,
    },

    HtmlRawTagImpl: {
      type: 'HtmlRawTag',
      name: 1,
      attrList: 2,
      body: 4,
      locStart,
      locEnd,
      blockStartLocStart: (tokens: any) => tokens[0].source.startIdx,
      blockStartLocEnd: (tokens: any) => tokens[3].source.endIdx,
      blockEndLocStart: (tokens: any) => tokens[5].source.startIdx,
      blockEndLocEnd: (tokens: any) => tokens[5].source.endIdx,
    },

    HtmlVoidElement: {
      name: 1,
      attrList: 3,
      locStart,
      locEnd,
    },

    HtmlSelfClosingElement: {
      name: 1,
      attrList: 2,
      locStart,
      locEnd,
    },

    HtmlTagOpen: {
      name: 1,
      attrList: 2,
      locStart,
      locEnd,
    },

    HtmlTagClose: {
      name: 1,
      locStart,
      locEnd,
    },

    tagNameOrLiquidDrop: 0,

    AttrUnquoted: {
      name: 0,
      value: 2,
      locStart,
      locEnd,
    },

    AttrSingleQuoted: {
      name: 0,
      value: 3,
      locStart,
      locEnd,
    },

    AttrDoubleQuoted: {
      name: 0,
      value: 3,
      locStart,
      locEnd,
    },

    attrEmpty: {
      type: ConcreteNodeTypes.AttrEmpty,
      name: 0,
      locStart,
      locEnd,
    },

    attrDoubleQuotedValue: 0,
    attrSingleQuotedValue: 0,
    attrUnquotedValue: 0,
    attrDoubleQuotedTextNode: textNode,
    attrSingleQuotedTextNode: textNode,
    attrUnquotedTextNode: textNode,
    liquidNode: 0,
    liquidRawTag: 0,
    liquidRawTagImpl: {
      type: ConcreteNodeTypes.LiquidRawTag,
      name: 3,
      body: 8,
      whitespaceStart: 1,
      whitespaceEnd: 6,
      delimiterWhitespaceStart: 10,
      delimiterWhitespaceEnd: 15,
      locStart,
      locEnd,
      blockStartLocStart: (tokens: Node[]) => tokens[0].source.startIdx,
      blockStartLocEnd: (tokens: Node[]) => tokens[7].source.endIdx,
      blockEndLocStart: (tokens: Node[]) => tokens[9].source.startIdx,
      blockEndLocEnd: (tokens: Node[]) => tokens[16].source.endIdx,
    },

    liquidTagOpen: 0,
    liquidTagOpenBaseCase: 0,
    liquidTagOpenRule: {
      type: ConcreteNodeTypes.LiquidTagOpen,
      name: 3,
      markup(nodes: Node[]) {
        const markupNode = nodes[5];
        const nameNode = nodes[3];
        if (NamedTags.hasOwnProperty(nameNode.sourceString)) {
          return markupNode.toAST((this as any).args.mapping);
        }
        return markupNode.sourceString.trim();
      },
      whitespaceStart: 1,
      whitespaceEnd: 6,
      locStart,
      locEnd,
    },

    liquidTagOpenForm: 0,
    liquidTagOpenFormMarkup: 0,
    liquidTagOpenFor: 0,
    liquidTagOpenForMarkup: {
      type: ConcreteNodeTypes.ForMarkup,
      variableName: 0,
      collection: 4,
      reversed: 6,
      args: 8,
      locStart,
      locEnd,
    },
    liquidTagOpenTablerow: 0,
    liquidTagOpenPaginate: 0,
    liquidTagOpenPaginateMarkup: {
      type: ConcreteNodeTypes.PaginateMarkup,
      collection: 0,
      pageSize: 4,
      args: 6,
      locStart,
      locEnd,
    },
    liquidTagOpenCase: 0,
    liquidTagOpenCaseMarkup: 0,
    liquidTagWhen: 0,
    liquidTagWhenMarkup: 0,
    liquidTagOpenIf: 0,
    liquidTagOpenUnless: 0,
    liquidTagElsif: 0,
    liquidTagOpenConditionalMarkup: 0,
    condition: {
      type: ConcreteNodeTypes.Condition,
      relation: 0,
      expression: 2,
      locStart,
      locEnd,
    },
    comparison: {
      type: ConcreteNodeTypes.Comparison,
      comparator: 2,
      left: 0,
      right: 4,
      locStart,
      locEnd,
    },

    liquidTagClose: {
      type: ConcreteNodeTypes.LiquidTagClose,
      name: 4,
      whitespaceStart: 1,
      whitespaceEnd: 7,
      locStart,
      locEnd,
    },

    liquidTag: 0,
    liquidTagBaseCase: 0,
    liquidTagAssign: 0,
    liquidTagEcho: 0,
    liquidTagCycle: 0,
    liquidTagRender: 0,
    liquidTagInclude: 0,
    liquidTagSection: 0,
    liquidTagLayout: 0,
    liquidTagRule: {
      type: ConcreteNodeTypes.LiquidTag,
      name: 3,
      markup(nodes: Node[]) {
        const markupNode = nodes[5];
        const nameNode = nodes[3];
        if (NamedTags.hasOwnProperty(nameNode.sourceString)) {
          return markupNode.toAST((this as any).args.mapping);
        }
        return markupNode.sourceString.trim();
      },
      whitespaceStart: 1,
      whitespaceEnd: 6,
      locStart,
      locEnd,
    },
    liquidTagEchoMarkup: 0,
    liquidTagSectionMarkup: 0,
    liquidTagLayoutMarkup: 0,
    liquidTagAssignMarkup: {
      type: ConcreteNodeTypes.AssignMarkup,
      name: 0,
      value: 4,
      locStart,
      locEnd,
    },

    liquidTagCycleMarkup: {
      type: ConcreteNodeTypes.CycleMarkup,
      groupName: 0,
      args: 3,
      locStart,
      locEnd,
    },

    liquidTagRenderMarkup: {
      type: ConcreteNodeTypes.RenderMarkup,
      snippet: 0,
      variable: 1,
      alias: 2,
      args: 4,
      locStart,
      locEnd,
    },
    snippetExpression: 0,
    renderVariableExpression: {
      type: ConcreteNodeTypes.RenderVariableExpression,
      kind: 1,
      name: 3,
      locStart,
      locEnd,
    },
    renderAliasExpression: 3,

    liquidDrop: {
      type: ConcreteNodeTypes.LiquidDrop,
      markup: 3,
      whitespaceStart: 1,
      whitespaceEnd: 4,
      locStart,
      locEnd,
    },

    liquidDropCases: 0,
    liquidExpression: 0,
    liquidDropBaseCase: (sw: Node) => sw.sourceString.trimEnd(),
    liquidVariable: {
      type: ConcreteNodeTypes.LiquidVariable,
      expression: 0,
      filters: 1,
      rawSource: (tokens: Node[]) =>
        text
          .slice(locStart(tokens), tokens[tokens.length - 2].source.endIdx)
          .trimEnd(),
      locStart,
      // The last node of this rule is a positive lookahead, we don't
      // want its endIdx, we want the endIdx of the previous one.
      locEnd: (tokens: Node[]) => tokens[tokens.length - 2].source.endIdx,
    },

    liquidFilter: {
      type: ConcreteNodeTypes.LiquidFilter,
      name: 3,
      args(nodes: Node[]) {
        // Traditinally, this would get transformed into null or array. But
        // it's better if we have an empty array instead of null here.
        if (nodes[7].sourceString === '') {
          return [];
        } else {
          return nodes[7].toAST((this as any).args.mapping);
        }
      },
    },
    arguments: 0,
    tagArguments: 0,
    positionalArgument: 0,
    namedArgument: {
      type: ConcreteNodeTypes.NamedArgument,
      name: 0,
      value: 4,
      locStart,
      locEnd,
    },

    liquidString: 0,
    liquidDoubleQuotedString: {
      type: ConcreteNodeTypes.String,
      single: () => false,
      value: 1,
      locStart,
      locEnd,
    },
    liquidSingleQuotedString: {
      type: ConcreteNodeTypes.String,
      single: () => true,
      value: 1,
      locStart,
      locEnd,
    },

    liquidNumber: {
      type: ConcreteNodeTypes.Number,
      value: 0,
      locStart,
      locEnd,
    },

    liquidLiteral: {
      type: ConcreteNodeTypes.LiquidLiteral,
      value: (tokens: Node[]) => {
        const keyword = tokens[0]
          .sourceString as keyof typeof LiquidLiteralValues;
        return LiquidLiteralValues[keyword];
      },
      keyword: 0,
      locStart,
      locEnd,
    },

    liquidRange: {
      type: ConcreteNodeTypes.Range,
      start: 2,
      end: 6,
      locStart,
      locEnd,
    },

    liquidVariableLookup: {
      type: ConcreteNodeTypes.VariableLookup,
      name: 0,
      lookups: 1,
      locStart,
      locEnd,
    },
    variableSegmentAsLookup: {
      type: ConcreteNodeTypes.VariableLookup,
      name: 0,
      lookups: () => [],
      locStart,
      locEnd,
    },

    lookup: 0,
    indexLookup: 3,
    dotLookup: {
      type: ConcreteNodeTypes.String,
      value: 3,
      locStart: (nodes: Node[]) => nodes[2].source.startIdx,
      locEnd: (nodes: Node[]) => nodes[nodes.length - 1].source.endIdx,
    },

    liquidInlineComment: {
      type: ConcreteNodeTypes.LiquidTag,
      name: 3,
      markup: markup(5),
      whitespaceStart: 1,
      whitespaceEnd: 6,
      locStart,
      locEnd,
    },

    TextNode: textNode,

    yamlFrontmatter: {
      type: ConcreteNodeTypes.YAMLFrontmatter,
      body: 2,
      locStart,
      locEnd,
    },

    Node(frontmatter: Node, nodes: Node) {
      const self = this as any;
      const frontmatterNode =
        frontmatter.sourceString.length === 0
          ? []
          : [frontmatter.toAST(self.args.mapping)];

      return frontmatterNode.concat(nodes.toAST(self.args.mapping));
    },

    orderedListOf: 0,
    nonemptyOrderedListOf: 0,
    nonemptyOrderedListOfBoth(
      nonemptyListOfA: Node,
      _sep: Node,
      nonemptyListOfB: Node,
    ) {
      const self = this as any;
      return nonemptyListOfA
        .toAST(self.args.mapping)
        .concat(nonemptyListOfB.toAST(self.args.mapping));
    },

    // Missing from ohm-js default rules. Those turn listOf rules into arrays.
    listOf: 0,
    nonemptyListOf(first: any, _sep: any, rest: any) {
      const self = this as any;
      return [first.toAST(self.args.mapping)].concat(
        rest.toAST(self.args.mapping),
      );
    },
    emptyListOf() {
      return [];
    },
    empty: () => null,
  });

  return ohmAST as LiquidHtmlCST;
}
