import { expect } from 'chai';
import { toLiquidHtmlAST, LiquidHtmlAST } from './liquid-html-ast';
import * as R from 'ramda';

describe('Unit: toLiquidHtmlAST', () => {
  it('should transform a basic Liquid Drop into a LiquidDrop', () => {
    const ast = toLiquidHtmlAST('{{ name }}');
    expectPath(ast, '0').to.exist;
    expectPath(ast, '0.type').to.eql('LiquidDrop');
    expectPath(ast, '0.markup').to.eql(' name ');
    expectPosition(ast, '0');
  });

  it('should transform a basic Liquid Tag into a LiquidTag', () => {
    const ast = toLiquidHtmlAST('{% name %}');
    expectPath(ast, '0').to.exist;
    expectPath(ast, '0.type').to.eql('LiquidTag');
    expectPath(ast, '0.name').to.eql('name');
    expectPath(ast, '0.markup').to.eql('');
    expectPath(ast, '0.children').to.be.undefined;
    expectPosition(ast, '0');
  });

  it('should parse a basic text node into a TextNode', () => {
    const ast = toLiquidHtmlAST('Hello world!');
    expectPath(ast, '0').to.exist;
    expectPath(ast, '0.type').to.eql('TextNode');
    expectPath(ast, '0.value').to.eql('Hello world!');
    expectPosition(ast, '0');
  });

  it('should parse HTML attributes', () => {
    const ast = toLiquidHtmlAST(`<img src="https://1234" loading='lazy' disabled>`);
    expectPath(ast, '0').to.exist;
    expectPath(ast, '0.type').to.eql('VoidElementNode');
    expectPath(ast, '0.name').to.eql('img');
    expectPath(ast, '0.attributes.0.name').to.eql('src');
    expectPath(ast, '0.attributes.0.value.0.type').to.eql('TextNode');
    expectPath(ast, '0.attributes.0.value.0.value').to.eql('https://1234');
    expectPath(ast, '0.attributes.1.name').to.eql('loading');
    expectPath(ast, '0.attributes.1.value.0.type').to.eql('TextNode');
    expectPath(ast, '0.attributes.1.value.0.value').to.eql('lazy');
    expectPath(ast, '0.attributes.2.name').to.eql('disabled');

    expectPosition(ast, '0');
    expectPosition(ast, '0.attributes.0');
    expectPosition(ast, '0.attributes.0.value.0');
    expectPosition(ast, '0.attributes.1');
    expectPosition(ast, '0.attributes.1.value.0');
    expectPosition(ast, '0.attributes.2');
  });

  it('should parse liquid ifs', () => {
    const ast = toLiquidHtmlAST(`{% if A %}A{% elsif B %}B{% else %}C{% endif %}`);
    expectPath(ast, '0').to.exist;
  });

  function expectPath(ast: LiquidHtmlAST, path: string) {
    return expect(R.path(path.split('.'), ast));
  }

  function expectPosition(ast: LiquidHtmlAST, path: string) {
    expectPath(ast, path + '.position.start').to.be.a('number');
    expectPath(ast, path + '.position.end').to.be.a('number');
  }
});
