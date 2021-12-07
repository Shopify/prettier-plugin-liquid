import { Parser, ParserOptions } from 'prettier';
import * as fs from 'fs';
import * as path from 'path';
import ohm from 'ohm-js';

import { toLiquidHtmlAST } from './liquid-html-ast';

interface LiquidHtmlAST {}

function parse(
  text: string,
  _parsers: Parsers,
  _opts: ParserOptions<any>,
): LiquidHtmlAST {
  return toLiquidHtmlAST(text);
  // const ohmAST = toLiquidHtmlCST(text);
  // console.log(ohmAST);
  // return ohmAST;
}

function locStart(_node: any) {
  return 1;
}

function locEnd(_node: any) {
  return 1;
}

export const liquidHtmlParser: Parser = {
  parse,
  astFormat: 'liquid-html-ast',
  locStart,
  locEnd,
};

export interface Parsers {
  [astFormat: string]: Parser;
}
