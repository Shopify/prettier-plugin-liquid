import { Plugin } from 'prettier';
import {
  parsers,
  LiquidHtmlNode,
  liquidHtmlLanguageName,
} from './parsers';
import { printers } from './printers';

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
