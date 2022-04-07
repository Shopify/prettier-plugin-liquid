import {
  Parsers,
  liquidHtmlParser,
  liquidHtmlAstFormat,
  liquidHtmlLanguageName,
} from './parser';

export * from './ast';

export { liquidHtmlLanguageName, liquidHtmlAstFormat };

export const parsers: Parsers = {
  [liquidHtmlLanguageName]: liquidHtmlParser,
};
