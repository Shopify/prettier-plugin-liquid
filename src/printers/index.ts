import { printerLiquidHtml } from './printer-liquid-html';
import { liquidHtmlAstFormat } from '../parsers';

export const printers = {
  [liquidHtmlAstFormat]: printerLiquidHtml,
};
