import { Printer, AstPath, Doc, ParserOptions, doc } from 'prettier';
import { LiquidHtmlNode, NodeTypes, DocumentNode } from '../parsers';
import { assertNever } from '../utils';

const { builders } = doc;
const { group, line, softline, hardline, join, indent } = builders;

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
    if (curr && prev && options.locEnd(prev) < options.locStart(curr)) {
      const gap = source.slice(options.locEnd(prev), options.locStart(curr));
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
              join(softline, mapWithNewLine(path, options, print, 'children')),
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

      case NodeTypes.LiquidDrop: {
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
        const markup = node.markup.trim();
        const blockStart = group([
          '{%',
          node.whitespaceStart,
          ' ',
          node.name,
          markup ? ` ${markup}` : '',
          ' ',
          node.whitespaceEnd,
          '%}',
        ]);
        const blockEnd =
          node.children &&
          group([
            '{%',
            node.delimiterWhitespaceStart ?? '',
            ` end${node.name} `,
            node.delimiterWhitespaceEnd ?? '',
            '%}',
          ]);
        if (blockEnd) {
          return group([
            blockStart,
            group([
              indent([
                softline,
                join(softline, mapWithNewLine(path, options, print, 'children')),
              ]),
              softline,
            ]),
            blockEnd,
          ]);
        } else {
          return blockStart;
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
