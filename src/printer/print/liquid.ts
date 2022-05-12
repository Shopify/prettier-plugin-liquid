import { AstPath, Doc, doc } from 'prettier';
import {
  LiquidHtmlNode,
  LiquidTag,
  LiquidBranch,
  LiquidDrop,
  LiquidAstPath,
  LiquidParserOptions,
  LiquidPrinter,
  NodeTypes,
  LiquidPrinterArgs,
} from '~/types';
import { isBranchedTag } from '~/parser/ast';
import { assertNever } from '~/utils';

import {
  getSource,
  getWhitespaceTrim,
  isDeeplyNested,
  isEmpty,
  isWhitespace,
  markupLines,
  originallyHadLineBreaks,
  reindent,
  trim,
} from '~/printer/utils';
import { printChildren } from '~/printer/print/children';

const LIQUID_TAGS_THAT_ALWAYS_BREAK = ['for', 'case'];

const { builders } = doc;
const { dedentToRoot, group, hardline, ifBreak, indent, join, line, softline } =
  builders;

export function printLiquidDrop(
  path: LiquidAstPath,
  _options: LiquidParserOptions,
  _print: LiquidPrinter,
  { leadingSpaceGroupId, trailingSpaceGroupId }: LiquidPrinterArgs,
) {
  const node: LiquidDrop = path.getValue() as LiquidDrop;
  const whitespaceStart = getWhitespaceTrim(
    node.whitespaceStart,
    node.isLeadingWhitespaceSensitive && !node.hasLeadingWhitespace,
    leadingSpaceGroupId,
  );
  const whitespaceEnd = getWhitespaceTrim(
    node.whitespaceEnd,
    node.isTrailingWhitespaceSensitive && !node.hasTrailingWhitespace,
    trailingSpaceGroupId,
  );

  // This should probably be better than this but it'll do for now.
  const lines = markupLines(node);
  if (lines.length > 1) {
    return group([
      '{{',
      whitespaceStart,
      indent([hardline, join(hardline, lines.map(trim))]),
      hardline,
      whitespaceEnd,
      '}}',
    ]);
  }

  return group([
    '{{',
    whitespaceStart,
    ' ',
    node.markup.trim(),
    ' ',
    whitespaceEnd,
    '}}',
  ]);
}

export function printLiquidBlockStart(
  path: AstPath<LiquidTag | LiquidBranch>,
  leadingSpaceGroupId: symbol | symbol[] | undefined,
  trailingSpaceGroupId: symbol | symbol[] | undefined,
): Doc {
  const node = path.getValue();
  if (!node.name) return '';

  const lines = markupLines(node);

  const whitespaceStart = getWhitespaceTrim(
    node.whitespaceStart,
    needsBlockStartLeadingWhitespaceStrippingOnBreak(node),
    leadingSpaceGroupId,
  );
  const whitespaceEnd = getWhitespaceTrim(
    node.whitespaceEnd,
    needsBlockStartTrailingWhitespaceStrippingOnBreak(node),
    trailingSpaceGroupId,
  );

  if (node.name === 'liquid') {
    return group([
      '{%',
      whitespaceStart,
      ' ',
      node.name,
      indent([hardline, join(hardline, reindent(lines, true))]),
      hardline,
      whitespaceEnd,
      '%}',
    ]);
  }

  if (lines.length > 1) {
    return group([
      '{%',
      whitespaceStart,
      indent([hardline, node.name, ' ', join(hardline, lines.map(trim))]),
      hardline,
      whitespaceEnd,
      '%}',
    ]);
  }

  const markup = node.markup.trim();
  return group([
    '{%',
    whitespaceStart,
    ' ',
    node.name,
    markup ? ` ${markup}` : '',
    ' ',
    whitespaceEnd,
    '%}',
  ]);
}

export function printLiquidBlockEnd(
  path: AstPath<LiquidTag>,
  leadingSpaceGroupId: symbol | symbol[] | undefined,
  trailingSpaceGroupId: symbol | symbol[] | undefined,
): Doc {
  const node = path.getValue();
  if (!node.children || !node.blockEndPosition) return '';
  const whitespaceStart = getWhitespaceTrim(
    node.delimiterWhitespaceStart ?? '',
    needsBlockEndLeadingWhitespaceStrippingOnBreak(node),
    leadingSpaceGroupId,
  );
  const whitespaceEnd = getWhitespaceTrim(
    node.delimiterWhitespaceEnd ?? '',
    node.isTrailingWhitespaceSensitive,
    trailingSpaceGroupId,
  );
  return group([
    '{%',
    whitespaceStart,
    ` end${node.name} `,
    whitespaceEnd,
    '%}',
  ]);
}

export function printLiquidTag(
  path: AstPath<LiquidTag>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  { leadingSpaceGroupId, trailingSpaceGroupId }: LiquidPrinterArgs = {},
): Doc {
  const node = path.getValue();
  if (!node.children) {
    return printLiquidBlockStart(
      path,
      leadingSpaceGroupId,
      trailingSpaceGroupId,
    );
  }
  const tagGroupId = Symbol('tag-group');
  const blockStart = printLiquidBlockStart(
    path,
    leadingSpaceGroupId,
    tagGroupId,
  ); // {% if ... %}
  const blockEnd = printLiquidBlockEnd(path, tagGroupId, trailingSpaceGroupId); // {% endif %}

  let body: Doc = [];
  let trailingWhitespace: Doc[] = [];
  if (node.blockEndPosition) {
    trailingWhitespace.push(innerTrailingWhitespace(node));
  }

  if (isBranchedTag(node)) {
    body = cleanDoc(
      path.map(
        (p) =>
          print(p, {
            leadingSpaceGroupId: tagGroupId,
            trailingSpaceGroupId: tagGroupId,
          }),
        'children',
      ),
    );
    if (node.name === 'case') body = indent(body);
  } else if (node.children.length > 0) {
    body = indent([
      innerLeadingWhitespace(node),
      printChildren(path, options, print, {
        leadingSpaceGroupId: tagGroupId,
        trailingSpaceGroupId: tagGroupId,
      }),
    ]);
  }

  return group([blockStart, body, ...trailingWhitespace, blockEnd], {
    id: tagGroupId,
    shouldBreak:
      LIQUID_TAGS_THAT_ALWAYS_BREAK.includes(node.name) ||
      originallyHadLineBreaks(path, options) ||
      isDeeplyNested(node),
  });
}

function innerLeadingWhitespace(node: LiquidTag | LiquidBranch) {
  if (!node.firstChild) {
    if (node.isDanglingWhitespaceSensitive && node.hasDanglingWhitespace) {
      return line;
    } else {
      return '';
    }
  }

  if (
    node.firstChild.hasLeadingWhitespace &&
    node.firstChild.isLeadingWhitespaceSensitive
  ) {
    return line;
  }
  if (
    node.firstChild.type === NodeTypes.TextNode &&
    node.isWhitespaceSensitive &&
    node.isIndentationSensitive
  ) {
    return dedentToRoot(softline);
  }

  return softline;
}

function innerTrailingWhitespace(node: LiquidTag | LiquidBranch) {
  if (node.type === NodeTypes.LiquidBranch || !node.blockEndPosition) return '';
  if (
    node.lastChild!.hasTrailingWhitespace &&
    node.lastChild!.isTrailingWhitespaceSensitive
  ) {
    return line;
  }
  return softline;
}

function printLiquidDefaultBranch(
  path: AstPath<LiquidBranch>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  args: LiquidPrinterArgs,
): Doc {
  const branch = path.getValue();
  const parentNode: LiquidTag = path.getParentNode() as any;
  const source = getSource(path);

  // When the node is empty and the parent is empty. The space will come
  // from the trailingWhitespace of the parent. When this happens, we don't
  // want the branch to print another one so we collapse it.
  // e.g. {% if A %} {% endif %}
  const shouldCollapseSpace =
    isEmpty(branch.children) && parentNode.children!.length === 1;
  if (shouldCollapseSpace) return '';

  // When the branch is empty and doesn't have whitespace, we don't want
  // anything so print nothing.
  // e.g. {% if A %}{% endif %}
  // e.g. {% if A %}{% else %}...{% endif %}
  const isBranchEmptyWithoutSpace =
    isEmpty(branch.children) &&
    !isWhitespace(source, parentNode.blockStartPosition.end);
  if (isBranchEmptyWithoutSpace) return '';

  // If the branch does not break, is empty and had whitespace, we might
  // want a space in there. We don't collapse those because the trailing
  // whitespace does not come from the parent.
  // {% if A %} {% else %}...{% endif %}
  if (isEmpty(branch.children)) {
    return ifBreak('', ' ');
  }

  // Otherwise print the branch as usual
  // {% if A %} content...{% endif %}
  return indent([
    innerLeadingWhitespace(parentNode),
    printChildren(path, options, print, args),
  ]);
}

export function printLiquidBranch(
  path: AstPath<LiquidBranch>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  args: LiquidPrinterArgs,
): Doc {
  const branch = path.getValue();
  const isDefaultBranch = !branch.name;

  if (isDefaultBranch) {
    return printLiquidDefaultBranch(path, options, print, args);
  }

  const leftSibling = branch.prev as LiquidBranch | undefined;

  // When the left sibling is empty, its trailing whitespace is its leading
  // whitespace. So we should collapse it here and ignore it.
  const shouldCollapseSpace = leftSibling && isEmpty(leftSibling.children);
  const hasWhitespaceToTheLeft = isWhitespace(
    branch.source,
    branch.blockStartPosition.start - 1,
  );
  const outerLeadingWhitespace =
    hasWhitespaceToTheLeft && !shouldCollapseSpace ? line : softline;

  return [
    outerLeadingWhitespace,
    printLiquidBlockStart(
      path as AstPath<LiquidBranch>,
      args.leadingSpaceGroupId, // TODO
      args.trailingSpaceGroupId, // TODO
    ),
    indent([
      innerLeadingWhitespace(branch),
      printChildren(path, options, print, args),
    ]),
  ];
}

function isExtremelyLeadingWhitespaceSensitive(node: LiquidHtmlNode): boolean {
  return node.isLeadingWhitespaceSensitive && !node.hasLeadingWhitespace;
}

function isExtremelyTrailingWhitespaceSensitive(node: LiquidHtmlNode): boolean {
  return node.isTrailingWhitespaceSensitive && !node.hasTrailingWhitespace;
}

function isExtremelyDanglingSpaceSensitive(node: LiquidHtmlNode): boolean {
  return node.isDanglingWhitespaceSensitive && !node.hasDanglingWhitespace;
}

function needsBlockStartLeadingWhitespaceStrippingOnBreak(
  node: LiquidTag | LiquidBranch,
): boolean {
  switch (node.type) {
    case NodeTypes.LiquidTag: {
      return isExtremelyLeadingWhitespaceSensitive(node);
    }
    case NodeTypes.LiquidBranch: {
      return isExtremelyLeadingWhitespaceSensitive(node);
    }
    default: {
      return assertNever(node);
    }
  }
}

function needsBlockStartTrailingWhitespaceStrippingOnBreak(
  node: LiquidTag | LiquidBranch,
): boolean {
  switch (node.type) {
    case NodeTypes.LiquidTag: {
      if (isBranchedTag(node)) {
        return needsBlockStartLeadingWhitespaceStrippingOnBreak(
          node.firstChild! as LiquidBranch,
        );
      }

      if (!node.children) {
        return isExtremelyTrailingWhitespaceSensitive(node);
      }

      return isEmpty(node.children)
        ? isExtremelyDanglingSpaceSensitive(node)
        : isExtremelyLeadingWhitespaceSensitive(node.firstChild!);
    }

    case NodeTypes.LiquidBranch: {
      return node.firstChild
        ? isExtremelyLeadingWhitespaceSensitive(node.firstChild)
        : isExtremelyDanglingSpaceSensitive(node);
    }

    default: {
      return assertNever(node);
    }
  }
}

function needsBlockEndLeadingWhitespaceStrippingOnBreak(node: LiquidTag) {
  if (!node.children) {
    throw new Error(
      'Should only call needsBlockEndLeadingWhitespaceStrippingOnBreak for tags that have closing tags',
    );
  } else if (isBranchedTag(node)) {
    return isExtremelyTrailingWhitespaceSensitive(node.lastChild!);
  } else if (isEmpty(node.children)) {
    return isExtremelyDanglingSpaceSensitive(node);
  } else {
    return isExtremelyTrailingWhitespaceSensitive(node.lastChild!);
  }
}

function cleanDoc(doc: Doc[]): Doc[] {
  return doc.filter((x) => x !== '');
}