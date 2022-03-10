import { Printer, AstPath, Doc, ParserOptions, doc } from 'prettier';
import {
  LiquidHtmlNode,
  NodeTypes,
  DocumentNode,
  LiquidTag,
  LiquidBranch,
  LiquidDrop,
  isBranchedTag,
  LiquidNode,
} from '../parsers';
import { assertNever } from '../utils';

type LiquidAstPath = AstPath<LiquidHtmlNode>;
type LiquidParserOptions = ParserOptions<LiquidHtmlNode>;
type LiquidPrinter = (path: AstPath<LiquidHtmlNode>) => Doc;

const identity = <T>(x: T): T => x;

const { builders } = doc;
const { group, fill, line, softline, hardline, join, indent } =
  builders;

const HTML_TAGS_THAT_ALWAYS_BREAK = [
  'html',
  'body',
  'head',
  'main',
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

function markupLines(
  node: LiquidTag | LiquidDrop | LiquidBranch,
): string[] {
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
  return lines
    .map((line) => line.replace(indentStrip, ''))
    .map(trimEnd);
}

function blockStart(node: LiquidTag | LiquidBranch): Doc {
  const lines = markupLines(node);
  if (!node.name) return '';
  if (node.name === 'liquid') {
    return group([
      '{%',
      node.whitespaceStart,
      ' ',
      node.name,
      indent([hardline, join(hardline, reindent(lines, true))]),
      hardline,
      node.whitespaceEnd,
      '%}',
    ]);
  } else if (lines.length > 1) {
    return group([
      '{%',
      node.whitespaceStart,
      indent([
        hardline,
        node.name,
        ' ',
        join(hardline, lines.map(trim)),
      ]),
      hardline,
      node.whitespaceEnd,
      '%}',
    ]);
  }

  const markup = node.markup.trim();
  return group([
    '{%',
    node.whitespaceStart,
    ' ',
    node.name,
    markup ? ` ${markup}` : '',
    ' ',
    node.whitespaceEnd,
    '%}',
  ]);
}

function blockEnd(node: LiquidTag): Doc {
  if (!node.children) return '';
  return group([
    '{%',
    node.delimiterWhitespaceStart ?? '',
    ` end${node.name} `,
    node.delimiterWhitespaceEnd ?? '',
    '%}',
  ]);
}

function attributes(path: any, _options: any, print: any): Doc {
  const node = path.getValue();
  if (node.attributes.length == 0) return '';
  return group(
    [
      indent([line, join(line, path.map(print, 'attributes'))]),
      softline,
    ],
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

/**
 * This one is a bit like path.map except that it tries to maintain new
 * lines in between nodes. And it will shrink multiple new lines into one.
 */
function mapWithNewLine(
  path: LiquidAstPath,
  { locStart, locEnd }: LiquidParserOptions,
  print: LiquidPrinter,
  property: string,
): Doc[] {
  const doc: Doc[] = [];
  const source = getSource(path);
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
    doc.push(print(path));
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
  { locStart, locEnd }: LiquidParserOptions,
  print: LiquidPrinter,
): Doc {
  // So I have a bunch of text nodes. What do I want out of 'em?
  const doc: Doc[] = [];
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
      doc.push(print(path));
    }
    prev = curr;
  }, 'children');

  return fill(doc);
}

export const liquidHtmlPrinter: Printer<LiquidHtmlNode> = {
  print(path, options, print) {
    const node = path.getValue();
    switch (node.type) {
      case NodeTypes.Document: {
        return [
          join(
            hardline,
            mapWithNewLine(path, options, print, 'children'),
          ),
          hardline,
        ];
      }

      case NodeTypes.HtmlElement: {
        const hasNonEmptyTextNode = !!node.children.find(
          (child) =>
            child.type === NodeTypes.TextNode &&
            !child.value.match(/^\s*$/),
        );
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
                  group(
                    [
                      hasNonEmptyTextNode
                        ? paragraph(path, options, print)
                        : join(
                            softline,
                            mapWithNewLine(
                              path,
                              options,
                              print,
                              'children',
                            ),
                          ),
                    ],
                    {
                      shouldBreak:
                        !hasNonEmptyTextNode &&
                        node.children.length > 1,
                    },
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
          },
        );
      }

      case NodeTypes.HtmlVoidElement: {
        return group([
          '<',
          node.name,
          attributes(path, options, print),
          '>',
        ]);
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
            ? [
                indent([hardline, join(hardline, reindent(lines))]),
                hardline,
              ]
            : [softline];

        return group([
          group([
            '<',
            node.name,
            attributes(path, options, print),
            '>',
          ]),
          body,
          ['</', node.name, '>'],
        ]);
      }

      case NodeTypes.LiquidDrop: {
        const lines = markupLines(node);
        if (lines.length > 1) {
          return group([
            '{{',
            node.whitespaceStart,
            indent([hardline, join(hardline, lines.map(trim))]),
            hardline,
            node.whitespaceEnd,
            '}}',
          ]);
        }
        return group([
          '{{',
          node.whitespaceStart,
          ' ',
          node.markup.trim(),
          ' ',
          node.whitespaceEnd,
          '}}',
        ]);
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
        if (isBranchedTag(node)) {
          const wrapper = node.name === 'case' ? indent : identity;
          return group(
            [
              blockStart(node),
              wrapper(path.map(print, 'children')),
              softline,
              blockEnd(node),
            ],
            {
              shouldBreak: LIQUID_TAGS_THAT_ALWAYS_BREAK.includes(
                node.name,
              ),
            },
          );
        } else if (node.children) {
          return group(
            [
              blockStart(node),
              indent([
                softline,
                join(
                  softline,
                  mapWithNewLine(path, options, print, 'children'),
                ),
              ]),
              softline,
              blockEnd(node),
            ],
            {
              shouldBreak: LIQUID_TAGS_THAT_ALWAYS_BREAK.includes(
                node.name,
              ),
            },
          );
        } else {
          return blockStart(node);
        }
      }

      case NodeTypes.LiquidBranch: {
        if (node.name) {
          return [
            softline,
            blockStart(node),
            indent([
              softline,
              join(
                softline,
                mapWithNewLine(path, options, print, 'children'),
              ),
            ]),
          ];
        } else if (node.children.length > 0) {
          return indent([
            softline,
            join(
              softline,
              mapWithNewLine(path, options, print, 'children'),
            ),
          ]);
        } else {
          return '';
        }
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
  },
};
