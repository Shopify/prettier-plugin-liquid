// A lot in here is adapted from prettier/prettier.

import { NodeTypes } from '../../parsers';
import {
  CSS_WHITE_SPACE_DEFAULT,
  CSS_WHITE_SPACE_TAGS,
} from '../../constants.evaluate';
import {
  Augment,
  AugmentedNode,
  WithCssDisplay,
  WithParent,
  WithSiblings,
  WithWhitespaceHelpers,
} from './types';

type RequiredAugmentations = WithParent & WithSiblings & WithCssDisplay;
type AugmentedAstNode = AugmentedNode<RequiredAugmentations>;

export const augmentWithWhitespaceHelpers: Augment<RequiredAugmentations> = (
  _options,
  node,
) => {
  const augmentations: WithWhitespaceHelpers = {
    isDanglingWhitespaceSensitive: isDanglingWhitespaceSensitiveNode(node),
    isWhitespaceSensitive: isWhitespaceSensitiveNode(node),
    isLeadingWhitespaceSensitive: isLeadingWhitespaceSensitiveNode(node),
    isTrailingWhitespaceSensitive: isTrailingWhitespaceSensitiveNode(node),
    isIndentationSensitive: isIndentationSensitiveNode(node),
  };

  Object.assign(node, augmentations);
};

/**
 * A node is dangling whitespace sensitive when whitespace in an empty node
 * (no children) has meaning in the rendered output.
 *
 * examples:
 *   - <span> </span> is dangling whitespace sensitive (cssDisplay === inline)
 *   - <div> </div> is not dangling whitespace sensitive (cssDisplay === block)
 */
function isDanglingWhitespaceSensitiveNode(_node: AugmentedAstNode) {
  return true;
}

/**
 * A node is whitespace sensitive when its contents is sensitive to
 * whitespace. That is, whitespace between nodes must be maintained
 * otherwise the rendered output would be different.
 *
 * A special case of whitespace sensitive nodes are nodes that are also
 * indentation sensitive.
 *
 * examples:
 *   - script-like tags
 *   - indentation-sensitive tags (e.g. <pre></pre>)
 */
function isWhitespaceSensitiveNode(node: AugmentedAstNode) {
  return isScriptLikeTag(node) || isIndentationSensitiveNode(node);
}

/**
 * A node is indentation sensitive when the indentation used in the output
 * must match the indentation used in the source, otherwise the rendered
 * output would be different.
 *
 * example:
 *  - <pre></pre>
 */
function isIndentationSensitiveNode(node: AugmentedAstNode) {
  return getNodeCssStyleWhiteSpace(node).startsWith('pre');
}

function isLeadingWhitespaceSensitiveNode(_node: AugmentedAstNode): boolean {
  return true;
}

/**
 * A node is trailing whitespace sensitive when removing (or adding) whitespace
 * between this node and the next sibling (or parent closing tag) would alter the
 * rendered output.
 *
 * As such, it is whitespace _to the right_ of this node (it is not
 * contained by the node).
 *
 * example:
 *   ```
 *   <p>
 *     hello <span>world</span>
 *   </p>
 *   ```
 *
 *  - "hello" is trailing whitespace sensitive
 *  - <span>world</span> is not
 *    - "world" is trailing whitespace sensitive
 *
 * This is really complicated to get right, so treat it as though it is not
 * the actual solution. We'll default to true and consider the edge cases.
 */
function isTrailingWhitespaceSensitiveNode(node: AugmentedAstNode): boolean {
  // '{{ drop -}} text'
  if (isTrimmingOuterRight(node)) {
    return false;
  }

  // 'text {{- drop }}'
  if (node.next && isTrimmingOuterLeft(node.next)) {
    return false;
  }

  // the root node and invisible nodes are not trailing whitespace
  // sensitive
  if (!node.parentNode || node.parentNode.cssDisplay === 'none') {
    return false;
  }

  // pre-like nodes are whitespace sensitive (globally), therefore if this
  // node's parent is pre-like, this node is whitespace sensitive to the right.
  if (isPreLikeNode(node.parentNode)) {
    return true;
  }

  // Adapted from prettier/language-html. This branch is for the last
  // children of an array.
  //
  // The node would not be trailing whitespace sensitive if either of the
  // following is true.
  //  - the parent is the root
  //  - this node is pre-like (whitespace outside pre tags is irrelevant)
  //  - this node is script-like (since the whitespace following a script is irrelevant)
  //  - the parent is not (inner) trailing whitespace sensitive (e.g. block)
  //  - the parent is trimming the inner right (e.g. {% form %} hello {%- endform %})
  //
  //  prettier-ignore
  if (
    !node.next && (
      node.parentNode.type === NodeTypes.Document
      || isPreLikeNode(node)
      || isScriptLikeTag(node.parentNode) // technically we don't use this one.
      || !isLastChildTrailingSpaceSensitiveCssDisplay(node.parentNode.cssDisplay)
      || isTrimmingInnerRight(node.parentNode)
    )
  ) {
    return false;
  }

  // A bit of a mouthful. When the next child is not whitespace sensitive to
  // the outer left.
  //
  // example:
  //  <p>Hello <div>world</div></p>
  //
  // Hello is not whitespace sensitive to the right because the next
  // element is a block and doesn't care about whitespace to its left.
  if (
    node.next &&
    !isPrevTrailingSpaceSensitiveCssDisplay(node.next.cssDisplay)
  ) {
    return false;
  }

  // Default to true. We might be wrong, but we err on the side of caution.
  return true;
}

const HtmlNodeTypes = [
  NodeTypes.HtmlElement,
  NodeTypes.HtmlRawNode,
  NodeTypes.HtmlVoidElement,
  NodeTypes.HtmlSelfClosingElement,
] as const;

const LiquidNodeTypes = [
  NodeTypes.LiquidTag,
  NodeTypes.LiquidDrop,
  NodeTypes.LiquidBranch,
  NodeTypes.LiquidRawTag,
] as const;

type HtmlNode = Extract<
  AugmentedAstNode,
  { type: typeof HtmlNodeTypes[number] }
>;

type LiquidNode = Extract<
  AugmentedAstNode,
  { type: typeof LiquidNodeTypes[number] }
>;

type TextNode = Extract<AugmentedAstNode, { type: NodeTypes.TextNode }>;

export function isHtmlNode(node: AugmentedAstNode): node is HtmlNode {
  return HtmlNodeTypes.includes(node.type as any);
}

export function isLiquidNode(node: AugmentedAstNode): node is LiquidNode {
  return LiquidNodeTypes.includes(node.type as any);
}

export function isTextNode(node: AugmentedAstNode): node is TextNode {
  return node.type === NodeTypes.TextNode;
}

export function isTrimmingOuterRight(
  node: AugmentedAstNode | undefined,
): boolean {
  if (!node) return false;
  switch (node.type) {
    case NodeTypes.LiquidRawTag:
    case NodeTypes.LiquidTag: // {% if a %}{% endif -%}, {% assign x -%}
      return (node.delimiterWhitespaceEnd ?? node.whitespaceEnd) === '-';
    case NodeTypes.LiquidBranch:
      return false;
    case NodeTypes.LiquidDrop: // {{ foo -}}
      return node.whitespaceEnd === '-';
    default:
      return false;
  }
}

export function isTrimmingOuterLeft(
  node: AugmentedAstNode | undefined,
): boolean {
  if (!node) return false;
  switch (node.type) {
    case NodeTypes.LiquidRawTag:
    case NodeTypes.LiquidTag: // {%- if a %}{% endif %}, {%- assign x = 1 %}
    case NodeTypes.LiquidBranch: // {%- else %}
    case NodeTypes.LiquidDrop: // {{- 'val' }}
      return node.whitespaceStart === '-';
    default:
      return false;
  }
}

export function isTrimmingInnerLeft(
  node: AugmentedAstNode | undefined,
): boolean {
  if (!node) return false;
  switch (node.type) {
    case NodeTypes.LiquidRawTag:
    case NodeTypes.LiquidTag: // {% form a -%}{% endform %}
      if (node.delimiterWhitespaceEnd === undefined) return false;
      return node.whitespaceEnd === '-';
    case NodeTypes.LiquidBranch: // {% if a -%}{% else -%}{% endif %}
      // This branch should never happen.
      if (!node.parentNode || node.parentNode.type !== NodeTypes.LiquidTag) {
        return false;
      }

      // First branch gets this from the parent
      if (!node.prev) {
        return isTrimmingInnerLeft(node.parentNode);
      }

      // Otherwise gets it from the delimiter. e.g. {% else -%}
      return node.whitespaceEnd === '-';
    case NodeTypes.LiquidDrop:
    default:
      return false;
  }
}

export function isTrimmingInnerRight(
  node: AugmentedAstNode | undefined,
): boolean {
  if (!node) return false;
  switch (node.type) {
    case NodeTypes.LiquidRawTag:
    case NodeTypes.LiquidTag: // {% if a %}{%- endif %}
      if (node.delimiterWhitespaceStart === undefined) return false;
      return node.delimiterWhitespaceStart === '-';
    case NodeTypes.LiquidBranch:
      // This branch should never happen.
      if (!node.parentNode || node.parentNode.type !== NodeTypes.LiquidTag) {
        return false;
      }

      // Last branch gets this from the parent
      if (!node.next) {
        return isTrimmingInnerRight(node.parentNode);
      }

      // Otherwise gets it from the next branch
      return isTrimmingOuterLeft(node.next);
    case NodeTypes.LiquidDrop:
    default:
      return false;
  }
}

/// The helpers below were taken from prettier/src/language-html
function isScriptLikeTag(node: AugmentedAstNode) {
  return node.type === NodeTypes.HtmlRawNode;
}

function isBlockLikeCssDisplay(cssDisplay: string) {
  return (
    cssDisplay === 'block' ||
    cssDisplay === 'list-item' ||
    cssDisplay.startsWith('table')
  );
}

function isFirstChildLeadingSpaceSensitiveCssDisplay(cssDisplay: string) {
  return !isBlockLikeCssDisplay(cssDisplay) && cssDisplay !== 'inline-block';
}

function isLastChildTrailingSpaceSensitiveCssDisplay(cssDisplay: string) {
  return !isBlockLikeCssDisplay(cssDisplay) && cssDisplay !== 'inline-block';
}

function isPrevTrailingSpaceSensitiveCssDisplay(cssDisplay: string) {
  return !isBlockLikeCssDisplay(cssDisplay);
}

function isNextLeadingSpaceSensitiveCssDisplay(cssDisplay: string) {
  return !isBlockLikeCssDisplay(cssDisplay);
}

function isDanglingSpaceSensitiveCssDisplay(cssDisplay: string) {
  return !isBlockLikeCssDisplay(cssDisplay) && cssDisplay !== 'inline-block';
}

function isPreLikeNode(node: AugmentedAstNode) {
  return getNodeCssStyleWhiteSpace(node).startsWith('pre');
}

function getNodeCssStyleWhiteSpace(node: AugmentedAstNode) {
  return (
    (isHtmlNode(node) &&
      typeof node.name === 'string' &&
      CSS_WHITE_SPACE_TAGS[node.name]) ||
    CSS_WHITE_SPACE_DEFAULT
  );
}
