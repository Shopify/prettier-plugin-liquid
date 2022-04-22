import { printerLiquidHtml } from './printer-liquid-html';
import { liquidHtmlAstFormat } from '../parser';

export const printers = {
  [liquidHtmlAstFormat]: printerLiquidHtml,
};
