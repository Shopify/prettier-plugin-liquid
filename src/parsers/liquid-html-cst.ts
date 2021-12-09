import { Parser } from 'prettier';
import { MatchResult } from 'ohm-js';
import { toAST } from 'ohm-js/extras';
import { liquidHtmlGrammar } from './grammar';
import lineColumn from 'line-column';

interface LineColPosition {
  line: number;
  column: number;
}

class LiquidHTMLParsingError extends SyntaxError {
  loc?: { start: LineColPosition; end: LineColPosition };

  constructor(ohm: MatchResult) {
    super(ohm.shortMessage);
    this.name = 'LiquidHTMLParsingError';

    const lineCol = lineColumn((ohm as any).input).fromIndex(
      (ohm as any)._rightmostFailurePosition,
    );

    // Plugging ourselves into @babel/code-frame since this is how
    // the babel parser can print where the parsing error occured.
    // https://github.com/prettier/prettier/blob/cd4a57b113177c105a7ceb94e71f3a5a53535b81/src/main/parser.js
    if (lineCol) {
      this.loc = {
        start: {
          line: lineCol.line,
          column: lineCol.col,
        },
        end: {
          line: lineCol.line,
          column: lineCol.col,
        },
      };
    }
  }
}

export enum ConcreteNodeTypes {
  HtmlRawTag = 'HtmlRawTag',
  HtmlVoidElement = 'HtmlVoidElement',
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
}

export interface Parsers {
  [astFormat: string]: Parser;
}

export interface ConcreteBasicNode<T> {
  type: T;
  locStart: number;
  locEnd: number;
}

export interface ConcreteHtmlNodeBase<T>
  extends ConcreteBasicNode<T> {
  name: string;
  attrList?: ConcreteAttributeNode[];
}

export interface ConcreteHtmlRawTag
  extends ConcreteHtmlNodeBase<ConcreteNodeTypes.HtmlRawTag> {
  body: string;
}
export interface ConcreteHtmlVoidElement
  extends ConcreteHtmlNodeBase<ConcreteNodeTypes.HtmlVoidElement> {}
export interface ConcreteHtmlTagOpen
  extends ConcreteHtmlNodeBase<ConcreteNodeTypes.HtmlTagOpen> {}
export interface ConcreteHtmlTagClose
  extends ConcreteHtmlNodeBase<ConcreteNodeTypes.HtmlTagClose> {}

export interface ConcreteAttributeNodeBase<T>
  extends ConcreteBasicNode<T> {
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
  markup: string;
}

export type ConcreteHtmlNode =
  | ConcreteHtmlRawTag
  | ConcreteHtmlVoidElement
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

export function toLiquidHtmlCST(text: string): LiquidHtmlCST {
  const locStart = (tokens: any) => tokens[0].source.startIdx;
  const locEnd = (tokens: any) =>
    tokens[tokens.length - 1].source.endIdx;
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
    throw new LiquidHTMLParsingError(res);
  }

  const ohmAST = toAST(res, {
    HtmlRawTagImpl: {
      type: 'HtmlRawTag',
      name: 1,
      attrList: 2,
      body: 4,
      locStart,
      locEnd,
    },

    HtmlVoidElement: {
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
    },

    liquidTagOpen: {
      type: ConcreteNodeTypes.LiquidTagOpen,
      name: 3,
      markup: 5,
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
      markup: 5,
      whitespaceStart: 1,
      whitespaceEnd: 6,
      locStart,
      locEnd,
    },

    liquidDrop: {
      type: ConcreteNodeTypes.LiquidDrop,
      markup: 2,
      whitespaceStart: 1,
      whitespaceEnd: 3,
      locStart,
      locEnd,
    },

    textNode,
  });

  return ohmAST as LiquidHtmlCST;
}
