import {
  Parsers,
  liquidHtmlParser,
  liquidHtmlAstFormat,
  liquidHtmlLanguageName,
} from '~/parser/parser';

export * from '~/parser/stage-2-ast';

export { liquidHtmlLanguageName, liquidHtmlAstFormat };

export const parsers: Parsers = {
  [liquidHtmlLanguageName]: liquidHtmlParser,
};
