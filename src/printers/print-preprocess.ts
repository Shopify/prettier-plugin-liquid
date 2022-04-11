import * as AST from '../parsers/ast';

export {
  Position,
  HtmlNodeBase,
  AttributeNodeBase,
  isBranchedTag,
  NodeTypes,
} from '../parsers/ast';

export type Augmentations = {
  isDanglingWhitespaceSensitive: boolean;
};

// This one warrants a bit of an explanation 'cuz it's definitely next
// level typescript kung-fu shit.
//
// We have an AST, right? And we want to augment every node in the AST with
// new properties. But we don't want to traverse the tree and repeat
// ourselves. So we use a mapped type to map on the properties of T to do
// the following:
//
// - If the property is an array of LiquidHtmlNode, we'll map that to an array of
// Augmented<T[property]> instead.
//
// - If the property is a something | LiquidHtmlNode, then we'll map that type
// to something | Augmented<T[Property]>
//
// So this thing will go through node.name, node.children, node.attributes,
// and so on and give us augmented types.
//
// prettier-ignore
export type Augmented<T> = {
  [Property in keyof T]: [T[Property]] extends [(infer Item)[]]
    ? Augmented<Item>[]
    : [T[Property]] extends [infer P] // this here is to distribute the condition
      ? P extends AST.LiquidHtmlNode // so string and LiquidDrop go through this check independently
        ? Augmented<P>
        : P
      : never;
} & Augmentations;

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
    isDanglingWhitespaceSensitive: isDanglingWhitespaceSensitiveNode(node),
  };

  Object.assign(node, augmentations);
}

function isDanglingWhitespaceSensitiveNode(_node: AST.LiquidHtmlNode) {
  return true;
}
