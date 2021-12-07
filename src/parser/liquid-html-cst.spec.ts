import { expect } from 'chai';
import * as R from 'ramda';
import {
  LiquidHtmlCST,
  toLiquidHtmlCST,
} from './liquid-html-cst';
import { BLOCKS } from './grammar';

describe('Unit: toLiquidHtmlCST(text)', () => {
  describe('Case: HtmlNode', () => {
    it('should basically parse open and close tags', () => {
      ['<div></div>', '<div ></div >'].forEach((text) => {
        const ast = toLiquidHtmlCST(text);
        expect(R.path([0, 'type'], ast)).to.equal('TagOpen');
        expect(R.path([0, 'name'], ast)).to.equal('div');
        expect(R.path([1, 'type'], ast)).to.equal('TagClose');
        expect(R.path([1, 'name'], ast)).to.equal('div');
        expectLocation(ast, [0]);
        expectLocation(ast, [1]);
      });
    });

    it('should parse empty attributes', () => {
      ['<div empty>', '<div empty >', '<div\nempty\n>'].forEach(
        (text) => {
          const ast = toLiquidHtmlCST(text);
          expect(R.path([0, 'attrList', 0, 'type'], ast)).to.equal(
            'AttrEmpty',
          );
          expect(R.path([0, 'attrList', 0, 'name'], ast)).to.equal(
            'empty',
          );
          expect(R.path([0, 'name', 'attrList', 0, 'value'], ast)).to
            .be.undefined;
          expectLocation(ast, [0]);
          expectLocation(ast, [0, 'attrList', 0]);
        },
      );
    });

    [
      { type: 'AttrSingleQuoted', name: 'single', quote: "'" },
      { type: 'AttrDoubleQuoted', name: 'double', quote: '"' },
      { type: 'AttrUnquoted', name: 'unquoted', quote: '' },
    ].forEach((testConfig) => {
      it(`should parse ${testConfig.type} attributes`, () => {
        [
          `<div ${testConfig.name}=${testConfig.quote}${testConfig.name}${testConfig.quote}>`,
          `<div ${testConfig.name}=${testConfig.quote}${testConfig.name}${testConfig.quote} >`,
          `<div\n${testConfig.name}=${testConfig.quote}${testConfig.name}${testConfig.quote}\n>`,
        ].forEach((text) => {
          const ast = toLiquidHtmlCST(text);
          expect(R.path([0, 'attrList', 0, 'type'], ast)).to.equal(
            testConfig.type,
          );
          expect(R.path([0, 'attrList', 0, 'name'], ast)).to.equal(
            testConfig.name,
          );
          expect(R.path([0, 'attrList', 0, 'value', 0, 'type'], ast)).to.eql(
            'TextNode'
          );
          expect(R.path([0, 'attrList', 0, 'value', 0, 'value'], ast)).to.eql(
            testConfig.name
          );
          expectLocation(ast, [0]);
          expectLocation(ast, [0, 'attrList', 0]);
        });
      });

      it(`should accept liquid nodes inside ${testConfig.type}`, () => {
        [
          `<div ${testConfig.name}=${testConfig.quote}https://{{ name }}${testConfig.quote}>`,
          `<div ${testConfig.name}=${testConfig.quote}https://{{ name }}${testConfig.quote} >`,
          `<div\n${testConfig.name}=${testConfig.quote}https://{{ name }}${testConfig.quote}\n>`,
        ].forEach((text) => {
          const ast = toLiquidHtmlCST(text);
          expect(
            R.path([0, 'attrList', 0, 'value', 1, 'type'], ast),
          ).to.eql('LiquidDrop', text);
          expectLocation(ast, [0]);
          expectLocation(ast, [0, 'attrList', 0]);
        });
      });
    });
  });

  describe('Case: LiquidNode', () => {
    it('should basically parse liquid drops', () => {
      const ast = toLiquidHtmlCST('{{ name }}{{- names -}}');
      expect(R.path([0, 'type'], ast)).to.equal('LiquidDrop');
      expect(R.path([0, 'markup'], ast)).to.equal(' name ');
      expectPath(ast, '0.whitespaceStart').to.equal(null);
      expectPath(ast, '0.whitespaceEnd').to.equal(null);
      expectPath(ast, '1.whitespaceStart').to.equal('-');
      expectPath(ast, '1.whitespaceEnd').to.equal('-');
      expectLocation(ast, [0]);
    });

    it('should basically parse liquid tags', () => {
      const ast = toLiquidHtmlCST('{%   assign x = 1 %}{%- echo hi -%}');
      expect(R.path([0, 'type'], ast)).to.equal('LiquidTag');
      expect(R.path([0, 'name'], ast)).to.equal('assign');
      expect(R.path([0, 'markup'], ast)).to.equal('x = 1 ');
      expectPath(ast, '0.whitespaceStart').to.equal(null)
      expectPath(ast, '0.whitespaceEnd').to.equal(null)
      expect(R.path([1, 'type'], ast)).to.equal('LiquidTag');
      expect(R.path([1, 'name'], ast)).to.equal('echo');
      expect(R.path([1, 'markup'], ast)).to.equal('hi ');
      expectPath(ast, '1.whitespaceStart').to.equal("-")
      expectPath(ast, '1.whitespaceEnd').to.equal("-")
      expectLocation(ast, [0]);
    });

    it('should parse tag open / close', () => {
      BLOCKS.forEach(block => {
        const ast = toLiquidHtmlCST(`{% ${block} args -%}{%- end${block} %}`);
        expectPath(ast, '0.type').to.equal('LiquidTagOpen')
        expectPath(ast, '0.name').to.equal(block)
        expectPath(ast, '0.whitespaceStart').to.equal(null)
        expectPath(ast, '0.whitespaceEnd').to.equal("-")
        expectPath(ast, '0.markup').to.equal('args ')
        expectPath(ast, '1.type').to.equal('LiquidTagClose')
        expectPath(ast, '1.name').to.equal(block)
        expectPath(ast, '1.whitespaceStart').to.equal("-")
        expectPath(ast, '1.whitespaceEnd').to.equal(null)
      })
    })
  });

  describe('Case: TextNode', () => {
    it('should parse text nodes', () => {
      [
        '<div>hello</div>',
        '{% if condition %}hello{% endif %}',
      ].forEach((text) => {
        const ast = toLiquidHtmlCST(text);
        expect(R.path([1, 'type'], ast)).to.equal('TextNode');
        expect(R.path([1, 'value'], ast)).to.equal('hello');
        expectLocation(ast, [1]);
      });
    });
  });

  function expectLocation(
    ast: LiquidHtmlCST,
    path: (string | number)[],
  ) {
    expect(R.path(path.concat('locStart'), ast)).to.be.a('number');
    expect(R.path(path.concat('locEnd'), ast)).to.be.a('number');
  }

  function expectPath(
    ast: LiquidHtmlCST,
    path: string,
  ) {
    return expect(R.path(path.split('.'), ast));
  }
});
