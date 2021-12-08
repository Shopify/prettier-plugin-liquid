import { Parser } from 'prettier';
import { toAST } from 'ohm-js/extras';
import { liquidHtmlGrammar } from './grammar';

export enum ConcreteNodeTypes {
  ScriptTag = 'ScriptTag',
  SelfClosingElement = 'SelfClosingElement',
  VoidElement = 'VoidElement',
  TagOpen = 'TagOpen',
  TagClose = 'TagClose',
  AttrSingleQuoted = 'AttrSingleQuoted',
  AttrDoubleQuoted = 'AttrDoubleQuoted',
  AttrUnquoted = 'AttrUnquoted',
  AttrEmpty = 'AttrEmpty',
  LiquidDrop = 'LiquidDrop',
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

export interface ConcreteScriptTag
  extends ConcreteHtmlNodeBase<ConcreteNodeTypes.ScriptTag> {
  body: string;
}
export interface ConcreteSelfClosingElement
  extends ConcreteHtmlNodeBase<ConcreteNodeTypes.SelfClosingElement> {}
export interface ConcreteVoidElement
  extends ConcreteHtmlNodeBase<ConcreteNodeTypes.VoidElement> {}
export interface ConcreteTagOpen
  extends ConcreteHtmlNodeBase<ConcreteNodeTypes.TagOpen> {}
export interface ConcreteTagClose
  extends ConcreteHtmlNodeBase<ConcreteNodeTypes.TagClose> {}

export interface ConcreteAttributeNodeBase<T>
  extends ConcreteBasicNode<T> {
  name: string;
  value: (ConcreteLiquidNode | ConcreteTextNode)[];
}

export type ConcreteAttributeNode =
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
  | ConcreteLiquidTagOpen
  | ConcreteLiquidTagClose
  | ConcreteLiquidTag
  | ConcreteLiquidDrop;

interface ConcreteBasicLiquidNode<T> extends ConcreteBasicNode<T> {
  whitespaceStart: null | '-';
  whitespaceEnd: null | '-';
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
  | ConcreteScriptTag
  | ConcreteVoidElement
  | ConcreteSelfClosingElement
  | ConcreteTagOpen
  | ConcreteTagClose;

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
  const ohmAST = toAST(res, {
    ScriptTag: {
      name: 'script',
      attrList: 1,
      body: 3,
      locStart,
      locEnd,
    },

    SelfClosingElement: {
      name: 1,
      attrList: 2,
      locStart,
      locEnd,
    },

    VoidElement: {
      name: 1,
      attrList: 2,
      locStart,
      locEnd,
    },

    TagOpen: {
      name: 1,
      attrList: 2,
      locStart,
      locEnd,
    },

    TagClose: {
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
