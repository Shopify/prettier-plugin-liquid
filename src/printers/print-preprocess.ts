import * as AST from '../parsers/ast';

export type Augmentations = {
  isDanglingWhitespaceSensitive: boolean;
};

// prettier-ignore
export type Augmented<T> =
  T extends AST.HasChildren
    ? T extends AST.HasAttributes
      ? T & Augmentations & { children?: Children } & { attributes: Attributes }
      : T & Augmentations & { children?: Children }
    : T extends AST.HasAttributes
      ? T & Augmentations & { attributes: Attributes }
      : T extends AST.HasValue
        ? T & Augmentations & { value: Value }
        : T & Augmentations

type Children = Augmented<AST.LiquidHtmlNode>[];
type Attributes = Augmented<AST.AttributeNode>[];
type Value = Augmented<AST.ValueNode>[];

export type LiquidHtmlNode = Augmented<AST.LiquidHtmlNode>;
export type DocumentNode = Augmented<AST.DocumentNode>;
export type LiquidNode = Augmented<AST.LiquidNode>;
export type ParentNode = Augmented<AST.ParentNode>;
export type LiquidRawTag = Augmented<AST.LiquidRawTag>;
export type LiquidTag = Augmented<AST.LiquidTag>;
export type LiquidBranch = Augmented<AST.LiquidBranch>;
export type LiquidDrop = Augmented<AST.LiquidDrop>;
export type HtmlNode = Augmented<AST.HtmlNode>;
export type HtmlElement = Augmented<AST.HtmlElement>;
export type HtmlVoidElement = Augmented<AST.HtmlVoidElement>;
export type HtmlSelfClosingElement = Augmented<AST.HtmlSelfClosingElement>;
export type HtmlRawNode = Augmented<AST.HtmlRawNode>;
export type HtmlComment = Augmented<AST.HtmlComment>;
export type AttributeNode = Augmented<AST.AttributeNode>;
export type AttrSingleQuoted = Augmented<AST.AttrSingleQuoted>;
export type AttrDoubleQuoted = Augmented<AST.AttrDoubleQuoted>;
export type AttrUnquoted = Augmented<AST.AttrUnquoted>;
export type AttrEmpty = Augmented<AST.AttrEmpty>;
export type TextNode = Augmented<AST.TextNode>;

// This is super hard to type check so I'll just magically assume
// everything works.
export function preprocess(ast: AST.DocumentNode): DocumentNode {
  AST.walk(ast, augment);
  return ast as DocumentNode;
}

function augment(node: AST.LiquidHtmlNode): void {
  const augmentations: Augmentations = {
    isDanglingWhitespaceSensitive: isDanglingWhitespaceSensitiveNode(node)
  }

  Object.assign(node, augmentations);
}

function isDanglingWhitespaceSensitiveNode(_node: AST.LiquidHtmlNode) {
  return true;
}

