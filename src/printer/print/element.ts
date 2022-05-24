'use strict';

import { AstPath, doc, Doc } from 'prettier';
import {
  shouldPreserveContent,
  forceBreakContent,
  hasNoCloseMarker,
} from '~/printer/utils';
import {
  printOpeningTagPrefix,
  printOpeningTag,
  printClosingTagSuffix,
  printClosingTag,
  needsToBorrowPrevClosingTagEndMarker,
  needsToBorrowLastChildClosingTagEndMarker,
  getNodeContent,
} from '~/printer/print/tag';
import { printChildren } from '~/printer/print/children';
import {
  NodeTypes,
  LiquidParserOptions,
  LiquidPrinter,
  HtmlNode,
  HtmlComment,
} from '~/types';

const {
  builders: { breakParent, dedentToRoot, group, indent, line, softline },
} = doc;
const { replaceTextEndOfLine } = doc.utils as any;

export function printElement(
  path: AstPath<Exclude<HtmlNode, HtmlComment>>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
) {
  const node = path.getValue();

  if (hasNoCloseMarker(node)) {
    // TODO, broken for HtmlComment but this code path is not used (so far).
    return [
      group(printOpeningTag(path, options, print)),
      ...printClosingTag(node, options),
      printClosingTagSuffix(node, options),
    ];
  }

  if (
    shouldPreserveContent(node, options) ||
    node.type === NodeTypes.HtmlRawNode
  ) {
    return [
      printOpeningTagPrefix(node, options),
      group(printOpeningTag(path, options, print)),
      ...replaceTextEndOfLine(getNodeContent(node, options)),
      ...printClosingTag(node, options),
      printClosingTagSuffix(node, options),
    ];
  }

  const attrGroupId = Symbol('element-attr-group-id');
  const elementGroupId = Symbol('element-group-id');

  const printTag = (doc: Doc) =>
    group(
      [
        group(printOpeningTag(path, options, print), { id: attrGroupId }),
        doc,
        printClosingTag(node, options),
      ],
      { id: elementGroupId },
    );

  const printLineBeforeChildren = () => {
    if (
      node.firstChild!.hasLeadingWhitespace &&
      node.firstChild!.isLeadingWhitespaceSensitive
    ) {
      return line;
    }

    if (
      node.firstChild!.type === NodeTypes.TextNode &&
      node.isWhitespaceSensitive &&
      node.isIndentationSensitive
    ) {
      return dedentToRoot(softline);
    }
    return softline;
  };

  const printLineAfterChildren = () => {
    const needsToBorrow = node.next
      ? needsToBorrowPrevClosingTagEndMarker(node.next)
      : needsToBorrowLastChildClosingTagEndMarker(node.parentNode!);
    if (needsToBorrow) {
      if (
        node.lastChild!.hasTrailingWhitespace &&
        node.lastChild!.isTrailingWhitespaceSensitive
      ) {
        return ' ';
      }
      return '';
    }
    if (
      node.lastChild!.hasTrailingWhitespace &&
      node.lastChild!.isTrailingWhitespaceSensitive
    ) {
      return line;
    }
    return softline;
  };

  if (node.children.length === 0) {
    return printTag(
      node.hasDanglingWhitespace && node.isDanglingWhitespaceSensitive
        ? line
        : '',
    );
  }

  return printTag([
    forceBreakContent(node) ? breakParent : '',
    indent([
      printLineBeforeChildren(),
      printChildren(path as AstPath<typeof node>, options, print, {
        leadingSpaceGroupId: elementGroupId,
        trailingSpaceGroupId: elementGroupId,
      }),
    ]),
    printLineAfterChildren(),
  ]);
}
