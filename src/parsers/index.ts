import { Parsers, liquidHtmlParser, liquidHtmlAstFormat, liquidHtmlLanguageName } from './liquid-html-parser';

export { LiquidHtmlNode, NodeTypes } from './liquid-html-ast';

export { liquidHtmlLanguageName, liquidHtmlAstFormat };

export const parsers: Parsers = {
  [liquidHtmlLanguageName]: liquidHtmlParser,
};
