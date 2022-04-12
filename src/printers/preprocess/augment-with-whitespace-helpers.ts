import {
  Augment,
  AugmentedNode,
  WithCssDisplay,
  WithSiblings,
  WithWhitespaceHelpers,
} from './types';

// Dangling Whitespace === whitespace in an _empty_ node.
// e.g. <span> </span> is dangling whitespace sensitive (cssDisplay === inline)
// e.g. <div> </div> is not dangling whitespace sensitive (cssDisplay === block)
function isDanglingWhitespaceSensitiveNode(_node: AugmentedNode<WithSiblings>) {
  return true;
}

export const augmentWithWhitespaceHelpers: Augment<
  WithCssDisplay & WithSiblings
> = (_options, node) => {
  const augmentations: WithWhitespaceHelpers = {
    isDanglingWhitespaceSensitive: isDanglingWhitespaceSensitiveNode(node),
  };

  Object.assign(node, augmentations);
};
