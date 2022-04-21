import { LiquidHtmlNode } from '../preprocess';
import { Doc, AstPath, ParserOptions } from 'prettier';

export type LiquidAstPath = AstPath<LiquidHtmlNode>;
export type LiquidParserOptions = ParserOptions<LiquidHtmlNode>;
export type LiquidPrinter = (
  path: AstPath<LiquidHtmlNode>,
  parentGroupId?: symbol,
) => Doc;
