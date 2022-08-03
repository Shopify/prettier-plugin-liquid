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
  DocumentNode,
} from '~/types';
import { assertNever } from '~/utils';

import { preprocess } from '~/printer/print-preprocess';
import {
  bodyLines,
  hasLineBreakInRange,
  isEmpty,
  isTextLikeNode,
  reindent,
} from '~/printer/utils';
import { printElement } from '~/printer/print/element';
import {
  printClosingTagSuffix,
  printOpeningTagPrefix,
} from '~/printer/print/tag';
import {
  printLiquidBranch,
  printLiquidDrop,
  printLiquidTag,
} from '~/printer/print/liquid';
import { printChildren } from '~/printer/print/children';

const { builders } = doc;
const { fill, group, hardline, indent, join, line, softline } = builders;
const { replaceTextEndOfLine } = doc.utils as any;

function getSchema(contents: string, options: LiquidParserOptions) {
  try {
    return [JSON.stringify(JSON.parse(contents), null, options.tabWidth), true];
  } catch (e) {
    return [contents, false];
  }
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

const oppositeQuotes = {
  '"': "'",
  "'": '"',
};

function printAttribute<
  T extends Extract<LiquidHtmlNode, { attributePosition: Position }>,
>(path: AstPath<T>, options: LiquidParserOptions, _print: LiquidPrinter) {
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
  const preferredQuote = options.singleQuote ? `'` : `"`;
  const attributeValueContainsQuote = !!node.value.find(
    (valueNode) =>
      isTextLikeNode(valueNode) && valueNode.value.includes(preferredQuote),
  );
  const quote = attributeValueContainsQuote
    ? oppositeQuotes[preferredQuote]
    : preferredQuote;

  return [
    node.name,
    '=',
    quote,
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
    quote,
  ];
}

function isYamlFrontMatter(node: TextNode) {
  return (
    node.parentNode &&
    node.parentNode.type === NodeTypes.Document &&
    !node.prev &&
    /^---\r?\n/.test(node.value)
  );
}

function printTextNode(
  path: AstPath<TextNode>,
  options: LiquidParserOptions,
  _print: LiquidPrinter,
) {
  const node = path.getValue();

  if (isYamlFrontMatter(node)) return node.value;

  if (node.value.match(/^\s*$/)) return '';
  const text = node.value;

  const paragraphs = text
    .split(/(\r?\n){2,}/)
    .filter(Boolean) // removes empty paragraphs (trailingWhitespace)
    .map((curr) => {
      let doc = [];
      const words = curr.trim().split(/\s+/g);
      let isFirst = true;
      for (let j = 0; j < words.length; j++) {
        const word = words[j];
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
        printChildren(path as AstPath<DocumentNode>, options, print, args),
        hardline,
      ];
    }

    case NodeTypes.HtmlElement: {
      return printElement(path as AstPath<HtmlElement>, options, print);
    }

    case NodeTypes.HtmlVoidElement: {
      return printElement(path as AstPath<HtmlVoidElement>, options, print);
    }

    case NodeTypes.HtmlSelfClosingElement: {
      return printElement(
        path as AstPath<HtmlSelfClosingElement>,
        options,
        print,
      );
    }

    case NodeTypes.HtmlRawNode: {
      const lines = bodyLines(node.body);
      const shouldSkipFirstLine =
        !node.source[node.blockStartPosition.end].match(/\r|\n/);
      const body =
        lines.length > 0 && lines[0] !== ''
          ? [
              indent([
                hardline,
                join(hardline, reindent(lines, shouldSkipFirstLine)),
              ]),
              hardline,
            ]
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
      return printLiquidDrop(path as AstPath<LiquidDrop>, options, print, args);
    }

    case NodeTypes.LiquidRawTag: {
      const lines = bodyLines(node.body);
      const shouldSkipFirstLine =
        !node.source[node.blockStartPosition.end].match(/\r|\n/);
      const body = reindent(lines, shouldSkipFirstLine);
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

      if (node.name === 'schema') {
        const [schema, isValid] = getSchema(node.body, options);
        if (!isValid) {
          return [
            blockStart,
            ...replaceTextEndOfLine(schema, hardline),
            blockEnd,
          ];
        }

        const body = [hardline, ...replaceTextEndOfLine(schema, hardline)];
        return [
          blockStart,
          options.indentSchema ? indent(body) : body,
          hardline,
          blockEnd,
        ];
      }

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
          indent([line, join(hardline, reindent(bodyLines(node.body), true))]),
          line,
        ]),
        '-->',
      ];
    }

    case NodeTypes.TextNode: {
      return printTextNode(path as AstPath<TextNode>, options, print);
    }

    case NodeTypes.String: {
      const preferredQuote = options.singleQuote ? `'` : `"`;
      const attributeValueContainsQuote = node.value.includes(preferredQuote);
      const quote = attributeValueContainsQuote
        ? oppositeQuotes[preferredQuote]
        : preferredQuote;
      return [quote, node.value, quote];
    }

    case NodeTypes.Number: {
      if (args.truncate) {
        return node.value.replace(/\.\d+$/, '');
      } else {
        return node.value;
      }
    }

    case NodeTypes.Range: {
      return [
        '(',
        path.call((p) => print(p, { truncate: true }), 'start'),
        '..',
        path.call((p) => print(p, { truncate: true }), 'end'),
        ')',
      ];
    }

    case NodeTypes.LiquidLiteral: {
      // We prefer nil over null.
      if (node.keyword === 'null') {
        return 'nil';
      }
      return node.keyword;
    }

    case NodeTypes.LiquidVariable: {
      // TODO this is where you'll do the pipe first/last logic.
      return [path.call(print, 'expression')];
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
