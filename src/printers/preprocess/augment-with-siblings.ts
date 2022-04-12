import { next, prev } from '../utils';
import { Augment, LiquidHtmlNode, WithSiblings } from './types';

export const augmentWithSiblings: Augment<{}> = (_options, node) => {
  const augmentations: WithSiblings = {
    next: next(node) as LiquidHtmlNode | undefined,
    prev: prev(node) as LiquidHtmlNode | undefined,
  };

  Object.assign(node, augmentations);
};
