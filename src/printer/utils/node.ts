import { AstPath } from 'prettier';
import {
  HtmlSelfClosingElement,
  LiquidHtmlNode,
  LiquidParserOptions,
  NodeTypes,
  TextNode,
} from '../../types';

// placeholder while I get my shit together
export function isVueCustomBlock(_node: any, _options: any) {
  return false;
}

export function isScriptLikeTag(node: { type: NodeTypes }) {
  return node.type === NodeTypes.HtmlRawNode;
}

export function isPreLikeNode(node: { cssWhitespace: string }) {
  return node.cssWhitespace.startsWith('pre');
}

export function isSelfClosing(
  node: LiquidHtmlNode,
): node is HtmlSelfClosingElement {
  return node.type === NodeTypes.HtmlSelfClosingElement;
}

export function isTextLikeNode(
  node: LiquidHtmlNode | undefined,
): node is TextNode {
  return !!node && node.type === NodeTypes.TextNode;
}

export function hasNonTextChild(node: LiquidHtmlNode) {
  return (
    (node as any).children &&
    (node as any).children.some(
      (child: LiquidHtmlNode) => child.type !== NodeTypes.TextNode,
    )
  );
}

export function shouldPreserveContent(
  node: LiquidHtmlNode,
  _options: LiquidParserOptions,
) {
  // // unterminated node in ie conditional comment
  // // e.g. <!--[if lt IE 9]><html><![endif]-->
  // if (
  //   node.type === "ieConditionalComment" &&
  //   node.lastChild &&
  //   !node.lastChild.isSelfClosing &&
  //   !node.lastChild.endSourceSpan
  // ) {
  //   return true;
  // }

  // // incomplete html in ie conditional comment
  // // e.g. <!--[if lt IE 9]></div><![endif]-->
  // if (node.type === "ieConditionalComment" && !node.complete) {
  //   return true;
  // }

  // TODO: handle non-text children in <pre>
  if (
    isPreLikeNode(node) &&
    (node as any).children &&
    (node as any).children.some((child: any) => !isTextLikeNode(child))
  ) {
    return true;
  }

  return false;
}

export function isPrettierIgnoreNode(node: LiquidHtmlNode | undefined) {
  return (
    node &&
    node.type === NodeTypes.HtmlComment &&
    /^\s*prettier-ignore/m.test(node.body)
  );
}

export function hasPrettierIgnore(node: LiquidHtmlNode) {
  return isPrettierIgnoreNode(node) || isPrettierIgnoreNode(node.prev);
}

export function forceNextEmptyLine(node: LiquidHtmlNode | undefined) {
  if (!node) return false;
  if (!node.next) return false;
  const source = node.source;
  // Current implementation: force next empty line when two consecutive
  // lines exist between nodes.
  let tmp: number;
  tmp = source.indexOf('\n', node.position.end);
  tmp = source.indexOf('\n', tmp);
  return tmp < node.next.position.start;
}

/** firstChild leadingSpaces and lastChild trailingSpaces */
export function forceBreakContent(node: LiquidHtmlNode) {
  return (
    forceBreakChildren(node) ||
    (node.type === NodeTypes.HtmlElement &&
      node.children.length > 0 &&
      typeof node.name === 'string' &&
      (['body', 'script', 'style'].includes(node.name) ||
        node.children.some((child) => hasNonTextChild(child)))) ||
    (node.firstChild &&
      node.firstChild === node.lastChild &&
      node.firstChild.type !== NodeTypes.TextNode &&
      hasLeadingLineBreak(node.firstChild) &&
      (!node.lastChild.isTrailingWhitespaceSensitive ||
        hasTrailingLineBreak(node.lastChild)))
  );
}

/** spaces between children */
export function forceBreakChildren(node: LiquidHtmlNode) {
  return (
    node.type === NodeTypes.HtmlElement &&
    node.children.length > 0 &&
    typeof node.name === 'string' &&
    (['html', 'head', 'ul', 'ol', 'select'].includes(node.name) ||
      (node.cssDisplay.startsWith('table') && node.cssDisplay !== 'table-cell'))
  );
}

export function preferHardlineAsSurroundingSpaces(node: LiquidHtmlNode) {
  switch (node.type) {
    // case 'ieConditionalComment':
    case NodeTypes.HtmlComment:
      return true;
    case NodeTypes.HtmlElement:
      return (
        typeof node.name === 'string' &&
        ['script', 'select'].includes(node.name)
      );
  }

  return false;
}

export function preferHardlineAsLeadingSpaces(node: LiquidHtmlNode) {
  return (
    preferHardlineAsSurroundingSpaces(node) ||
    (node.prev && preferHardlineAsTrailingSpaces(node.prev)) ||
    hasSurroundingLineBreak(node)
  );
}

export function preferHardlineAsTrailingSpaces(node: LiquidHtmlNode) {
  return (
    preferHardlineAsSurroundingSpaces(node) ||
    (node.type === NodeTypes.HtmlElement && node.name === 'br') ||
    hasSurroundingLineBreak(node)
  );
}

function hasSurroundingLineBreak(node: LiquidHtmlNode) {
  return hasLeadingLineBreak(node) && hasTrailingLineBreak(node);
}

function hasLeadingLineBreak(node: LiquidHtmlNode) {
  if (node.type === NodeTypes.Document) return false;

  return (
    node.hasLeadingWhitespace &&
    hasLineBreakInRange(
      node.source,
      node.prev
        ? node.prev.position.end
        : (node.parentNode as any).blockStartPosition
        ? (node.parentNode as any).blockStartPosition.end
        : (node.parentNode as any).position.start,
      node.position.start,
    )
  );
}

function hasTrailingLineBreak(node: LiquidHtmlNode) {
  if (node.type === NodeTypes.Document) return false;
  return (
    node.hasTrailingWhitespace &&
    hasLineBreakInRange(
      node.source,
      node.position.end,
      node.next
        ? node.next.position.start
        : (node.parentNode as any).blockEndPosition
        ? (node.parentNode as any).blockEndPosition.start
        : (node.parentNode as any).position.end,
    )
  );
}

function hasLineBreakInRange(source: string, start: number, end: number) {
  return source.indexOf('\n', start) < end;
}

export function getLastDescendant(node: LiquidHtmlNode): LiquidHtmlNode {
  return node.lastChild ? getLastDescendant(node.lastChild) : node;
}

export function countParents(
  path: AstPath<LiquidHtmlNode>,
  predicate: (x: any) => boolean,
) {
  let counter = 0;
  for (let i = path.stack.length - 1; i >= 0; i--) {
    const value = path.stack[i];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      predicate(value)
    ) {
      counter++;
    }
  }
  return counter;
}
