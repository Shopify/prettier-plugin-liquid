import { Parser } from 'prettier';
import { toAST } from 'ohm-js/extras';
import { liquidHtmlGrammar } from './grammar';
import { LiquidHTMLCSTParsingError } from './utils';

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
}

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

export function toLiquidHtmlCST(text: string): LiquidHtmlCST {
  const locStart = (tokens: any) => tokens[0].source.startIdx;
  const locEnd = (tokens: any) => tokens[tokens.length - 1].source.endIdx;
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
      body: 1,
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
    },

    HtmlVoidElement: {
      name: 1,
      attrList: 2,
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

    TextNode: textNode,
  });

  return ohmAST as LiquidHtmlCST;
}
