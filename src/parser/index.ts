import {
  Parsers,
  liquidHtmlParser,
  liquidHtmlAstFormat,
  liquidHtmlLanguageName,
} from '~/parser/parser';

export * from '~/parser/ast';

export { liquidHtmlLanguageName, liquidHtmlAstFormat };

export const parsers: Parsers = {
  [liquidHtmlLanguageName]: liquidHtmlParser,
};
