import { Plugin } from 'prettier';
import { parsers, liquidHtmlLanguageName } from './parser';
import { printers } from './printer';
import { LiquidHtmlNode } from './types';

const languages = [
  {
    name: 'LiquidHTML',
    parsers: [liquidHtmlLanguageName],
    extensions: ['.liquid'],
    vscodelanguageIds: ['liquid', 'Liquid'],
  },
];

const options = {};
const defaultOptions = {};

const plugin: Plugin<LiquidHtmlNode> = {
  languages,
  parsers,
  printers,
  options,
  defaultOptions,
};

export = plugin;
