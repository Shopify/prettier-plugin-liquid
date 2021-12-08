import { Printer, AstPath, Doc, ParserOptions, doc } from 'prettier';
import {
  LiquidHtmlNode,
  NodeTypes,
  DocumentNode,
  LiquidTag,
  LiquidDrop,
} from '../parsers';
import { assertNever } from '../utils';

const { builders } = doc;
const { group, line, softline, hardline, join, indent } = builders;

function markupLines(node: LiquidTag | LiquidDrop): string[] {
  return node.markup
    .trim()
    .split('\n')
    .map((line: string) => line.trim());
}

function blockStart(node: LiquidTag): Doc {
  const lines = markupLines(node);
  if (lines.length > 1 && node.name !== 'liquid') {
    return group([
      '{%',
      node.whitespaceStart,
      indent([hardline, node.name, ' ', join(hardline, lines)]),
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

/**
 * This one is a bit like path.map except that it tries to maintain new
 * lines in between nodes. And it will shrink multiple new lines into one.
 */
function mapWithNewLine(
  path: AstPath<LiquidHtmlNode>,
  options: ParserOptions<LiquidHtmlNode>,
  print: (path: AstPath<LiquidHtmlNode>) => Doc,
  property: string,
): Doc[] {
  const doc: Doc[] = [];
  const source = (path.stack[0] as DocumentNode).source;
  let curr: LiquidHtmlNode | null = null;
  let prev: LiquidHtmlNode | null = null;
  path.each((path) => {
    curr = path.getValue();
    if (
      curr &&
      prev &&
      options.locEnd(prev) < options.locStart(curr)
    ) {
      const gap = source.slice(
        options.locEnd(prev),
        options.locStart(curr),
      );
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

      case NodeTypes.ElementNode: {
        return group(
          [
            group([
              '<',
              node.name,
              attributes(path, options, print),
              '>',
            ]),
            indent([
              softline,
              join(
                softline,
                mapWithNewLine(path, options, print, 'children'),
              ),
            ]),
            softline,
            group(['</', node.name, '>']),
          ],
          {
            shouldBreak: ['html', 'body', 'head'].includes(node.name),
          },
        );
      }

      case NodeTypes.VoidElementNode: {
        return group([
          '<',
          node.name,
          attributes(path, options, print),
          '>',
        ]);
      }

      case NodeTypes.SelfClosingElementNode: {
        return group([
          '<',
          node.name,
          attributes(path, options, print),
          '/>',
        ]);
      }

      case NodeTypes.RawNode: {
        const bodyLines = node.body
          .replace(/^\n|\n$/g, '') // only want the meat
          .split('\n');
        const minIndentLevel = bodyLines
          .filter((line) => line.length > 0)
          .map((line) => (line.match(/^\s*/) as any)[0].length)
          .reduce((a, b) => Math.min(a, b), Infinity);
        const indentStrip = ' '.repeat(minIndentLevel);
        const body = bodyLines.map((line) =>
          line.replace(indentStrip, ''),
        );

        return [
          group([
            '<',
            node.name,
            attributes(path, options, print),
            '>',
          ]),
          indent([hardline, join(hardline, body)]),
          hardline,
          ['</', node.name, '>'],
        ];
      }

      case NodeTypes.LiquidDrop: {
        const lines = markupLines(node);
        if (lines.length > 1) {
          return group([
            '{{',
            node.whitespaceStart,
            indent([hardline, join(hardline, lines)]),
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

      case NodeTypes.LiquidTag: {
        if (node.children) {
          return group([
            blockStart(node),
            group([
              indent([
                softline,
                join(
                  softline,
                  mapWithNewLine(path, options, print, 'children'),
                ),
              ]),
              softline,
            ]),
            blockEnd(node),
          ]);
        } else {
          return blockStart(node);
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
        return join(hardline, node.value.trim().split('\n'));
      }

      default: {
        return assertNever(node);
      }
    }
  },
};
