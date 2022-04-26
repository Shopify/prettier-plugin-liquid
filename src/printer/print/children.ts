import { AstPath, doc } from 'prettier';
import { locStart, locEnd } from '~/utils';
import {
  NodeTypes,
  LiquidHtmlNode,
  LiquidAstPath,
  LiquidParserOptions,
  LiquidPrinter,
} from '~/types';
import {
  forceBreakChildren,
  forceNextEmptyLine,
  hasPrettierIgnore,
  isTextLikeNode,
  preferHardlineAsLeadingSpaces,
  isSelfClosing,
} from '~/printer/utils';
import {
  needsToBorrowNextOpeningTagStartMarker,
  needsToBorrowParentClosingTagStartMarker,
  needsToBorrowPrevClosingTagEndMarker,
  printClosingTagEndMarker,
  printClosingTagSuffix,
  printOpeningTagPrefix,
  printOpeningTagStartMarker,
} from '~/printer/print/tag';

const {
  builders: { breakParent, group, ifBreak, line, softline, hardline },
} = doc;
const { replaceTextEndOfLine } = doc.utils as any;

function printChild(
  childPath: LiquidAstPath,
  options: LiquidParserOptions,
  print: LiquidPrinter,
) {
  const child = childPath.getValue();

  if (hasPrettierIgnore(child)) {
    return [
      printOpeningTagPrefix(child, options),
      ...replaceTextEndOfLine(
        options.originalText.slice(
          locStart(child) +
            (child.prev && needsToBorrowNextOpeningTagStartMarker(child.prev)
              ? printOpeningTagStartMarker(child).length
              : 0),
          locEnd(child) -
            (child.next && needsToBorrowPrevClosingTagEndMarker(child.next)
              ? printClosingTagEndMarker(child, options).length
              : 0),
        ),
      ),
      printClosingTagSuffix(child, options),
    ];
  }

  return print(childPath);
}

function printBetweenLine(prevNode: LiquidHtmlNode, nextNode: LiquidHtmlNode) {
  // space between text-like nodes
  if (isTextLikeNode(prevNode) && isTextLikeNode(nextNode)) {
    if (prevNode.isTrailingWhitespaceSensitive) {
      return prevNode.hasTrailingWhitespace
        ? preferHardlineAsLeadingSpaces(nextNode)
          ? hardline
          : line
        : '';
    }

    return preferHardlineAsLeadingSpaces(nextNode) ? hardline : softline;
  }

  const spaceBetweenLinesIsHandledSomewhereElse =
    (needsToBorrowNextOpeningTagStartMarker(prevNode) &&
      (hasPrettierIgnore(nextNode) ||
        /**
         *     123<a
         *          ~
         *       ><b>
         */
        nextNode.firstChild ||
        /**
         *     123<!--
         *            ~
         *     -->
         */
        isSelfClosing(nextNode) ||
        /**
         *     123<span
         *             ~
         *       attr
         */
        (nextNode.type === NodeTypes.HtmlElement &&
          nextNode.attributes.length > 0))) ||
    /**
     *     <img
     *       src="long"
     *                 ~
     *     />123
     */
    (prevNode.type === NodeTypes.HtmlElement &&
      isSelfClosing(prevNode) &&
      needsToBorrowPrevClosingTagEndMarker(nextNode));

  if (spaceBetweenLinesIsHandledSomewhereElse) {
    return '';
  }

  const shouldUseHardline =
    !nextNode.isLeadingWhitespaceSensitive ||
    preferHardlineAsLeadingSpaces(nextNode) ||
    /**
     *       Want to write us a letter? Use our<a
     *         ><b><a>mailing address</a></b></a
     *                                          ~
     *       >.
     */
    (needsToBorrowPrevClosingTagEndMarker(nextNode) &&
      prevNode.lastChild &&
      needsToBorrowParentClosingTagStartMarker(prevNode.lastChild) &&
      prevNode.lastChild.lastChild &&
      needsToBorrowParentClosingTagStartMarker(prevNode.lastChild.lastChild));

  if (shouldUseHardline) {
    return hardline;
  }

  return nextNode.hasLeadingWhitespace ? line : softline;
}

export type HasChildren = Extract<
  LiquidHtmlNode,
  { children?: LiquidHtmlNode[] }
>;

// This code is adapted from prettier's language-html plugin.
export function printChildren(
  path: AstPath<HasChildren>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
) {
  const node = path.getValue();

  if (!node.children) {
    throw new Error(
      'attempting to use printChildren on something without children',
    );
  }

  if (forceBreakChildren(node)) {
    return [
      breakParent,

      ...path.map((childPath) => {
        const childNode = childPath.getValue();
        const prevBetweenLine = !childNode.prev
          ? ''
          : printBetweenLine(childNode.prev, childNode);
        return [
          !prevBetweenLine
            ? ''
            : [
                prevBetweenLine,
                forceNextEmptyLine(childNode.prev) ? hardline : '',
              ],
          printChild(childPath, options, print),
        ];
      }, 'children'),
    ];
  }

  const groupIds = node.children.map(() => Symbol(''));
  return path.map((childPath: AstPath<LiquidHtmlNode>, childIndex: number) => {
    const childNode = childPath.getValue();

    if (isTextLikeNode(childNode)) {
      if (childNode.prev && isTextLikeNode(childNode.prev)) {
        const prevBetweenLine = printBetweenLine(childNode.prev, childNode);
        if (prevBetweenLine) {
          if (forceNextEmptyLine(childNode.prev)) {
            return [hardline, hardline, printChild(childPath, options, print)];
          }
          return [prevBetweenLine, printChild(childPath, options, print)];
        }
      }
      return printChild(childPath, options, print);
    }

    const leadingHardlines = [];
    const leadingParts = [];
    const trailingParts = [];
    const trailingHardlines = [];

    const prevBetweenLine = childNode.prev
      ? printBetweenLine(childNode.prev, childNode)
      : '';

    const nextBetweenLine = childNode.next
      ? printBetweenLine(childNode, childNode.next)
      : '';

    if (prevBetweenLine) {
      if (forceNextEmptyLine(childNode.prev)) {
        leadingHardlines.push(hardline, hardline);
      } else if (prevBetweenLine === hardline) {
        leadingHardlines.push(hardline);
      } else {
        if (isTextLikeNode(childNode.prev)) {
          leadingParts.push(prevBetweenLine);
        } else {
          leadingParts.push(
            ifBreak('', softline, {
              groupId: groupIds[childIndex - 1],
            }),
          );
        }
      }
    }

    if (nextBetweenLine) {
      if (forceNextEmptyLine(childNode)) {
        if (isTextLikeNode(childNode.next)) {
          trailingHardlines.push(hardline, hardline);
        }
      } else if (nextBetweenLine === hardline) {
        if (isTextLikeNode(childNode.next)) {
          trailingHardlines.push(hardline);
        }
      } else {
        trailingParts.push(nextBetweenLine);
      }
    }

    // This double group spread here mimics how `fill` works but without
    // using `fill` because we might want a mix of `fill` between words
    // and nodes that are inline nodes and forced linebreaks between nodes.
    //
    // What does this mean? Well prettier's `fill` builder methods allows
    // you to print "paragraphs" and so when something reaches the end of
    // the line and it would be too long for the line, `fill` will break
    // the previous linebreak.
    //
    // If the thing that goes on the next line ALSO is too long for that
    // line, then it will break _that_ and the next line.
    //
    // Here's an example:
    // fill(['hello', line, 'world', line, 'yoooooooooo', line, '!!!'])
    //      printWidth-------|
    //   => hello world
    //      yooooooooooooo !!!
    //
    // Here's another where the element would also break
    // fill([
    //  'hello',
    //  line,
    //  group([
    //    '<div>',
    //    line,
    //    'world',
    //    line,
    //    '</div>'
    //  ],
    //  line,
    //  '!!!'
    // ])
    //     printWidth --|
    //  => hello
    //     <div>
    //       world
    //     </div>
    //     !!!
    //
    // As you can see, the !!! appears on a new line in the fill because
    // the div group broke parent.
    //
    // So, here's what all the variables are for:
    //  - leadingHardlines are for hardlines that do not affect the flow
    //  - leadingParts are for maybe line breaks before the child
    //    - it will break _first_ if the child doesn't fit the line
    //  - trailingParts are for maybe line breaks after the child
    //    - it will break _second_ if the child itself doesn't fit
    //  - trailingHardlines for hardlines that do not affect the flow
    return [
      ...leadingHardlines,
      group([
        ...leadingParts,
        group([printChild(childPath, options, print), ...trailingParts], {
          id: groupIds[childIndex],
        }),
      ]),
      ...trailingHardlines,
    ];
  }, 'children');
}
