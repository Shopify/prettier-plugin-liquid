import { expect } from 'chai';
import { deepGet } from '../../parsers/utils';
import { preprocess } from '../print-preprocess';
import { LiquidParserOptions } from '../utils';
import { NodeTypes, toLiquidHtmlAST } from '../../parsers';
import { LiquidHtmlNode } from './types';

describe('Module: augmentWithWhitespaceHelpers', () => {
  describe('Unit: isTrailingWhitespaceSensitive', () => {
    it('should return false when the next node is whitespace stripping to the left', () => {
      const firstChilds = [
        'hello',
        '{{ drop }}',
        '{% if true %}hello{% endif %}',
        '{% echo "hello" %}',
      ];
      const secondChilds = [
        '{{- drop }}',
        '{%- if true %}world{% endif %}',
        '{%- assign x = true %}',
      ];
      for (const left of firstChilds) {
        for (const right of secondChilds) {
          const ast = toAugmentedAst(`<p>${left} ${right}</p>`);
          expectPath(ast, 'children.0.type').to.eql(NodeTypes.HtmlElement);
          expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive')
            .to.be.false;
        }
      }
    });

    it('should return false when the node is whitespace stripping to the right', () => {
      const firstChilds = [
        '{{ drop -}}',
        '{% if true %}world{% endif -%}',
        '{% form %}...{% endform -%}',
        '{% assign x = true -%}',
      ];
      const secondChilds = [
        'hello',
        '{{ drop }}',
        '{% if true %}hello{% endif %}',
        '{% assign x = true %}',
      ];
      for (const left of firstChilds) {
        for (const right of secondChilds) {
          const ast = toAugmentedAst(`<p>${left} ${right}</p>`);
          expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive')
            .to.be.false;
        }
      }
    });

    it('should return false for the document node', () => {
      const ast = toAugmentedAst('');
      expectPath(ast, 'isTrailingWhitespaceSensitive').to.be.false;
    });

    it('should return false for display none elements', () => {
      const ast = toAugmentedAst(
        '<datalist><option value="hello world" /></datalist>',
      );
      expectPath(ast, 'children.0.isTrailingWhitespaceSensitive').to.be.false;
    });

    it('should return true for child nodes of pre-like nodes', () => {
      const wrappers = [
        ['<pre>', '</pre>'],
        ['<textarea>', '</textarea>'],
        ['<plaintext>', '</plaintext>'],
      ];
      const nodes = [
        'hello world',
        '{{ drop }}',
        '{% if true %}world{% endif %}',
        '{% form %}...{% endform %}',
        '{% assign x = true %}',
      ];

      for (const [wrapStart, wrapEnd] of wrappers) {
        for (const node of nodes) {
          const ast = toAugmentedAst(`${wrapStart}${node} ${wrapEnd}`);
          expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive')
            .to.be.true;
        }
      }
    });

    describe('When: the node is the last children of its parent', () => {
      it('should return false for direct children of the document', () => {
        const ast = toAugmentedAst('{{ drop1 }} {{ drop }}');
        expectPath(ast, 'children.1.isTrailingWhitespaceSensitive').to.be.false;
      });

      it('should return false for pre-like nodes', () => {
        const ast = toAugmentedAst(
          '{% form %}hello <pre> ... </pre> {% endform %}',
        );
        expectPath(ast, 'children.0.children.1.isTrailingWhitespaceSensitive')
          .to.be.false;
      });

      it('should return false for last child of block ', () => {
        const ast = toAugmentedAst('<p>hello <span>world</span> </p>');
        expectPath(ast, 'children.0.children.1.isTrailingWhitespaceSensitive')
          .to.be.false;
      });

      it('should return false if the parent is trimming to the inner right', () => {
        const defaultBranch = toAugmentedAst(
          '{% if true %}branch a{%- else %}branch b{% endif %}',
        );
        expectPath(defaultBranch, 'children.0.children.0.type').to.eql(
          NodeTypes.LiquidBranch,
        );
        expectPath(defaultBranch, 'children.0.children.0.name').to.eql(null);
        expectPath(
          defaultBranch,
          'children.0.children.0.children.0.isTrailingWhitespaceSensitive',
        ).to.be.false;

        const elseTest = toAugmentedAst(
          '{% if true %}branch a{% else %}branch b{%- endif %}',
        );
        expectPath(elseTest, 'children.0.children.1.type').to.eql(
          NodeTypes.LiquidBranch,
        );
        expectPath(elseTest, 'children.0.children.1.name').to.eql('else');
        expectPath(
          elseTest,
          'children.0.children.1.children.0.isTrailingWhitespaceSensitive',
        ).to.be.false;

        const blockTest = toAugmentedAst('{% form %}branch a{%- endform %}');
        expectPath(
          blockTest,
          'children.0.children.0.isTrailingWhitespaceSensitive',
        ).to.be.false;
      });
    });

    it('should return false if the next child is not whitespace sensitive to the outer left', () => {
      const ast = toAugmentedAst('<p>Hello <div> world </div></p>');
      expectPath(ast, 'children.0.children.0.type').to.eql(NodeTypes.TextNode);
      expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive').to
        .be.false;
    });
  });

  function toAugmentedAst(
    code: string,
    options: Partial<LiquidParserOptions> = {},
  ) {
    return preprocess(toLiquidHtmlAST(code), options as LiquidParserOptions);
  }

  function expectPath(ast: LiquidHtmlNode, path: string) {
    return expect(deepGet(path.split('.'), ast));
  }
});
