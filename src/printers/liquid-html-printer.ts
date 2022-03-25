import { Printer, AstPath, Doc, doc } from 'prettier';
import {
  LiquidHtmlNode,
  NodeTypes,
  LiquidTag,
  LiquidBranch,
  LiquidDrop,
  isBranchedTag,
  TextNode,
  HtmlElement,
  AttributeNode,
  HtmlVoidElement,
  HtmlSelfClosingElement,
  HtmlRawNode,
  AttributeNodeBase,
  AttrUnquoted,
  AttrSingleQuoted,
  AttrDoubleQuoted,
} from '../parsers';
import { assertNever } from '../utils';
import {
  LiquidAstPath,
  LiquidParserOptions,
  LiquidPrinter,
  bodyLines,
  getSource,
  getWhitespaceTrim,
  hasLineBreakInRange,
  isEmpty,
  isTrimmingInnerLeft,
  isTrimmingInnerRight,
  isWhitespace,
  markupLines,
  maybeIndent,
  originallyHadLineBreaks,
  reindent,
  trim,
} from './utils';

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

function mapPrintNode(
  path: AstPath,
  property: string,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  parentGroupId?: symbol,
): Doc[] {
  return path
    .map((p) => printNode(p, options, print, parentGroupId), property)
    .filter((x) => x !== '');
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
  parentGroupId?: symbol,
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
    doc.push(printNode(path, options, print, parentGroupId));
    prev = curr;
  }, property);
  return doc;
}

/**
 * This function takes a node (assuming it has at least one TextNode
 * children) and reindents the text as a paragraph while maintaining
 * whitespace (if there is some) between adjacent nodes
 *
 * Example:
 *
 * <div>Hello {{ name }}! How are you doing today?</div> -->
 *   fill([
 *     "Hello", line,
 *     LiquidDrop<"name">, softline,
 *     "!", line,
 *     "How", line,
 *     "are", line,
 *     "you", line,
 *     "doing", line,
 *     "today?"
 *   ])
 *
 * Note how we have
 * - a `line` between `Hello` and `{{ name }}`,
 * - a `softline` between `{{ name }}` and `!`.
 */
function mapAsParagraph(
  path: LiquidAstPath,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  property: string,
): Doc {
  // So I have a bunch of text nodes. What do I want out of 'em?
  const doc: Doc[] = [];
  const { locStart, locEnd } = options;
  let curr: LiquidHtmlNode | null = null;
  let prev: LiquidHtmlNode | null = null;

  path.each((path) => {
    curr = path.getValue();
    if (curr && prev) {
      if (locEnd(prev) === locStart(curr)) {
        doc.push(softline);
      } else {
        doc.push(line);
      }
    }

    // Boi this is ugly.
    if (curr.type === NodeTypes.TextNode) {
      const words = curr.value.split(/\s+/g);
      let isFirst = true;
      for (const word of words) {
        if (isFirst) {
          isFirst = false;
        } else {
          doc.push(line);
        }
        doc.push(word);
      }
    } else {
      doc.push(printNode(path, options, print));
    }
    prev = curr;
  }, property);

  return fill(doc);
}

function printLiquidDrop(
  path: LiquidAstPath,
  { locStart, locEnd }: LiquidParserOptions,
  parentGroupId?: symbol,
) {
  const node: LiquidDrop = path.getValue() as LiquidDrop;
  const source = getSource(path);
  const whitespaceStart = getWhitespaceTrim(
    node.whitespaceStart,
    source,
    locStart(node) - 1,
    parentGroupId,
  );
  const whitespaceEnd = getWhitespaceTrim(
    node.whitespaceEnd,
    source,
    locEnd(node),
    parentGroupId,
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

  const source = getSource(path);
  const lines = markupLines(node);
  const positionStart =
    (node as LiquidTag).blockStartPosition?.start ?? node.position.start;
  const positionEnd =
    (node as LiquidTag).blockStartPosition?.end ?? node.position.end;

  const whitespaceStart = getWhitespaceTrim(
    node.whitespaceStart,
    source,
    positionStart - 1,
    leftParentGroupId,
    rightParentGroupId,
  );
  const whitespaceEnd = getWhitespaceTrim(
    node.whitespaceEnd,
    source,
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
  const source = getSource(path);
  const whitespaceStart = getWhitespaceTrim(
    node.delimiterWhitespaceStart ?? '',
    source,
    node.blockEndPosition.start - 1,
    leftParentGroupId,
  );
  const whitespaceEnd = getWhitespaceTrim(
    node.delimiterWhitespaceEnd ?? '',
    source,
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

function printAttributes<
  T extends LiquidHtmlNode & { attributes: AttributeNode[] },
>(path: AstPath<T>, _options: LiquidParserOptions, print: LiquidPrinter): Doc {
  const node = path.getValue();
  if (isEmpty(node.attributes)) return '';
  return group(
    [indent([line, join(line, path.map(print, 'attributes'))]), softline],
    {
      shouldBreak: node.attributes.length > 2,
    },
  );
}

function printAttribute<T extends AttributeNodeBase<any>>(
  path: AstPath<T>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
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

  const source = getSource(path);
  const value = source.slice(
    node.attributePosition.start,
    node.attributePosition.end,
  );
  return [
    node.name,
    '=',
    '"',
    hasLineBreakInRange(
      source,
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
  parentGroupId?: symbol,
): Doc {
  const node = path.getValue();
  if (!node.children || isEmpty(node.children)) return '';

  const hasNonEmptyTextNode = !!node.children.find(
    (child) => child.type === NodeTypes.TextNode,
  );

  return hasNonEmptyTextNode
    ? mapAsParagraph(path, options, print, 'children')
    : join(
        hardline,
        mapWithNewLine(path, options, print, 'children', parentGroupId),
      );
}

function printLiquidTag(
  path: AstPath<LiquidTag>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  parentGroupId?: symbol,
): Doc {
  const node = path.getValue();
  if (!node.children) {
    return printLiquidBlockStart(path, parentGroupId, parentGroupId);
  }
  const tagGroupId = Symbol('tag-group');
  const blockStart = printLiquidBlockStart(path, parentGroupId, tagGroupId); // {% if ... %}
  const blockEnd = printLiquidBlockEnd(path, tagGroupId, parentGroupId); // {% endif %}
  const source = getSource(path);

  let meat: Doc = [];
  let trailingWhitespace: Doc[] = [];
  if (node.blockEndPosition) {
    trailingWhitespace.push(innerTrailingWhitespace(node, source));
  }

  if (isBranchedTag(node)) {
    meat = mapPrintNode(path, 'children', options, print, tagGroupId);
    if (node.name === 'case') meat = indent(meat);
  } else if (node.children.length > 0) {
    meat = indent([
      innerLeadingWhitespace(node, source),
      join(softline, mapWithNewLine(path, options, print, 'children')),
    ]);
  }

  return group([blockStart, meat, ...trailingWhitespace, blockEnd], {
    id: tagGroupId,
    shouldBreak: LIQUID_TAGS_THAT_ALWAYS_BREAK.includes(node.name),
  });
}

function innerLeadingWhitespace(
  node: LiquidTag | LiquidBranch,
  source: string,
) {
  if (
    !isWhitespace(source, node.blockStartPosition.end) ||
    isTrimmingInnerLeft(node)
  ) {
    return softline;
  }

  return line;
}

function innerTrailingWhitespace(
  node: LiquidTag | LiquidBranch,
  source: string,
) {
  if (node.type === NodeTypes.LiquidBranch || !node.blockEndPosition) return '';
  if (
    !isWhitespace(source, node.blockEndPosition.start - 1) ||
    isTrimmingInnerRight(node)
  ) {
    return softline;
  }

  return line;
}

// Same same but different. This one has to check if the parent is
// whitespace stripping to the outer left, and the node itself if it is
// stripping the inner left.
function branchInnerLeadingWhitespace(
  branch: LiquidBranch,
  source: string,
): Doc {
  if (
    !isWhitespace(source, branch.blockStartPosition.end) ||
    isTrimmingInnerLeft(branch)
  ) {
    return softline;
  }

  return line;
}

function printLiquidBranch(
  path: AstPath<LiquidBranch>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  parentGroupId?: symbol,
) {
  const branch = path.getValue();
  const parentNode: LiquidTag = path.getParentNode() as any;
  const source = getSource(path);
  const isDefaultBranch = !branch.name;

  const meat = printChildren(path, options, print, parentGroupId);
  const shouldCollapseSpace =
    isEmpty(branch.children) && parentNode.children!.length === 1;
  const isBranchEmptyWithoutSpace =
    isEmpty(branch.children) &&
    !isWhitespace(source, parentNode.blockStartPosition.end);

  if (isDefaultBranch && !isEmpty(branch.children)) {
    return indent([innerLeadingWhitespace(parentNode, source), meat]);
  }

  if (isDefaultBranch && (isBranchEmptyWithoutSpace || shouldCollapseSpace)) {
    return '';
  } else if (isDefaultBranch && isEmpty(branch.children)) {
    return ifBreak('', ' ');
  }

  const outerLeadingWhitespace = isWhitespace(source, branch.position.start)
    ? line
    : softline;

  return [
    outerLeadingWhitespace,
    printLiquidBlockStart(
      path as AstPath<LiquidBranch>,
      parentGroupId,
      parentGroupId,
    ),
    indent([branchInnerLeadingWhitespace(branch, source), meat]),
  ];
}

function printTextNode(
  path: AstPath<TextNode>,
  _options: LiquidParserOptions,
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

  return join(hardline, paragraphs);
}

function printNode(
  path: LiquidAstPath,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  parentGroupId?: symbol,
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
      const htmlElementGroupId = Symbol('html-element-id');
      return group(
        [
          group([
            '<',
            printName(node.name, path, print),
            printAttributes(path as AstPath<HtmlElement>, options, print),
            '>',
          ]),
          maybeIndent(
            softline,
            printChildren(
              path as AstPath<HtmlElement>,
              options,
              print,
              htmlElementGroupId,
            ),
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

    case NodeTypes.HtmlVoidElement: {
      return group([
        '<',
        node.name,
        printAttributes(path as AstPath<HtmlVoidElement>, options, print),
        '>',
      ]);
    }

    case NodeTypes.HtmlSelfClosingElement: {
      return group([
        '<',
        printName(node.name, path, print),
        node.attributes.length > 0
          ? printAttributes(
              path as AstPath<HtmlSelfClosingElement>,
              options,
              print,
            )
          : ' ',
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
      return printLiquidDrop(path, options, parentGroupId);
    }

    case NodeTypes.LiquidRawTag: {
      const lines = bodyLines(node.body);
      const body = reindent(lines);

      return [
        group([
          '{%',
          node.whitespaceStart,
          ' ',
          node.name,
          ' ',
          node.whitespaceEnd,
          '%}',
        ]),
        indent([hardline, join(hardline, body)]),
        hardline,
        [
          '{%',
          node.whitespaceStart,
          ' ',
          'end',
          node.name,
          ' ',
          node.whitespaceEnd,
          '%}',
        ],
      ];
    }

    case NodeTypes.LiquidTag: {
      return printLiquidTag(
        path as AstPath<LiquidTag>,
        options,
        print,
        parentGroupId,
      );
    }

    case NodeTypes.LiquidBranch: {
      return printLiquidBranch(
        path as AstPath<LiquidBranch>,
        options,
        print,
        parentGroupId,
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

export const liquidHtmlPrinter: Printer<LiquidHtmlNode> = {
  print: printNode,
};
