import { Printer, AstPath, Doc, doc } from 'prettier';
import {
  LiquidHtmlNode,
  LiquidExpression,
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
  LiquidRawTag,
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
  printLiquidRawTag,
  printLiquidTag,
} from '~/printer/print/liquid';
import { printChildren } from '~/printer/print/children';
import { embed } from '~/printer/embed';
import { RawMarkupKinds } from '~/parser';

const { builders } = doc;
const { fill, group, hardline, indent, join, line, softline } = builders;

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
        args,
      );
    }

    case NodeTypes.HtmlRawNode: {
      let body: Doc = [];
      const hasEmptyBody = node.body.value.trim() === '';
      const shouldIndentBody = node.body.kind !== RawMarkupKinds.markdown;

      if (!hasEmptyBody) {
        if (shouldIndentBody) {
          body = [indent([hardline, path.call(print, 'body')]), hardline];
        } else {
          body = [
            builders.dedentToRoot([hardline, path.call(print, 'body')]),
            hardline,
          ];
        }
      }

      return group([
        group([
          '<',
          node.name,
          printAttributes(path as AstPath<HtmlRawNode>, options, print),
          '>',
        ]),
        ...body,
        ['</', node.name, '>'],
      ]);
    }

    case NodeTypes.RawMarkup: {
      const lines = bodyLines(node.value);
      const shouldSkipFirstLine =
        !node.source[node.position.start].match(/\r|\n/);
      return lines.length > 0 && lines[0].trim() !== ''
        ? join(hardline, reindent(lines, shouldSkipFirstLine))
        : softline;
    }

    case NodeTypes.LiquidDrop: {
      return printLiquidDrop(path as AstPath<LiquidDrop>, options, print, args);
    }

    case NodeTypes.LiquidRawTag: {
      return printLiquidRawTag(
        path as AstPath<LiquidRawTag>,
        options,
        print,
        args,
      );
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

    case NodeTypes.HtmlDoctype: {
      if (!node.legacyDoctypeString) return '<!doctype html>';
      return node.source.slice(node.position.start, node.position.end);
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

    case NodeTypes.AssignMarkup: {
      return [node.name, ' = ', path.call(print, 'value')];
    }

    case NodeTypes.CycleMarkup: {
      const doc: Doc[] = [];

      if (node.groupName) {
        doc.push(path.call(print, 'groupName'), ':');
      }

      const whitespace = node.args.length > 1 ? line : ' ';
      doc.push(
        whitespace,
        join(
          [',', whitespace],
          path.map((p) => print(p), 'args'),
        ),
      );

      return doc;
    }

    case NodeTypes.ForMarkup: {
      const doc = [node.variableName, ' in ', path.call(print, 'collection')];

      if (node.reversed) {
        doc.push(line, 'reversed');
      }

      if (node.args.length > 0) {
        doc.push([
          line,
          join(
            line,
            path.map((p) => print(p), 'args'),
          ),
        ]);
      }

      return doc;
    }

    case NodeTypes.PaginateMarkup: {
      const doc = [
        path.call(print, 'collection'),
        line,
        'by ',
        path.call(print, 'pageSize'),
      ];

      if (node.args.length > 0) {
        doc.push([
          ',',
          line,
          join(
            [',', line],
            path.map((p) => print(p), 'args'),
          ),
        ]);
      }

      return doc;
    }

    case NodeTypes.RenderMarkup: {
      const snippet = path.call(print, 'snippet');
      const doc: Doc = [snippet];
      if (node.variable) {
        const whitespace = node.alias ? line : ' ';
        doc.push(whitespace, path.call(print, 'variable'));
      }
      if (node.alias) {
        doc.push(' ', 'as', ' ', node.alias);
      }
      if (node.args.length > 0) {
        doc.push(
          ',',
          line,
          join(
            [',', line],
            path.map((p) => print(p), 'args'),
          ),
        );
      }
      return doc;
    }

    case NodeTypes.RenderVariableExpression: {
      return [node.kind, ' ', path.call(print, 'name')];
    }

    case NodeTypes.LogicalExpression: {
      return [
        path.call(print, 'left'),
        line,
        node.relation,
        ' ',
        path.call(print, 'right'),
      ];
    }

    case NodeTypes.Comparison: {
      return group([
        path.call(print, 'left'),
        indent([line, node.comparator, ' ', path.call(print, 'right')]),
      ]);
    }

    case NodeTypes.LiquidVariable: {
      const name = path.call(print, 'expression');
      let filters: Doc = '';
      if (node.filters.length > 0) {
        filters = [
          line,
          join(
            line,
            path.map((p) => print(p), 'filters'),
          ),
        ];
      }
      return [name, filters];
    }

    case NodeTypes.LiquidFilter: {
      let args: Doc[] = [];

      if (node.args.length > 0) {
        const printed = path.map((p) => print(p), 'args');
        const shouldPrintFirstArgumentSameLine =
          node.args[0].type !== NodeTypes.NamedArgument;

        if (shouldPrintFirstArgumentSameLine) {
          const [firstDoc, ...rest] = printed;
          const restDoc = isEmpty(rest)
            ? ''
            : indent([',', line, join([',', line], rest)]);
          args = [': ', firstDoc, restDoc];
        } else {
          args = [':', indent([line, join([',', line], printed)])];
        }
      }

      return group(['| ', node.name, ...args]);
    }

    case NodeTypes.NamedArgument: {
      return [node.name, ': ', path.call(print, 'value')];
    }

    case NodeTypes.TextNode: {
      return printTextNode(path as AstPath<TextNode>, options, print);
    }

    case NodeTypes.YAMLFrontmatter: {
      return ['---', hardline, node.body, '---'];
    }

    case NodeTypes.String: {
      const preferredQuote = options.liquidSingleQuote ? `'` : `"`;
      const valueHasQuotes = node.value.includes(preferredQuote);
      const quote = valueHasQuotes
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
      // We prefer null over nil.
      if (node.keyword === 'nil') {
        return 'null';
      }
      return node.keyword;
    }

    case NodeTypes.VariableLookup: {
      const doc: Doc[] = [];
      if (node.name) {
        doc.push(node.name);
      }
      const lookups: Doc[] = path.map((lookupPath, index) => {
        const lookup = lookupPath.getValue() as LiquidExpression;
        switch (lookup.type) {
          case NodeTypes.String: {
            const value = lookup.value;
            // We prefer direct access
            // (for everything but stuff with dashes)
            const isGlobalStringLookup = index === 0 && !node.name;
            if (!isGlobalStringLookup && /^[a-z0-9_]+\??$/i.test(value)) {
              return ['.', value];
            }
            return ['[', print(lookupPath), ']'];
          }
          default: {
            return ['[', print(lookupPath), ']'];
          }
        }
      }, 'lookups');
      return [...doc, ...lookups];
    }

    default: {
      return assertNever(node);
    }
  }
}

const ignoredKeys = new Set([
  'prev',
  'parentNode',
  'next',
  'firstChild',
  'lastChild',
]);

export const printerLiquidHtml: Printer<LiquidHtmlNode> & {
  preprocess: any;
} & { getVisitorKeys: any } = {
  print: printNode,
  embed,
  preprocess,
  getVisitorKeys(node: any, nonTraversableKeys: Set<string>) {
    return Object.keys(node).filter(
      (key) => !nonTraversableKeys.has(key) && !ignoredKeys.has(key),
    );
  },
};
