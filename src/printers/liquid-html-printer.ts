import { Printer, AstPath, Doc, ParserOptions, doc } from 'prettier';
import {
  LiquidHtmlNode,
  NodeTypes,
  DocumentNode,
  LiquidTag,
  LiquidBranch,
  LiquidDrop,
  isBranchedTag,
} from '../parsers';
import { assertNever } from '../utils';

type LiquidAstPath = AstPath<LiquidHtmlNode>;
type LiquidParserOptions = ParserOptions<LiquidHtmlNode>;
type LiquidPrinter = (path: AstPath<LiquidHtmlNode>) => Doc;

const identity = <T>(x: T): T => x;

const { builders } = doc;
const { fill, group, hardline, ifBreak, indent, join, line, softline } =
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

const trim = (x: string) => x.trim();
const trimEnd = (x: string) => x.trimEnd();

function bodyLines(str: string): string[] {
  return str
    .replace(/^\n*|\s*$/g, '') // only want the meat
    .split('\n');
}

function markupLines(node: LiquidTag | LiquidDrop | LiquidBranch): string[] {
  return node.markup.trim().split('\n');
}

function reindent(lines: string[], skipFirst = false): string[] {
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

function isWhitespace(source: string, loc: number): boolean {
  if (loc < 0 || loc >= source.length) return true;
  return !!source[loc].match(/\s/);
}

// Optionally converts a '' into '-' if the parent group breaks and
// the source[loc] is non space.
function getWhitespaceTrim(
  currWhitespaceTrim: string,
  source: string,
  loc: number,
  parentGroupId?: symbol,
): Doc {
  return ifBreak(
    !isWhitespace(source, loc) ? '-' : currWhitespaceTrim,
    currWhitespaceTrim,
    { groupId: parentGroupId },
  );
}

// Much like the function above but may break from the left or the right.
// e.g. flow breaks or element breaks. I'm not 100% sure of why it works
// but it looks like it does... (?) :D.
function getWhitespaceTrimLR(
  currWhitespaceTrim: string,
  source: string,
  loc: number,
  leftParentGroupId?: symbol,
  rightParentGroupId?: symbol,
) {
  const breaksContent = !isWhitespace(source, loc) ? '-' : currWhitespaceTrim;
  const flatContent = currWhitespaceTrim;
  return ifBreak(
    breaksContent,
    ifBreak(breaksContent, flatContent, {
      groupId: rightParentGroupId,
    }),
    { groupId: leftParentGroupId },
  );
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

  const whitespaceStart = getWhitespaceTrimLR(
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
  const whitespaceEnd = getWhitespaceTrimLR(
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

function attributes(path: any, _options: any, print: any): Doc {
  const node = path.getValue();
  if (node.attributes.length == 0) return '';
  return group(
    [indent([line, join(line, path.map(print, 'attributes'))]), softline],
    {
      shouldBreak: node.attributes.length > 2,
    },
  );
}

function printName(
  name: string | LiquidDrop,
  path: LiquidAstPath,
  print: LiquidPrinter,
): Doc {
  if (typeof name === 'string') return name;
  return path.call(print, 'name');
}

function originallyHadLineBreaks(
  path: LiquidAstPath,
  { locStart, locEnd }: LiquidParserOptions,
): boolean {
  const source = getSource(path);
  const node = path.getValue();
  const indexOfNewLine = source.indexOf('\n', locStart(node));
  return 0 <= indexOfNewLine && indexOfNewLine < locEnd(node);
}

function getSource(path: LiquidAstPath) {
  return (path.stack[0] as DocumentNode).source;
}

function mapGenericPrint(
  path: AstPath,
  property: string,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  parentGroupId?: symbol,
) {
  return path.map(
    (p) => genericPrint(p, options, print, parentGroupId),
    property,
  );
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
      if (gap.replace(/ |\t/g, '').length > 1) {
        doc.push('');
      }
    }
    doc.push(genericPrint(path, options, print, parentGroupId));
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
function paragraph(
  path: LiquidAstPath,
  options: LiquidParserOptions,
  print: LiquidPrinter,
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
      doc.push(genericPrint(path, options, print));
    }
    prev = curr;
  }, 'children');

  return fill(doc);
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

  let meat: Doc[] = [];
  let trailingWhitespace: Doc[] = [];
  if (node.blockEndPosition) {
    trailingWhitespace.push(
      isWhitespace(source, node.blockEndPosition.start - 1) ? line : softline,
    );
  }

  if (isBranchedTag(node)) {
    const wrapper = node.name === 'case' ? indent : identity;
    meat.push([
      wrapper(mapGenericPrint(path, 'children', options, print, parentGroupId)),
    ]);
  } else {
    meat.push(
      indent([
        innerLeadingWhitespace(node, source, parentGroupId),
        join(softline, mapWithNewLine(path, options, print, 'children')),
      ]),
    );
  }

  return group([blockStart, ...meat, ...trailingWhitespace, blockEnd], {
    id: tagGroupId,
    shouldBreak: LIQUID_TAGS_THAT_ALWAYS_BREAK.includes(node.name),
  });
}

function innerLeadingWhitespace(
  node: LiquidTag | LiquidBranch,
  source: string,
  parentGroupId?: symbol,
) {
  const hasWhitespaceInInput = isWhitespace(
    source,
    node.blockStartPosition.end,
  );
  const notTrimmingToTheRight = node.whitespaceEnd !== '-';
  const trimmingToTheLeft = node.whitespaceStart === '-'; // || (!breaking && !isWhitespace(beforeTag));

  return ifBreak(
    hasWhitespaceInInput && notTrimmingToTheRight ? line : softline,
    hasWhitespaceInInput &&
      notTrimmingToTheRight &&
      (trimmingToTheLeft ||
        !isWhitespace(source, node.blockStartPosition.start - 1))
      ? line
      : softline,
    { groupId: parentGroupId }, // if it
  );
}

function printLiquidBranch(
  path: AstPath<LiquidBranch>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  parentGroupId?: symbol,
) {
  const node = path.getValue();
  const parentNode: LiquidTag = path.getParentNode() as any;
  const source = getSource(path);

  const meat = join(softline, mapWithNewLine(path, options, print, 'children'));

  if (!node.name && node.children.length === 0) {
    return '';
  }

  if (!node.name) {
    return indent([innerLeadingWhitespace(parentNode, source), meat]);
  }

  const leadingWhitespace = isWhitespace(source, node.position.start)
    ? line
    : softline;

  return [
    leadingWhitespace,
    printLiquidBlockStart(
      path as AstPath<LiquidBranch>,
      parentGroupId,
      parentGroupId,
    ),
    indent([
      softline,
      join(softline, mapWithNewLine(path, options, print, 'children')),
    ]),
  ];
}

function genericPrint(
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
      const hasNonEmptyTextNode = !!node.children.find(
        (child) => child.type === NodeTypes.TextNode,
      );
      const htmlElementGroupId = Symbol('html-element-id');
      return group(
        [
          group([
            '<',
            printName(node.name, path, print),
            attributes(path, options, print),
            '>',
          ]),
          node.children.length > 0
            ? indent([
                softline,
                hasNonEmptyTextNode
                  ? paragraph(path, options, print)
                  : join(
                      hardline,
                      mapWithNewLine(
                        path,
                        options,
                        print,
                        'children',
                        htmlElementGroupId,
                      ),
                    ),
              ])
            : '',
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
      return group(['<', node.name, attributes(path, options, print), '>']);
    }

    case NodeTypes.HtmlSelfClosingElement: {
      return group([
        '<',
        printName(node.name, path, print),
        attributes(path, options, print),
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
        group(['<', node.name, attributes(path, options, print), '>']),
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
      return [node.name, '=', '"', path.map(print, 'value'), '"'];
    }

    case NodeTypes.TextNode: {
      return join(hardline, reindent(bodyLines(node.value)));
    }

    default: {
      return assertNever(node);
    }
  }
}

export const liquidHtmlPrinter: Printer<LiquidHtmlNode> = {
  print: genericPrint,
};
