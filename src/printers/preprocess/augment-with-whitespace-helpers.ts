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
  WithSiblings,
  WithWhitespaceHelpers,
} from './types';

type RequiredAugmentations = WithSiblings & WithCssDisplay;
type AugmentedAstNode = AugmentedNode<RequiredAugmentations>;

const HtmlNodeTypes = [
  NodeTypes.HtmlElement,
  NodeTypes.HtmlRawNode,
  NodeTypes.HtmlVoidElement,
  NodeTypes.HtmlSelfClosingElement,
] as const;

type HtmlNode = Extract<
  AugmentedAstNode,
  { type: typeof HtmlNodeTypes[number] }
>;

export const augmentWithWhitespaceHelpers: Augment<RequiredAugmentations> = (
  _options,
  node,
) => {
  const augmentations: WithWhitespaceHelpers = {
    isDanglingWhitespaceSensitive: isDanglingWhitespaceSensitiveNode(node),
    isWhitespaceSensitive: isWhitespaceSensitiveNode(node),
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
 * examples:
 *  - <pre></pre>
 */
function isIndentationSensitiveNode(node: AugmentedAstNode) {
  return getNodeCssStyleWhiteSpace(node).startsWith('pre');
}

function isScriptLikeTag(node: AugmentedAstNode) {
  return (
    isHtmlNode(node) &&
    typeof node.name === 'string' &&
    (node.name === 'script' || node.name === 'style')
  );
}

function isHtmlNode(node: AugmentedAstNode): node is HtmlNode {
  return HtmlNodeTypes.includes(node.type as any);
}

function getNodeCssStyleWhiteSpace(node: AugmentedAstNode) {
  return (
    (isHtmlNode(node) &&
      typeof node.name === 'string' &&
      CSS_WHITE_SPACE_TAGS[node.name]) ||
    CSS_WHITE_SPACE_DEFAULT
  );
}
