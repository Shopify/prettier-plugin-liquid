import { DocumentNode, LiquidHtmlNode } from '../../parsers';

export function prev(node: LiquidHtmlNode) {
  if (!node.parentNode) return;
  const collection = parentCollection(node);
  return collection[collection.indexOf(node) - 1];
}

export function next(node: LiquidHtmlNode) {
  if (!node.parentNode) return;
  const collection = parentCollection(node);
  return collection[collection.indexOf(node) + 1];
}

const COLLECTION_KEYS = ['children', 'attributes', 'value'];

function parentCollection(
  node: Exclude<LiquidHtmlNode, DocumentNode>,
): LiquidHtmlNode[] {
  if (!node.parentNode || 'name' in node.parentNode && node.parentNode.name === node) {
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
