import { liquidHtmlPrinter } from './liquid-html-printer';
import { liquidHtmlAstFormat } from '../parsers';

export const printers = {
  [liquidHtmlAstFormat]: liquidHtmlPrinter,
};
