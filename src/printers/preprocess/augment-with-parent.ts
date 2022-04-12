import { Augment, ParentNode, WithParent } from './types';

export const augmentWithParent: Augment<{}> = (_options, node, parentNode) => {
  const augmentations: WithParent = {
    parentNode: parentNode as ParentNode | undefined,
  };

  Object.assign(node, augmentations);
};
