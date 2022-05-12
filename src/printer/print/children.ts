import { AstPath, doc } from 'prettier';
import { locStart, locEnd } from '~/utils';
import {
  NodeTypes,
  LiquidHtmlNode,
  LiquidAstPath,
  LiquidParserOptions,
  LiquidPrinter,
  LiquidPrinterArgs,
} from '~/types';
import {
  FORCE_BREAK_GROUP_ID,
  FORCE_FLAT_GROUP_ID,
  forceBreakChildren,
  forceNextEmptyLine,
  hasPrettierIgnore,
  isEmpty,
  isLiquidNode,
  isSelfClosing,
  isTextLikeNode,
  preferHardlineAsLeadingSpaces,
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
  args: LiquidPrinterArgs,
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

  return print(childPath, args);
}

function printBetweenLine(prevNode: LiquidHtmlNode, nextNode: LiquidHtmlNode) {
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

type Softline =
  | doc.builders.Line
  | doc.builders.Softline
  | doc.builders.IfBreak;

interface WhitespaceBetweenNode {
  leadingHardlines: typeof hardline[];
  leadingSoftlines: Softline[];
  leadingGroupedSoftlines: doc.builders.Softline[];
  trailingSoftlines: Softline[];
  trailingHardlines: typeof hardline[];
}

// This code is adapted from prettier's language-html plugin.
export function printChildren(
  path: AstPath<HasChildren>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  args: LiquidPrinterArgs,
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
          printChild(childPath, options, print, {
            leadingSpaceGroupId: FORCE_BREAK_GROUP_ID,
            trailingSpaceGroupId: FORCE_BREAK_GROUP_ID,
          }),
        ];
      }, 'children'),
    ];
  }

  const leadingSpaceGroupIds = node.children.map((_, i) =>
    Symbol(`leading-${i}`),
  );
  const trailingSpaceGroupIds = node.children.map((_, i) =>
    Symbol(`trailing-${i}`),
  );

  // This is kind of complicated.
  //
  // Most of this code is whitespace handling. It's an adapted version of
  // prettier/prettier which doesn't entirely suit our usecase. Mainly
  // because all our liquid nodes need to know if the surrounding
  // whitespace breaks in order to _maybe_ convert the leading/trailing
  // whitespace stripping characters into '-' when the following conditions
  // are true:
  //   - whitespace breaks
  //   - there was no whitespace in input
  //   - node is whitespace sensitive
  //
  // We do that by passing the {leading,trailing}SpaceGroupId to the print method.
  //
  // In order to mimic both fill and join(hardline, path.map(children, print)) this
  // method would output something like this for an array of four children [a, b, c, d]:
  // [
  //   [
  //     maybeHardline_a_leading,
  //     group_leading([
  //       maybeSoftline_a_leading,
  //       group_trailing([
  //         printChild(a),
  //         maybeSofline_a_trailing,
  //       ]),
  //     ]),
  //     maybeHardline_a_trailing,
  //   ],
  //   ...
  //   [
  //     maybeHardline_d_leading,
  //     group_leading([
  //       maybeSoftline_d_leading,
  //       group_trailing([
  //         printChild(d),
  //         maybeSofline_d_trailing,
  //       ]),
  //     ]),
  //     maybeHardline_d_trailing,
  //   ],
  // ]
  //
  // So, you see, the _actual_ leading or trailing whitespace of a node is
  // actually four "maybe" nodes that collapse into one (there's only ever
  // one).
  //
  // e.g.
  //
  // the leading whitespace of node b is the following:
  // [
  //   maybeSoftline_a_trailing,
  //   maybeHardline_a_trailing,
  //   maybeHardline_b_leading,
  //   maybeSoftline_b_leading,
  // ]
  //
  // In order to have the correct {leading,trailing}SpaceGroupId for the
  // print method, we first map all the nodes into four arrays:
  // {
  //   leadingHardlines,
  //   leadingSoftlines,
  //   trailingSoftlines,
  //   trailingHardlines,
  // }
  //
  // And then figure out which one of those array isn't empty to finally
  // map that to the correct groupId.
  const whitespaceBetweenNode = path.map(
    (
      childPath: AstPath<LiquidHtmlNode>,
      childIndex: number,
    ): WhitespaceBetweenNode => {
      const childNode = childPath.getValue();

      const leadingHardlines: typeof hardline[] = [];
      const leadingSoftlines: Softline[] = [];
      const leadingGroupedSoftlines: doc.builders.Softline[] = [];
      const trailingSoftlines: Softline[] = [];
      const trailingHardlines: typeof hardline[] = [];

      const prevBetweenLine = childNode.prev
        ? printBetweenLine(childNode.prev, childNode)
        : '';

      const nextBetweenLine = childNode.next
        ? printBetweenLine(childNode, childNode.next)
        : '';

      if (isTextLikeNode(childNode)) {
        return {
          leadingHardlines,
          leadingSoftlines,
          leadingGroupedSoftlines,
          trailingSoftlines,
          trailingHardlines,
        };
      }

      // Never took the time to understand this. And I think now it's biting
      // me in the ass? Why? What are you trying to accomplish? Not sure. I'm
      // lost.
      if (prevBetweenLine) {
        if (forceNextEmptyLine(childNode.prev)) {
          leadingHardlines.push(hardline, hardline);
        } else if (prevBetweenLine === hardline) {
          leadingHardlines.push(hardline);
        } else {
          if (isTextLikeNode(childNode.prev)) {
            if (isLiquidNode(childNode) && prevBetweenLine === softline) {
              leadingGroupedSoftlines.push(prevBetweenLine as typeof softline);
            } else {
              leadingSoftlines.push(prevBetweenLine as doc.builders.Line);
            }
          } else {
            leadingSoftlines.push(
              ifBreak('', softline, {
                groupId: trailingSpaceGroupIds[childIndex - 1],
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
          // there's a hole here!
        } else {
          // We know it's not a typeof hardline here because we do the
          // check on the previous condition.
          trailingSoftlines.push(nextBetweenLine as doc.builders.Line);
        }
      }

      return {
        leadingHardlines,
        leadingSoftlines,
        leadingGroupedSoftlines,
        trailingSoftlines,
        trailingHardlines,
      } as WhitespaceBetweenNode;
    },
    'children',
  );

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
  //  - leadingSoftlines are for maybe line breaks before the child
  //    - it will break _first_ if the child doesn't fit the line
  //  - leadingGroupedSoftlines are for softlines that should break with the trailing line (e.g. a group)
  //    - happens for liquid surrounded by text
  //  - trailingSoftlines are for maybe line breaks after the child
  //    - it will break _second_ if the child itself doesn't fit
  //  - trailingHardlines for hardlines that do not affect the flow
  return path.map((childPath, childIndex) => {
    const {
      leadingHardlines,
      leadingSoftlines,
      leadingGroupedSoftlines,
      trailingSoftlines,
      trailingHardlines,
    } = whitespaceBetweenNode[childIndex];
    // What are the actual possibities? a lot actually...
    return [
      ...leadingHardlines,
      group(
        [
          ...leadingSoftlines,
          group(
            [
              ...leadingGroupedSoftlines,
              printChild(childPath, options, print, {
                leadingSpaceGroupId: leadingSpaceGroupId(
                  whitespaceBetweenNode,
                  childIndex,
                ),
                trailingSpaceGroupId: trailingSpaceGroupId(
                  whitespaceBetweenNode,
                  childIndex,
                ),
              }),
              ...trailingSoftlines,
            ],
            {
              id: trailingSpaceGroupIds[childIndex],
            },
          ),
        ],
        {
          id: leadingSpaceGroupIds[childIndex],
        },
      ),
      ...trailingHardlines,
    ];
  }, 'children');

  function leadingSpaceGroupId(
    whitespaceBetweenNode: WhitespaceBetweenNode[],
    index: number,
  ): symbol[] | symbol | undefined {
    if (index === 0) {
      return args.leadingSpaceGroupId;
    }

    const prev = whitespaceBetweenNode[index - 1];
    const curr = whitespaceBetweenNode[index];
    const groupIds = [];

    if (!isEmpty(prev.trailingHardlines) || !isEmpty(curr.leadingHardlines)) {
      return FORCE_BREAK_GROUP_ID;
    }

    if (!isEmpty(prev.trailingSoftlines)) {
      groupIds.push(trailingSpaceGroupIds[index - 1]);
    }

    if (!isEmpty(curr.leadingSoftlines)) {
      groupIds.push(leadingSpaceGroupIds[index]);
    }

    if (!isEmpty(curr.leadingGroupedSoftlines)) {
      groupIds.push(trailingSpaceGroupIds[index]);
    }

    if (isEmpty(groupIds)) {
      groupIds.push(FORCE_FLAT_GROUP_ID);
    }

    return groupIds;
  }

  function trailingSpaceGroupId(
    whitespaceBetweenNode: WhitespaceBetweenNode[],
    index: number,
  ) {
    if (index === whitespaceBetweenNode.length - 1) {
      return args.trailingSpaceGroupId;
    }

    const curr = whitespaceBetweenNode[index];
    const next = whitespaceBetweenNode[index + 1];
    const groupIds = [];

    if (!isEmpty(curr.trailingHardlines) || !isEmpty(next.leadingHardlines)) {
      return FORCE_BREAK_GROUP_ID;
    }

    if (!isEmpty(curr.trailingSoftlines)) {
      groupIds.push(trailingSpaceGroupIds[index]);
    }

    if (!isEmpty(next.leadingSoftlines)) {
      groupIds.push(leadingSpaceGroupIds[index + 1]);
    }

    if (isEmpty(groupIds)) {
      groupIds.push(FORCE_FLAT_GROUP_ID);
    }

    return groupIds;
  }
}
