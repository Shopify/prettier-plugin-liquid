'use strict';

import { AstPath, doc, Doc } from 'prettier';
import {
  shouldPreserveContent,
  countParents,
  forceBreakContent,
  isLiquidNode,
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
  LiquidHtmlNode,
  HtmlElement,
} from '~/types';

const {
  builders: {
    breakParent,
    dedentToRoot,
    group,
    ifBreak,
    indentIfBreak,
    indent,
    line,
    softline,
  },
} = doc;
const { replaceTextEndOfLine } = doc.utils as any;

export function printElement(
  path: AstPath<HtmlElement>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
) {
  const node = path.getValue();

  if (shouldPreserveContent(node, options)) {
    return [
      printOpeningTagPrefix(node, options),
      group(printOpeningTag(path, options, print)),
      ...replaceTextEndOfLine(getNodeContent(node, options)),
      ...printClosingTag(node, options),
      printClosingTagSuffix(node, options),
    ];
  }

  /**
   * do not break:
   *
   *     <div>{{
   *         ~
   *       interpolation
   *     }}</div>
   *            ~
   *
   * exception: break if the opening tag breaks
   *
   *     <div
   *       long
   *           ~
   *       >{{
   *         interpolation
   *       }}</div
   *              ~
   *     >
   */
  const shouldHugContent =
    node.children.length === 1 &&
    // node.firstChild.type === 'interpolation' &&
    !isLiquidNode(node.firstChild!) &&
    node.firstChild!.isLeadingWhitespaceSensitive &&
    !node.firstChild!.hasLeadingWhitespace &&
    node.lastChild!.isTrailingWhitespaceSensitive &&
    !node.lastChild!.hasTrailingWhitespace;

  const attrGroupId = Symbol('element-attr-group-id');

  const printTag = (doc: Doc) =>
    group([
      group(printOpeningTag(path, options, print), { id: attrGroupId }),
      doc,
      printClosingTag(node, options),
    ]);

  const printChildrenDoc = (childrenDoc: Doc) => {
    if (shouldHugContent) {
      return indentIfBreak(childrenDoc, { groupId: attrGroupId });
    }
    // if (
    //   (isScriptLikeTag(node) || isVueCustomBlock(node, options)) &&
    //   node.parentNode.type === NodeTypes.Document &&
    //   options.parser === 'vue' &&
    //   !options.vueIndentScriptAndStyle
    // ) {
    //   return childrenDoc;
    // }
    return indent(childrenDoc);
  };

  const printLineBeforeChildren = () => {
    if (shouldHugContent) {
      return ifBreak(softline, '', { groupId: attrGroupId });
    }
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
    if (shouldHugContent) {
      return ifBreak(softline, '', { groupId: attrGroupId });
    }
    if (
      node.lastChild!.hasTrailingWhitespace &&
      node.lastChild!.isTrailingWhitespaceSensitive
    ) {
      return line;
    }
    const lastChild = node.lastChild!;
    if (
      (lastChild!.type === NodeTypes.HtmlComment &&
        endsInProperlyIndentedEmptyLine(path, lastChild.body, options)) ||
      (lastChild!.type === NodeTypes.TextNode &&
        node.isWhitespaceSensitive &&
        node.isIndentationSensitive &&
        endsInProperlyIndentedEmptyLine(path, lastChild.value, options))
    ) {
      return '';
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
    printChildrenDoc([
      printLineBeforeChildren(),
      printChildren(path, options, print),
    ]),
    printLineAfterChildren(),
  ]);
}

// TODO: Not sure the name is correct, this is code we got from prettier and I'm
// not 100% sure why we need it.
function endsInProperlyIndentedEmptyLine(
  path: AstPath<any>,
  value: string,
  options: LiquidParserOptions,
) {
  return new RegExp(
    `\\n[\\t ]{${
      options.tabWidth *
      countParents(
        path,
        (node: LiquidHtmlNode) =>
          !!node.parentNode && node.parentNode.type !== NodeTypes.Document,
      )
    }}$`,
  ).test(value);
}
