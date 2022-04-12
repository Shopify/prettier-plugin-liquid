import { LiquidHtmlNode, LiquidBranch } from '../preprocess';
import { isBranchedTag, NodeTypes } from '../../parsers';
import { Doc, doc, AstPath, ParserOptions } from 'prettier';

const { builders } = doc;
const { ifBreak, indent } = builders;

export * from './node';

export type LiquidAstPath = AstPath<LiquidHtmlNode>;
export type LiquidParserOptions = ParserOptions<LiquidHtmlNode>;
export type LiquidPrinter = (
  path: AstPath<LiquidHtmlNode>,
  parentGroupId?: symbol,
) => Doc;

export function intersperse<T>(array: T[], delim: T): T[] {
  return array.flatMap((val) => [delim, val]).slice(1);
}

export function getSource(path: LiquidAstPath) {
  return path.getValue().source;
}

export function isEmpty(col: any[]): boolean {
  return col.length === 0;
}

export function isWhitespace(source: string, loc: number): boolean {
  if (loc < 0 || loc >= source.length) return true;
  return !!source[loc].match(/\s/);
}

export const trim = (x: string) => x.trim();
export const trimEnd = (x: string) => x.trimEnd();

export function bodyLines(str: string): string[] {
  return str
    .replace(/^\n*|\s*$/g, '') // only want the meat
    .split(/\r?\n/);
}

export function markupLines<T extends LiquidHtmlNode & { markup: string }>(
  node: T,
): string[] {
  return node.markup.trim().split('\n');
}

export function reindent(lines: string[], skipFirst = false): string[] {
  const minIndentLevel = lines
    .filter((_, i) => (skipFirst ? i > 0 : true))
    .filter((line) => line.trim().length > 0)
    .map((line) => (line.match(/^\s*/) as any)[0].length)
    .reduce((a, b) => Math.min(a, b), Infinity);

  if (minIndentLevel === Infinity) {
    return lines;
  }

  const indentStrip = ' '.repeat(minIndentLevel);
  return lines.map((line) => line.replace(indentStrip, '')).map(trimEnd);
}

export function originallyHadLineBreaks(
  path: LiquidAstPath,
  { locStart, locEnd }: LiquidParserOptions,
): boolean {
  const node = path.getValue();
  return hasLineBreakInRange(node.source, locStart(node), locEnd(node));
}

export function hasLineBreakInRange(
  source: string,
  locStart: number,
  locEnd: number,
): boolean {
  const indexOfNewLine = source.indexOf('\n', locStart);
  return 0 <= indexOfNewLine && indexOfNewLine < locEnd;
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

export function isTrimmingOuterLeft(node: LiquidHtmlNode | undefined): boolean {
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

export function isTrimmingOuterRight(
  node: LiquidHtmlNode | undefined,
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
