import { Parser } from 'prettier';
import { Node } from 'ohm-js';
import { toAST } from 'ohm-js/extras';
import { liquidHtmlGrammar } from '~/parser/grammar';
import { LiquidHTMLCSTParsingError } from '~/parser/errors';

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

  LiquidVariable = 'LiquidVariable',
  LiquidLiteral = 'LiquidLiteral',
  VariableLookup = 'VariableLookup',
  String = 'String',
  Number = 'Number',
  Range = 'Range',
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

export interface ConcreteLiquidTagOpen
  extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidTagOpen> {
  name: string;
  markup: string;
}

export interface ConcreteLiquidTagClose
  extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidTagClose> {
  name: string;
}

export interface ConcreteLiquidTag
  extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidTag> {
  name: string;
  markup: string;
}

export interface ConcreteLiquidDrop
  extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidDrop> {
  markup: ConcreteLiquidVariable | string;
}

// The variable is the name + filters, like shopify/liquid.
export interface ConcreteLiquidVariable
  extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidVariable> {
  expression: ConcreteLiquidExpression;
  filters: ConcreteLiquidFilters[];
  rawSource: string;
}

export type ConcreteLiquidFilters = undefined; // TODO

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

export type LiquidHtmlConcreteNode =
  | ConcreteHtmlNode
  | ConcreteLiquidNode
  | ConcreteTextNode;

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
      body: 7,
      whitespaceStart: 1,
      whitespaceEnd: 5,
      delimiterWhitespaceStart: 9,
      delimiterWhitespaceEnd: 14,
      locStart,
      locEnd,
      blockStartLocStart: (tokens: Node[]) => tokens[0].source.startIdx,
      blockStartLocEnd: (tokens: Node[]) => tokens[6].source.endIdx,
      blockEndLocStart: (tokens: Node[]) => tokens[8].source.startIdx,
      blockEndLocEnd: (tokens: Node[]) => tokens[15].source.endIdx,
    },

    liquidTagOpen: {
      type: ConcreteNodeTypes.LiquidTagOpen,
      name: 3,
      markup: markup(5),
      whitespaceStart: 1,
      whitespaceEnd: 6,
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

    liquidTag: {
      type: ConcreteNodeTypes.LiquidTag,
      name: 3,
      markup: markup(5),
      whitespaceStart: 1,
      whitespaceEnd: 6,
      locStart,
      locEnd,
    },

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
    liquidDropBaseCase: (sw: Node) => sw.sourceString.trimEnd(),
    liquidVariable: {
      type: ConcreteNodeTypes.LiquidVariable,
      expression: 0,
      rawSource: (tokens: Node[]) =>
        text
          .slice(locStart(tokens), tokens[tokens.length - 2].source.endIdx)
          .trimEnd(),
      locStart,
      // The last node of this rule is a positive lookahead, we don't
      // want its endIdx, we want the endIdx of the previous one.
      locEnd: (tokens: Node[]) => tokens[tokens.length - 2].source.endIdx,
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

    lookup: 0,
    dotLookup: {
      type: ConcreteNodeTypes.String,
      value: ([, , , node1, node2]: Node[]) =>
        node1.sourceString + node2.sourceString,
      locStart: (nodes: Node[]) => nodes[2].source.startIdx,
      locEnd: (nodes: Node[]) => nodes[nodes.length - 1].source.endIdx,
    },
    indexLookup: 3,

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
  });

  return ohmAST as LiquidHtmlCST;
}
