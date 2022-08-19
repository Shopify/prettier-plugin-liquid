import { AstPath, Doc, doc } from 'prettier';
import {
  LiquidAstPath,
  LiquidBranch,
  LiquidDrop,
  LiquidParserOptions,
  LiquidPrinter,
  LiquidPrinterArgs,
  LiquidTag,
  LiquidTagNamed,
  LiquidBranchNamed,
  NamedTags,
  NodeTypes,
} from '~/types';
import { isBranchedTag } from '~/parser/ast';
import { assertNever } from '~/utils';

import {
  getWhitespaceTrim,
  hasMeaningfulLackOfLeadingWhitespace,
  hasMeaningfulLackOfTrailingWhitespace,
  hasMeaningfulLackOfDanglingWhitespace,
  isDeeplyNested,
  isEmpty,
  isHtmlNode,
  markupLines,
  originallyHadLineBreaks,
  reindent,
  trim,
} from '~/printer/utils';

import { printChildren } from '~/printer/print/children';

const LIQUID_TAGS_THAT_ALWAYS_BREAK = ['for', 'case'];

const { builders } = doc;
const { group, hardline, ifBreak, indent, join, line, softline } = builders;

export function printLiquidDrop(
  path: LiquidAstPath,
  _options: LiquidParserOptions,
  print: LiquidPrinter,
  { leadingSpaceGroupId, trailingSpaceGroupId }: LiquidPrinterArgs,
) {
  const node: LiquidDrop = path.getValue() as LiquidDrop;
  const whitespaceStart = getWhitespaceTrim(
    node.whitespaceStart,
    hasMeaningfulLackOfLeadingWhitespace(node),
    leadingSpaceGroupId,
  );
  const whitespaceEnd = getWhitespaceTrim(
    node.whitespaceEnd,
    hasMeaningfulLackOfTrailingWhitespace(node),
    trailingSpaceGroupId,
  );

  if (typeof node.markup !== 'string') {
    const whitespace = node.markup.filters.length > 0 ? line : ' ';
    return group([
      '{{',
      whitespaceStart,
      indent([whitespace, path.call(print, 'markup')]),
      whitespace,
      whitespaceEnd,
      '}}',
    ]);
  }

  // This should probably be better than this but it'll do for now.
  const lines = markupLines(node.markup);
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
    node.markup,
    ' ',
    whitespaceEnd,
    '}}',
  ]);
}

function printNamedLiquidBlock(
  path: AstPath<LiquidTagNamed | LiquidBranchNamed>,
  _options: LiquidParserOptions,
  print: LiquidPrinter,
  whitespaceStart: Doc,
  whitespaceEnd: Doc,
): Doc {
  const node = path.getValue();

  const tag = (whitespace: Doc) =>
    group([
      '{%',
      whitespaceStart,
      ' ',
      node.name,
      ' ',
      indent(path.call((p) => print(p), 'markup')),
      whitespace,
      whitespaceEnd,
      '%}',
    ]);

  switch (node.name) {
    case NamedTags.echo: {
      const whitespace = node.markup.filters.length > 0 ? line : ' ';
      return tag(whitespace);
    }

    case NamedTags.assign: {
      const whitespace = node.markup.value.filters.length > 0 ? line : ' ';
      return tag(whitespace);
    }

    case NamedTags.include:
    case NamedTags.render: {
      const markup = node.markup;
      const whitespace =
        markup.args.length > 0 || (markup.variable && markup.alias)
          ? line
          : ' ';
      return tag(whitespace);
    }

    case NamedTags.section: {
      return tag(' ');
    }

    case NamedTags.form: {
      const args = node.markup;
      const whitespace = args.length > 1 ? line : ' ';
      return group([
        '{%',
        whitespaceStart,
        ' ',
        node.name,
        ' ',
        indent([
          join(
            [',', line],
            path.map((p) => print(p), 'markup'),
          ),
        ]),
        whitespace,
        whitespaceEnd,
        '%}',
      ]);
    }

    case NamedTags.paginate: {
      return tag(line);
    }

    case NamedTags.if:
    case NamedTags.elsif:
    case NamedTags.unless: {
      const whitespace = [
        NodeTypes.Comparison,
        NodeTypes.LogicalExpression,
      ].includes(node.markup.type)
        ? line
        : ' ';
      return tag(whitespace);
    }

    default: {
      return assertNever(node);
    }
  }
}

export function printLiquidBlockStart(
  path: AstPath<LiquidTag | LiquidBranch>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  { leadingSpaceGroupId, trailingSpaceGroupId }: LiquidPrinterArgs = {},
): Doc {
  const node = path.getValue();
  if (!node.name) return '';

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

  if (typeof node.markup !== 'string') {
    return printNamedLiquidBlock(
      path as AstPath<LiquidTagNamed | LiquidBranchNamed>,
      options,
      print,
      whitespaceStart,
      whitespaceEnd,
    );
  }

  const lines = markupLines(node.markup);

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

  const markup = node.markup;
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
  _options: LiquidParserOptions,
  _print: LiquidPrinter,
  { leadingSpaceGroupId, trailingSpaceGroupId }: LiquidPrinterArgs = {},
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
    hasMeaningfulLackOfTrailingWhitespace(node),
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
  args: LiquidPrinterArgs,
): Doc {
  const { leadingSpaceGroupId, trailingSpaceGroupId } = args;
  const node = path.getValue();
  if (!node.children || !node.blockEndPosition) {
    return printLiquidBlockStart(path, options, print, args);
  }
  const tagGroupId = Symbol('tag-group');
  const blockStart = printLiquidBlockStart(path, options, print, {
    ...args,
    leadingSpaceGroupId,
    trailingSpaceGroupId: tagGroupId,
  }); // {% if ... %}
  const blockEnd = printLiquidBlockEnd(path, options, print, {
    ...args,
    leadingSpaceGroupId: tagGroupId,
    trailingSpaceGroupId,
  }); // {% endif %}

  let body: Doc = [];

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

  return group([blockStart, body, innerTrailingWhitespace(node), blockEnd], {
    id: tagGroupId,
    shouldBreak:
      LIQUID_TAGS_THAT_ALWAYS_BREAK.includes(node.name) ||
      originallyHadLineBreaks(path, options) ||
      isAttributeNode(node) ||
      isDeeplyNested(node),
  });
}

function isAttributeNode(node: LiquidTag) {
  return (
    isHtmlNode(node.parentNode) &&
    node.parentNode.attributes.indexOf(node) !== -1
  );
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

  return softline;
}

function innerTrailingWhitespace(node: LiquidTag | LiquidBranch) {
  if (
    node.type === NodeTypes.LiquidBranch ||
    !node.blockEndPosition ||
    !node.lastChild
  ) {
    return '';
  }

  if (
    node.lastChild.hasTrailingWhitespace &&
    node.lastChild.isTrailingWhitespaceSensitive
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
    isEmpty(branch.children) && !branch.hasDanglingWhitespace;
  if (isBranchEmptyWithoutSpace) return '';

  // If the branch does not break, is empty and had whitespace, we might
  // want a space in there. We don't collapse those because the trailing
  // whitespace does not come from the parent.
  // {% if A %} {% else %}...{% endif %}
  if (branch.hasDanglingWhitespace) {
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
  const outerLeadingWhitespace =
    branch.hasLeadingWhitespace && !shouldCollapseSpace ? line : softline;

  return [
    outerLeadingWhitespace,
    printLiquidBlockStart(path as AstPath<LiquidBranch>, options, print, args),
    indent([
      innerLeadingWhitespace(branch),
      printChildren(path, options, print, args),
    ]),
  ];
}

function needsBlockStartLeadingWhitespaceStrippingOnBreak(
  node: LiquidTag | LiquidBranch,
): boolean {
  switch (node.type) {
    case NodeTypes.LiquidTag: {
      return (
        !isAttributeNode(node) && hasMeaningfulLackOfLeadingWhitespace(node)
      );
    }
    case NodeTypes.LiquidBranch: {
      return (
        !isAttributeNode(node.parentNode! as LiquidTag) &&
        hasMeaningfulLackOfLeadingWhitespace(node)
      );
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
        return hasMeaningfulLackOfTrailingWhitespace(node);
      }

      return isEmpty(node.children)
        ? hasMeaningfulLackOfDanglingWhitespace(node)
        : hasMeaningfulLackOfLeadingWhitespace(node.firstChild!);
    }

    case NodeTypes.LiquidBranch: {
      if (isAttributeNode(node.parentNode! as LiquidTag)) {
        return false;
      }

      return node.firstChild
        ? hasMeaningfulLackOfLeadingWhitespace(node.firstChild)
        : hasMeaningfulLackOfDanglingWhitespace(node);
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
  } else if (isAttributeNode(node)) {
    return false;
  } else if (isBranchedTag(node)) {
    return hasMeaningfulLackOfTrailingWhitespace(node.lastChild!);
  } else if (isEmpty(node.children)) {
    return hasMeaningfulLackOfDanglingWhitespace(node);
  } else {
    return hasMeaningfulLackOfTrailingWhitespace(node.lastChild!);
  }
}

function cleanDoc(doc: Doc[]): Doc[] {
  return doc.filter((x) => x !== '');
}
