import { Parser } from 'prettier';
import * as fs from 'fs';
import ohm from 'ohm-js'

const grammar = ohm.grammar(fs.readFileSync('../grammar/liquid-html.ohm', 'utf8'));

interface Parsers {
  [astFormat: string]: Parser;
}

interface LiquidHtmlAST {}
interface LiquidHtmlNode {}

function parse(text: string, _parsers: Parsers, _opts: object): LiquidHtmlAST {
  grammar.trace(text);
  return {}
}

function locStart(node: LiquidHtmlNode): number {
  return 1;
}

function locEnd(node: LiquidHtmlNode): number {
  return 1;
}

const liquidHtmlParser: Parser = {
  parse,
  astFormat: 'liquid-html-ast',
  locStart,
  locEnd,
}

export const parsers = {
  'liquid-html': liquidHtmlParser,
}
