import { LiquidHtmlNode, LiquidBranch } from '../preprocess';
import { NodeTypes } from '../../types';
import { isBranchedTag } from '../../parsers';
import { Doc, doc } from 'prettier';
import { isWhitespace } from './string';
import { LiquidAstPath } from './types';

export * from './types';
export * from './string';
export * from './node';

const { builders } = doc;
const { ifBreak, indent } = builders;

export function intersperse<T>(array: T[], delim: T): T[] {
  return array.flatMap((val) => [delim, val]).slice(1);
}

export function getSource(path: LiquidAstPath) {
  return path.getValue().source;
}

export function isEmpty(col: any[]): boolean {
  return col.length === 0;
}

export function isDeeplyNested(
  node: Extract<LiquidHtmlNode, { children?: LiquidHtmlNode[] }>,
): boolean {
  if (!node.children) return false;
  if (isBranchedTag(node)) {
    return !!node.children.find((child) =>
      isDeeplyNested(child as LiquidBranch),
    );
  }
  return !!node.children.find(
    (child) => !isEmpty((child as any).children || []),
  );
}

export function isTrimmingInnerLeft(node: LiquidHtmlNode | undefined): boolean {
  if (!node) return false;
  switch (node.type) {
    case NodeTypes.LiquidRawTag:
    case NodeTypes.LiquidTag: // {% if a -%}{% endif %}
      if (node.delimiterWhitespaceEnd === undefined) return false;
      return node.whitespaceEnd === '-';
    case NodeTypes.LiquidBranch: // {% else -%}
      if (node.name === null) return false;
      return node.whitespaceEnd === '-';
    case NodeTypes.LiquidDrop:
    default:
      return false;
  }
}

export function isTrimmingInnerRight(
  node: LiquidHtmlNode | undefined,
): boolean {
  if (!node) return false;
  switch (node.type) {
    case NodeTypes.LiquidRawTag:
    case NodeTypes.LiquidTag: // {% if a %}{%- endif %}
      if (node.delimiterWhitespaceStart === undefined) return false;
      return node.delimiterWhitespaceStart === '-';
    case NodeTypes.LiquidBranch:
    case NodeTypes.LiquidDrop:
    default:
      return false;
  }
}

// Optionally converts a '' into '-' if any of the parent group breaks and source[loc] is non space.
export function getWhitespaceTrim(
  currWhitespaceTrim: string,
  source: string,
  loc: number,
  parentGroupId: symbol | undefined,
  ...groupIds: (symbol | undefined)[]
): Doc {
  return ifBreakChain(
    !isWhitespace(source, loc) ? '-' : currWhitespaceTrim,
    currWhitespaceTrim,
    parentGroupId,
    ...groupIds,
  );
}

// Threads ifBreak into multiple sources of breakage (paragraph or self, etc.)
export const FORCE_FLAT_GROUP_ID = Symbol('force-no-break');
export function ifBreakChain(
  breaksContent: Doc,
  flatContent: Doc,
  ...groupIds: (symbol | undefined)[]
) {
  if (groupIds.includes(FORCE_FLAT_GROUP_ID)) return flatContent;
  return groupIds.reduce(
    (currFlatContent, groupId) =>
      ifBreak(breaksContent, currFlatContent, { groupId }),
    flatContent,
  );
}

export function maybeIndent(whitespace: Doc, doc: Doc): Doc {
  if (!doc) return '';
  return indent([whitespace, doc]);
}

export function isNonEmptyArray(object: any): object is any[] {
  return Array.isArray(object) && object.length > 0;
}
