import { CSS_DISPLAY_DEFAULT, CSS_DISPLAY_TAGS } from '../constants.evaluate';
import * as AST from '../parsers/ast';
import { LiquidParserOptions } from './utils';
import { next, prev } from './utils/node';
import { assertNever } from '../utils';

export {
  Position,
  AttributeNodeBase,
  HtmlNodeBase,
  isBranchedTag,
  NodeTypes,
} from '../parsers/ast';

const { NodeTypes } = AST;

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
export type Augmented<T, Aug> = {
  [Property in keyof T]: [T[Property]] extends [(infer Item)[]]
    ? [Item] extends [AST.LiquidHtmlNode]
      ? Augmented<Item, Aug>[]
      : Item[]
    : T[Property] extends infer P // this here is to distribute the condition
      ? P extends AST.LiquidHtmlNode // so string and LiquidDrop go through this check independently
        ? Augmented<P, Aug>
        : P
      : never;
} & Aug;

export type AllAugmentations = WithCssDisplay &
  WithSiblings &
  WithWhitespaceHelpers;

type WithCssDisplay = {
  cssDisplay: string;
};

type WithSiblings = {
  // We're cheating here by saying the prev/next will have all the props.
  // That's kind of a lie. But it would be too complicated to do this any
  // other way.
  prev: LiquidHtmlNode | undefined;
  next: LiquidHtmlNode | undefined;
};

type WithWhitespaceHelpers = {
  isDanglingWhitespaceSensitive: boolean;
};

type AugmentedNode<Aug> = Augmented<AST.LiquidHtmlNode, Aug>;

export type Augment<Aug> = <T extends AugmentedNode<Aug>>(
  o: LiquidParserOptions,
  n: T,
) => void;

export type LiquidHtmlNode = Augmented<AST.LiquidHtmlNode, AllAugmentations>;
export type DocumentNode = Augmented<AST.DocumentNode, AllAugmentations>;
export type LiquidNode = Augmented<AST.LiquidNode, AllAugmentations>;
export type ParentNode = Augmented<AST.ParentNode, AllAugmentations>;
export type LiquidRawTag = Augmented<AST.LiquidRawTag, AllAugmentations>;
export type LiquidTag = Augmented<AST.LiquidTag, AllAugmentations>;
export type LiquidBranch = Augmented<AST.LiquidBranch, AllAugmentations>;
export type LiquidDrop = Augmented<AST.LiquidDrop, AllAugmentations>;
export type HtmlNode = Augmented<AST.HtmlNode, AllAugmentations>;
export type HtmlElement = Augmented<AST.HtmlElement, AllAugmentations>;
export type HtmlVoidElement = Augmented<AST.HtmlVoidElement, AllAugmentations>;
export type HtmlSelfClosingElement = Augmented<
  AST.HtmlSelfClosingElement,
  AllAugmentations
>;
export type HtmlRawNode = Augmented<AST.HtmlRawNode, AllAugmentations>;
export type HtmlComment = Augmented<AST.HtmlComment, AllAugmentations>;
export type AttributeNode = Augmented<AST.AttributeNode, AllAugmentations>;
export type AttrSingleQuoted = Augmented<
  AST.AttrSingleQuoted,
  AllAugmentations
>;
export type AttrDoubleQuoted = Augmented<
  AST.AttrDoubleQuoted,
  AllAugmentations
>;
export type AttrUnquoted = Augmented<AST.AttrUnquoted, AllAugmentations>;
export type AttrEmpty = Augmented<AST.AttrEmpty, AllAugmentations>;
export type TextNode = Augmented<AST.TextNode, AllAugmentations>;

function getCssDisplay(
  node: AugmentedNode<WithSiblings>,
  options: LiquidParserOptions,
): string {
  if (node.prev && node.prev.type === NodeTypes.HtmlComment) {
    // <!-- display: block -->
    const match = node.prev.body.match(/^\s*display:\s*([a-z]+)\s*$/);
    if (match) {
      return match[1];
    }
  }

  switch (node.type) {
    case NodeTypes.HtmlElement:
    case NodeTypes.HtmlVoidElement:
    case NodeTypes.HtmlSelfClosingElement:
    case NodeTypes.HtmlRawNode: {
      switch (options.htmlWhitespaceSensitivity) {
        case 'strict':
          return 'inline';
        case 'ignore':
          return 'block';
        default: {
          return (
            (node.type === NodeTypes.HtmlElement &&
              typeof node.name === 'string' &&
              CSS_DISPLAY_TAGS[node.name]) ||
            CSS_DISPLAY_DEFAULT
          );
        }
      }
    }

    case NodeTypes.TextNode:
      return 'inline';

    case NodeTypes.LiquidTag:
    case NodeTypes.LiquidRawTag:
    case NodeTypes.LiquidBranch:
    case NodeTypes.LiquidDrop:
      return 'inline';

    case NodeTypes.AttrDoubleQuoted:
    case NodeTypes.AttrSingleQuoted:
    case NodeTypes.AttrUnquoted:
    case NodeTypes.AttrEmpty:
      return 'inline'

    case NodeTypes.HtmlComment:
      return 'block';

    case NodeTypes.Document:
      return 'block';

    default:
      return assertNever(node);
  }
}

const augmentWithCSSDisplay: Augment<WithSiblings> = (options, node) => {
  const augmentations: WithCssDisplay = {
    cssDisplay: getCssDisplay(node, options),
  };

  Object.assign(node, augmentations);
};

const augmentWithSiblings: Augment<{}> = (_options, node) => {
  const augmentations: WithSiblings = {
    next: next(node) as LiquidHtmlNode | undefined,
    prev: prev(node) as LiquidHtmlNode | undefined,
  };

  Object.assign(node, augmentations);
};

const augmentWithWhitespaceHelpers: Augment<WithCssDisplay & WithSiblings> = (
  _options,
  node,
) => {
  const augmentations: WithWhitespaceHelpers = {
    isDanglingWhitespaceSensitive: isDanglingWhitespaceSensitiveNode(node),
  };

  Object.assign(node, augmentations);
};

function isDanglingWhitespaceSensitiveNode(_node: AugmentedNode<WithSiblings>) {
  return true;
}

// This is super hard to type check so I'll just magically assume
// everything works.
export function preprocess(
  ast: AST.DocumentNode,
  options: LiquidParserOptions,
): DocumentNode {
  const augmentationPipeline = [
    augmentWithSiblings,
    augmentWithCSSDisplay,
    augmentWithWhitespaceHelpers,
  ].map((fn) => fn.bind(null, options));

  for (const augmentation of augmentationPipeline) {
    AST.walk(ast, augmentation as any);
  }
  return ast as DocumentNode;
}
