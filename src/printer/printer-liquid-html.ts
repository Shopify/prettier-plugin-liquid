import { Printer, AstPath, Doc, doc } from 'prettier';
import {
  LiquidHtmlNode,
  LiquidTag,
  LiquidBranch,
  LiquidDrop,
  TextNode,
  HtmlElement,
  AttributeNode,
  HtmlVoidElement,
  HtmlSelfClosingElement,
  HtmlRawNode,
  AttrUnquoted,
  AttrSingleQuoted,
  AttrDoubleQuoted,
  LiquidAstPath,
  LiquidParserOptions,
  LiquidPrinter,
  NodeTypes,
  Position,
  LiquidPrinterArgs,
} from '~/types';
import { AttributeNodeBase, isBranchedTag, HtmlNodeBase } from '~/parser/ast';
import { assertNever } from '~/utils';

import { preprocess } from '~/printer/print-preprocess';
import { printAsParagraph } from '~/printer/print-as-paragraph';
import {
  bodyLines,
  getSource,
  getWhitespaceTrim,
  hasLineBreakInRange,
  isDeeplyNested,
  isEmpty,
  isTrimmingInnerLeft,
  isTrimmingInnerRight,
  isWhitespace,
  markupLines,
  maybeIndent,
  originallyHadLineBreaks,
  reindent,
  trim,
} from '~/printer/utils';
import { printClosingTagSuffix, printOpeningTagPrefix } from './print/tag';

const { builders } = doc;
const { ifBreak, fill, group, hardline, indent, join, line, softline } =
  builders;

const HTML_TAGS_THAT_ALWAYS_BREAK = [
  'html',
  'body',
  'head',
  'main',
  'section',
  'header',
  'footer',
  'ul',
  'ol',
];
const LIQUID_TAGS_THAT_ALWAYS_BREAK = ['for', 'case'];

function cleanDoc(doc: Doc[]): Doc[] {
  return doc.filter((x) => x !== '');
}

/**
 * This one is a bit like path.map except that it tries to maintain new
 * lines in between nodes. And it will shrink multiple new lines into one.
 */
function mapWithNewLine(
  path: LiquidAstPath,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  property: string,
  args?: LiquidPrinterArgs,
): Doc[] {
  const doc: Doc[] = [];
  const source = getSource(path);
  const { locStart, locEnd } = options;
  let curr: LiquidHtmlNode | null = null;
  let prev: LiquidHtmlNode | null = null;
  path.each((path) => {
    curr = path.getValue();
    if (curr && prev && locEnd(prev) < locStart(curr)) {
      const gap = source.slice(locEnd(prev), locStart(curr));
      // if we have more than one new line between nodes, insert an empty
      // node in between the result of the `map`. This way we can join with
      // hardline or softline and maintain 'em.
      if (gap.replace(/ |\t|\r/g, '').length > 1) {
        doc.push('');
      }
    }
    doc.push(printNode(path, options, print, args));
    prev = curr;
  }, property);
  return doc;
}

function printLiquidDrop(
  path: LiquidAstPath,
  { locStart, locEnd }: LiquidParserOptions,
  { leadingSpaceGroupId, trailingSpaceGroupId }: LiquidPrinterArgs,
) {
  const node: LiquidDrop = path.getValue() as LiquidDrop;
  const whitespaceStart = getWhitespaceTrim(
    node.whitespaceStart,
    node.source,
    locStart(node) - 1,
    leadingSpaceGroupId,
  );
  const whitespaceEnd = getWhitespaceTrim(
    node.whitespaceEnd,
    node.source,
    locEnd(node),
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

function printLiquidBlockStart(
  path: AstPath<LiquidTag | LiquidBranch>,
  leftParentGroupId: symbol | undefined,
  rightParentGroupId: symbol | undefined,
): Doc {
  const node = path.getValue();
  if (!node.name) return '';

  const lines = markupLines(node);
  const positionStart =
    (node as LiquidTag).blockStartPosition?.start ?? node.position.start;
  const positionEnd =
    (node as LiquidTag).blockStartPosition?.end ?? node.position.end;

  const whitespaceStart = getWhitespaceTrim(
    node.whitespaceStart,
    node.source,
    positionStart - 1,
    leftParentGroupId,
    rightParentGroupId,
  );
  const whitespaceEnd = getWhitespaceTrim(
    node.whitespaceEnd,
    node.source,
    positionEnd,
    rightParentGroupId,
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
  } else if (lines.length > 1) {
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

function printLiquidBlockEnd(
  path: AstPath<LiquidTag>,
  leftParentGroupId: symbol | undefined,
  rightParentGroupId: symbol | undefined,
): Doc {
  const node = path.getValue();
  if (!node.children || !node.blockEndPosition) return '';
  const whitespaceStart = getWhitespaceTrim(
    node.delimiterWhitespaceStart ?? '',
    node.source,
    node.blockEndPosition.start - 1,
    leftParentGroupId,
  );
  const whitespaceEnd = getWhitespaceTrim(
    node.delimiterWhitespaceEnd ?? '',
    node.source,
    node.blockEndPosition.end,
    leftParentGroupId,
    rightParentGroupId,
  );
  return group([
    '{%',
    whitespaceStart,
    ` end${node.name} `,
    whitespaceEnd,
    '%}',
  ]);
}

function printHtmlBlockStart(
  path: AstPath<Extract<LiquidHtmlNode, HtmlNodeBase<any>>>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
): Doc {
  const node = path.getValue();

  if (node.attributes.length === 1) {
    return [
      '<',
      printName(node.name, path, print),
      ' ',
      path.map((p) => print(p), 'attributes'),
      '>',
    ];
  }

  return group([
    '<',
    printName(node.name, path, print),
    printAttributes(path as AstPath<HtmlElement>, options, print),
    '>',
  ]);
}

function printHtmlElement(
  path: AstPath<HtmlElement>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
): Doc {
  const node = path.getValue();
  const htmlElementGroupId = Symbol('html-element-id');
  return group(
    [
      printHtmlBlockStart(path, options, print),
      maybeIndent(
        softline,
        printChildren(path as AstPath<HtmlElement>, options, print, {
          leadingSpaceGroupId: htmlElementGroupId,
          trailingSpaceGroupId: htmlElementGroupId,
        }),
      ),
      softline,
      group(['</', printName(node.name, path, print), '>']),
    ],
    {
      shouldBreak:
        (typeof node.name === 'string' &&
          HTML_TAGS_THAT_ALWAYS_BREAK.includes(node.name)) ||
        originallyHadLineBreaks(path, options),
      id: htmlElementGroupId,
    },
  );
}

function printAttributes<
  T extends LiquidHtmlNode & {
    attributes: AttributeNode[];
    blockStartPosition: Position;
  },
>(path: AstPath<T>, _options: LiquidParserOptions, print: LiquidPrinter): Doc {
  const node = path.getValue();
  if (isEmpty(node.attributes)) return '';
  return group(
    [
      indent([
        line,
        join(
          line,
          path.map((p) => print(p), 'attributes'),
        ),
      ]),
      softline,
    ],
    {
      shouldBreak: hasLineBreakInRange(
        node.source,
        node.blockStartPosition.start,
        node.blockStartPosition.end,
      ),
    },
  );
}

function printAttribute<T extends AttributeNodeBase<any>>(
  path: AstPath<T>,
  _options: LiquidParserOptions,
  _print: LiquidPrinter,
) {
  const node = path.getValue();
  const attrGroupId = Symbol('attr-group-id');
  // What should be the rule here? Should it really be "paragraph"?
  // ideally... if the thing is and the line is too long
  // use cases:
  //  - attr-{{ section.id }}--something.
  //  * We should try to put that "block" on one line
  //
  //  - attr {{ classname }} foo
  //  * we should try to put on one line?
  //
  //  - attr hello world ok fellow friends what do
  //  * if the line becomes too long do we want to break one per line?
  //    - for alt, would be paragraph
  //    - for classes, yeah maybe
  //    - for srcset?, it should be "split on comma"
  //    - for sizes?, it should be "split on comma"
  //    - for href?, it should be no space url
  //    - for others?, it should be keywords
  //    - for style, should be break on ;
  //    - for other?, should be...
  //    - how the fuck am I going to do that?
  //    - same way we do this? with a big ass switch case?
  //    - or we... don't and leave it as is?
  //
  // Anyway, for that reason ^, for now I'll just paste in what we have in
  // the source. It's too hard to get right.

  const value = node.source.slice(
    node.attributePosition.start,
    node.attributePosition.end,
  );
  return [
    node.name,
    '=',
    '"',
    hasLineBreakInRange(
      node.source,
      node.attributePosition.start,
      node.attributePosition.end,
    )
      ? group(
          [
            indent([
              softline,
              join(hardline, reindent(bodyLines(value), true)),
            ]),
            softline,
          ],
          { id: attrGroupId },
        )
      : value,
    '"',
  ];
}

function printName(
  name: string | LiquidDrop,
  path: LiquidAstPath,
  print: LiquidPrinter,
): Doc {
  if (typeof name === 'string') return name;
  return path.call(print, 'name');
}

function printChildren<
  T extends LiquidHtmlNode & { children?: LiquidHtmlNode[] },
>(
  path: AstPath<T>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  args: LiquidPrinterArgs,
): Doc {
  const node = path.getValue();
  if (!node.children || isEmpty(node.children)) return '';

  const hasNonEmptyTextNode = !!node.children.find(
    (child) => child.type === NodeTypes.TextNode,
  );

  return hasNonEmptyTextNode
    ? printAsParagraph(path, options, print, 'children')
    : join(
        hardline,
        mapWithNewLine(path, options, print, 'children', args), // TODO
      );
}

function printLiquidTag(
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
      join(softline, mapWithNewLine(path, options, print, 'children')),
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
  if (
    !isWhitespace(node.source, node.blockStartPosition.end) ||
    isTrimmingInnerLeft(node)
  ) {
    return softline;
  }

  return line;
}

function innerTrailingWhitespace(node: LiquidTag | LiquidBranch) {
  if (node.type === NodeTypes.LiquidBranch || !node.blockEndPosition) return '';
  if (
    !isWhitespace(node.source, node.blockEndPosition.start - 1) ||
    isTrimmingInnerRight(node)
  ) {
    return softline;
  }

  return line;
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

function printLiquidBranch(
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

function printTextNode(
  path: AstPath<TextNode>,
  options: LiquidParserOptions,
  _print: LiquidPrinter,
) {
  const node = path.getValue();
  if (node.value.match(/^\s*$/)) return '';
  const text = node.value;

  const paragraphs = text
    .split(/(\r?\n){2,}/)
    .filter(Boolean) // removes empty paragraphs (trailingWhitespace)
    .map((curr) => {
      let doc = [];
      const words = curr.trim().split(/\s+/g);
      let isFirst = true;
      for (const word of words) {
        if (isFirst) {
          isFirst = false;
        } else {
          doc.push(line);
        }
        doc.push(word);
      }
      return fill(doc);
    });

  return [
    printOpeningTagPrefix(node, options),
    join(hardline, paragraphs),
    printClosingTagSuffix(node, options),
  ];
}

function printNode(
  path: LiquidAstPath,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  args: LiquidPrinterArgs = {},
) {
  const node = path.getValue();
  switch (node.type) {
    case NodeTypes.Document: {
      return [
        join(hardline, mapWithNewLine(path, options, print, 'children')),
        hardline,
      ];
    }

    case NodeTypes.HtmlElement: {
      return printHtmlElement(path as AstPath<HtmlElement>, options, print);
    }

    case NodeTypes.HtmlVoidElement: {
      return printHtmlBlockStart(
        path as AstPath<HtmlVoidElement>,
        options,
        print,
      );
    }

    case NodeTypes.HtmlSelfClosingElement: {
      return group([
        '<',
        printName(node.name, path, print),
        printAttributes(
          path as AstPath<HtmlSelfClosingElement>,
          options,
          print,
        ),
        line,
        '/>',
      ]);
    }

    case NodeTypes.HtmlRawNode: {
      const lines = bodyLines(node.body);
      const body =
        lines.length > 0 && lines[0] !== ''
          ? [indent([hardline, join(hardline, reindent(lines))]), hardline]
          : [softline];

      return group([
        group([
          '<',
          node.name,
          printAttributes(path as AstPath<HtmlRawNode>, options, print),
          '>',
        ]),
        body,
        ['</', node.name, '>'],
      ]);
    }

    case NodeTypes.LiquidDrop: {
      return printLiquidDrop(path, options, args);
    }

    case NodeTypes.LiquidRawTag: {
      const lines = bodyLines(node.body);
      const body = reindent(lines);
      const blockStart = group([
        '{%',
        node.whitespaceStart,
        ' ',
        node.name,
        ' ',
        node.whitespaceEnd,
        '%}',
      ]);
      const blockEnd = [
        '{%',
        node.whitespaceStart,
        ' ',
        'end',
        node.name,
        ' ',
        node.whitespaceEnd,
        '%}',
      ];

      if (
        !hasLineBreakInRange(
          node.source,
          node.blockStartPosition.end,
          node.blockEndPosition.start,
        )
      ) {
        return [
          blockStart,
          node.source.slice(
            node.blockStartPosition.end,
            node.blockEndPosition.start,
          ),
          blockEnd,
        ];
      }

      return [
        blockStart,
        indent([hardline, join(hardline, body)]),
        hardline,
        blockEnd,
      ];
    }

    case NodeTypes.LiquidTag: {
      return printLiquidTag(path as AstPath<LiquidTag>, options, print, args);
    }

    case NodeTypes.LiquidBranch: {
      return printLiquidBranch(
        path as AstPath<LiquidBranch>,
        options,
        print,
        args,
      );
    }

    case NodeTypes.AttrEmpty: {
      return node.name;
    }

    case NodeTypes.AttrUnquoted:
    case NodeTypes.AttrSingleQuoted:
    case NodeTypes.AttrDoubleQuoted: {
      return printAttribute(
        path as AstPath<AttrUnquoted | AttrSingleQuoted | AttrDoubleQuoted>,
        options,
        print,
      );
    }

    case NodeTypes.HtmlComment: {
      return [
        '<!--',
        group([
          indent([
            line,
            join(hardline, reindent(bodyLines(node.body.trimStart()), true)),
          ]),
          line,
        ]),
        '-->',
      ];
    }

    case NodeTypes.TextNode: {
      return printTextNode(path as AstPath<TextNode>, options, print);
    }

    default: {
      return assertNever(node);
    }
  }
}

export const printerLiquidHtml: Printer<LiquidHtmlNode> & { preprocess: any } =
  {
    print: printNode,
    preprocess,
  };