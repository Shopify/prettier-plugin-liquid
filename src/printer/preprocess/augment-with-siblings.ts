import {
  AugmentedNode,
  Augment,
  LiquidHtmlNode,
  WithParent,
  WithSiblings,
} from '~/types';

const COLLECTION_KEYS = ['children', 'attributes', 'value'];

export function prev(node: AugmentedNode<WithParent>) {
  if (!node.parentNode) return;
  const collection = parentCollection(node);
  return collection[collection.indexOf(node) - 1];
}

export function next(node: AugmentedNode<WithParent>) {
  if (!node.parentNode) return;
  const collection = parentCollection(node);
  return collection[collection.indexOf(node) + 1];
}

function parentCollection(
  node: AugmentedNode<WithParent>,
): AugmentedNode<WithParent>[] {
  if (
    !node.parentNode ||
    ('name' in node.parentNode && node.parentNode.name === node)
  ) {
    return [];
  }

  for (const key of COLLECTION_KEYS) {
    // can't figure out the typing for this and I am done wasting my time.
    if (
      key in node.parentNode &&
      Array.isArray((node as any).parentNode[key])
    ) {
      if ((node as any).parentNode[key].indexOf(node) !== -1) {
        return (node as any).parentNode[key];
      }
    }
  }

  throw new Error('Could not find parent collection of node');
}

export const augmentWithSiblings: Augment<WithParent> = (_options, node) => {
  const augmentations: WithSiblings = {
    next: next(node) as LiquidHtmlNode | undefined,
    prev: prev(node) as LiquidHtmlNode | undefined,
  };

  Object.assign(node, augmentations);
};
