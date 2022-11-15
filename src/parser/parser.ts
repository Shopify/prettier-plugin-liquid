import { Parser, ParserOptions } from 'prettier';
import { locEnd, locStart } from '~/utils';
import { toLiquidHtmlAST, LiquidHtmlNode } from '~/parser/ast';

export function parse(
  text: string,
  _parsers: Parsers,
  _opts: ParserOptions<LiquidHtmlNode>,
): LiquidHtmlNode {
  return toLiquidHtmlAST(text);
}

export const liquidHtmlAstFormat = 'liquid-html-ast';

export const liquidHtmlLanguageName = 'liquid-html';

export const liquidHtmlParser: Parser<LiquidHtmlNode> = {
  parse,
  astFormat: liquidHtmlAstFormat,
  locStart,
  locEnd,
};

export interface Parsers {
  [languageName: string]: Parser;
}
