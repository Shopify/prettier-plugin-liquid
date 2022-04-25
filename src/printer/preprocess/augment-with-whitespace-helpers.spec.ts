import { expect } from 'chai';
import { deepGet } from '../../utils';
import { NodeTypes } from '../../types';
import { toLiquidHtmlAST } from '../../parser';
import { preprocess } from '../print-preprocess';
import { DocumentNode, LiquidHtmlNode, LiquidParserOptions } from '../../types';

describe('Module: augmentWithWhitespaceHelpers', () => {
  let ast: DocumentNode;

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
          ast = toAugmentedAst(`<p>${left} ${right}</p>`);
          expectPath(ast, 'children.0.type').to.eql(NodeTypes.HtmlElement);
          expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive').to.be.false;
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
          ast = toAugmentedAst(`<p>${left} ${right}</p>`);
          expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive').to.be.false;
        }
      }
    });

    it('should return true when an inline formatting context is implied because the next node is a text node', () => {
      ast = toAugmentedAst('<p>hello {{ drop }}</p>');
      expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive').to.be.true;

      ast = toAugmentedAst('<p>{{ drop }}hello</p>');
      expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive').to.be.true;
    });

    it('should return false when a block formatting context is implied because of the current node', () => {
      ast = toAugmentedAst('<p><div>hello</div> {{ drop }}</p>');
      expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive').to.be.false;
    });

    it('should return false for the document node', () => {
      ast = toAugmentedAst('');
      expectPath(ast, 'isTrailingWhitespaceSensitive').to.be.false;
    });

    it('should return false for display none elements', () => {
      ast = toAugmentedAst('<datalist><option value="hello world" /></datalist>');
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
          ast = toAugmentedAst(`${wrapStart}${node} ${wrapEnd}`);
          expectPath(
            ast,
            'children.0.children.0.isTrailingWhitespaceSensitive',
            `${wrapStart}${node} ${wrapEnd}`,
          ).to.be.true;
        }
      }
    });

    describe('When: the node is the last children of its parent', () => {
      it('should return false for direct children of the document', () => {
        ast = toAugmentedAst('{{ drop1 }} {{ drop }}');
        expectPath(ast, 'children.1.isTrailingWhitespaceSensitive').to.be.false;
      });

      it('should return false for pre-like nodes', () => {
        ast = toAugmentedAst('{% form %}hello <pre> ... </pre> {% endform %}');
        expectPath(ast, 'children.0.children.1.isTrailingWhitespaceSensitive').to.be.false;
      });

      it('should return false for last child of block ', () => {
        ast = toAugmentedAst('<p>hello <span>world</span> </p>');
        expectPath(ast, 'children.0.children.1.isTrailingWhitespaceSensitive').to.be.false;
      });

      it('should return false if the parent is trimming to the inner right', () => {
        ast = toAugmentedAst('{% if true %}branch a{%- else %}branch b{% endif %}');
        expectPath(ast, 'children.0.children.0.type').to.eql(NodeTypes.LiquidBranch);
        expectPath(ast, 'children.0.children.0.name').to.eql(null);
        expectPath(ast, 'children.0.children.0.children.0.isTrailingWhitespaceSensitive').to.be
          .false;

        ast = toAugmentedAst('{% if true %}branch a{% else %}branch b{%- endif %}');
        expectPath(ast, 'children.0.children.1.type').to.eql(NodeTypes.LiquidBranch);
        expectPath(ast, 'children.0.children.1.name').to.eql('else');
        expectPath(ast, 'children.0.children.1.children.0.isTrailingWhitespaceSensitive').to.be
          .false;

        ast = toAugmentedAst('{% form %}branch a{%- endform %}');
        expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive').to.be.false;
      });
    });

    it('should return false if the next child is not whitespace sensitive to the outer left', () => {
      const blocks = ['<div> world </div>', '{% form %} hello {% endform %}'];
      for (const block of blocks) {
        ast = toAugmentedAst(`<p>Hello ${block}</p>`);
        expectPath(ast, 'children.0.children.0.type').to.eql(NodeTypes.TextNode);
        expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive').to.be.false;
      }
    });
  });

  describe('Unit: isLeadingWhitespaceSensitive', () => {
    it('should return true when this node and the prev imply an inline formatting context', () => {
      const nodes = ['<span>hello</span>', '{{ drop }}', '{% if true %}hello{% endif %}'];

      for (const left of nodes) {
        for (const right of nodes) {
          ast = toAugmentedAst(`<p>${left} ${right}</p>`);
          expectPath(ast, 'children.0.children.1.isLeadingWhitespaceSensitive', `${left} ${right}`)
            .to.be.true;
        }
      }
    });

    it('should return false when this node is whitespace stripping to the left', () => {
      const firstChilds = ['hello', '{{ drop }}', '{% if true %}hello{% endif %}'];
      const secondChilds = ['{{- drop }}', '{%- echo "world" %}', '{%- if true %}hello{% endif %}'];
      for (const left of firstChilds) {
        for (const right of secondChilds) {
          ast = toAugmentedAst(`<p>${left} ${right}</p>`);
          expectPath(ast, 'children.0.children.1.isLeadingWhitespaceSensitive').to.be.false;
        }
      }
    });

    it('should return false when the previous node is whitespace stripping to the right', () => {
      const firstChilds = ['{{ drop -}}', '{% echo "world" -%}', '{% if true %}hello{% endif -%}'];
      const secondChilds = ['hello', '{{ drop }}', '{% if true %}hello{% endif %}'];
      for (const left of firstChilds) {
        for (const right of secondChilds) {
          ast = toAugmentedAst(`<p>${left} ${right}</p>`);
          expectPath(ast, 'children.0.children.1.isLeadingWhitespaceSensitive', `${left} ${right}`)
            .to.be.false;
        }
      }
    });

    it('should return false for the document node', () => {
      ast = toAugmentedAst('');
      expectPath(ast, 'isLeadingWhitespaceSensitive').to.be.false;
    });

    it('should return false for display none elements', () => {
      ast = toAugmentedAst('<datalist><option value="hello world" /></datalist>');
      expectPath(ast, 'children.0.isLeadingWhitespaceSensitive').to.be.false;
    });

    describe('When: the node is the first child', () => {
      it('should return false when its parent is the DocumentNode', () => {
        ast = toAugmentedAst('<p></p>');
        expectPath(ast, 'children.0.isLeadingWhitespaceSensitive').to.be.false;
      });

      it('should return false when it is pre-like', () => {
        ast = toAugmentedAst('<span> <pre></pre></span>');
        expectPath(ast, 'children.0.children.0.isLeadingWhitespaceSensitive').to.be.false;
      });

      it('should return false if the parent strips whitespace from both ends', () => {
        const nodes = [
          'hello',
          '<span>hello</span>',
          '{{ drop }}',
          '{% if true %}hello{% endif %}',
        ];
        for (const node of nodes) {
          ast = toAugmentedAst(`<p> ${node} </p>`);
          expectPath(ast, 'children.0.children.0.isLeadingWhitespaceSensitive').to.be.false;
        }
      });

      it('should return false if the parent is whitespace stripping to the inner right', () => {
        const nodes = [
          'hello',
          '<span>hello</span>',
          '{{ drop }}',
          '{% if true %}hello{% endif %}',
        ];
        for (const node of nodes) {
          ast = toAugmentedAst(`{% form -%} ${node} {% endform %}`);
          expectPath(ast, 'children.0.children.0.isLeadingWhitespaceSensitive').to.be.false;

          ast = toAugmentedAst(`{% if A -%} ${node} {% endif %}`);
          expectPath(ast, 'children.0.children.0.type').to.eql(NodeTypes.LiquidBranch);
          expectPath(ast, 'children.0.children.0.isLeadingWhitespaceSensitive').to.be.false;
          expectPath(ast, 'children.0.children.0.children.0.isLeadingWhitespaceSensitive').to.be
            .false;

          ast = toAugmentedAst(`{% if A %}hello{% else -%} ${node}{% endif %}`);
          expectPath(ast, 'children.0.children.1.type').to.eql(NodeTypes.LiquidBranch);
          expectPath(ast, 'children.0.children.1.isLeadingWhitespaceSensitive').to.be.true;
          expectPath(ast, 'children.0.children.1.children.0.isLeadingWhitespaceSensitive').to.be
            .false;

          ast = toAugmentedAst(`{% if A %} hello {%- else -%} ${node} {% endif %}`);
          expectPath(ast, 'children.0.children.1.type').to.eql(NodeTypes.LiquidBranch);
          expectPath(ast, 'children.0.children.1.isLeadingWhitespaceSensitive').to.be.false;
        }
      });
    });

    it('should return false if the previous node creates a block rendering context that makes the following whitespace irrelevant', () => {
      ast = toAugmentedAst('<p><div>hello</div> this</p>');
      expectPath(ast, 'children.0.children.1.isLeadingWhitespaceSensitive').to.be.false;
    });

    it('should return false if the node itself creates a block rendering context', () => {
      ast = toAugmentedAst('<p>this <div>hello</div></p>');
      expectPath(ast, 'children.0.children.1.isLeadingWhitespaceSensitive').to.be.false;
    });
  });

  describe('Unit: hasDanglingWhitespace', () => {
    it('should handle LiquidBranch tags properly', () => {
      ast = toAugmentedAst('{% if true %} {% endif %}');
      // The if tag itself is not dangling, it has branches
      expectPath(ast, 'children.0.hasDanglingWhitespace').to.be.false;

      // The default branch has dangling whitespace though
      expectPath(ast, 'children.0.children.0.type').to.eql(NodeTypes.LiquidBranch);
      expectPath(ast, 'children.0.children.0.hasDanglingWhitespace').to.be.true;

      // same goes for else tags
      ast = toAugmentedAst('{% if true %} {% else %} {% endif %}');
      expectPath(ast, 'children.0.hasDanglingWhitespace').to.be.false;
      expectPath(ast, 'children.0.children.0.type').to.eql(NodeTypes.LiquidBranch);
      expectPath(ast, 'children.0.children.0.hasDanglingWhitespace').to.be.true;
      expectPath(ast, 'children.0.children.1.type').to.eql(NodeTypes.LiquidBranch);
      expectPath(ast, 'children.0.children.1.hasDanglingWhitespace').to.be.true;

      // reports false when branch is empty
      ast = toAugmentedAst('{% if true %}{% else %}{% endif %}');
      expectPath(ast, 'children.0.hasDanglingWhitespace').to.be.false;
      expectPath(ast, 'children.0.children.0.type').to.eql(NodeTypes.LiquidBranch);
      expectPath(ast, 'children.0.children.0.hasDanglingWhitespace').to.be.false;
      expectPath(ast, 'children.0.children.1.type').to.eql(NodeTypes.LiquidBranch);
      expectPath(ast, 'children.0.children.1.hasDanglingWhitespace').to.be.false;
    });

    it('should work for LiquidTags', () => {
      ast = toAugmentedAst('{% form %} {% endform %}');
      expectPath(ast, 'children.0.hasDanglingWhitespace').to.be.true;

      ast = toAugmentedAst('{% form %}{% endform %}');
      expectPath(ast, 'children.0.hasDanglingWhitespace').to.be.false;
    });

    it('should work for HtmlElements', () => {
      ast = toAugmentedAst('<p> </p>');
      expectPath(ast, 'children.0.hasDanglingWhitespace').to.be.true;

      ast = toAugmentedAst('<p></p>');
      expectPath(ast, 'children.0.hasDanglingWhitespace').to.be.false;
    });
  });

  describe('Unit: isDanglingWhitespaceSensitive', () => {
    it('should return true for inline elements', () => {
      ast = toAugmentedAst('<span> </span>');
      expectPath(ast, 'children.0.isDanglingWhitespaceSensitive').to.be.true;
    });

    it('should return false for block elements', () => {
      ast = toAugmentedAst('<p> </p>');
      expectPath(ast, 'children.0.isDanglingWhitespaceSensitive').to.be.false;
    });

    it('should return true for LiquidBranch tags', () => {
      ast = toAugmentedAst('{% if A %} {% endif %}');
      expectPath(ast, 'children.0.children.0.isDanglingWhitespaceSensitive').to.be.true;
    });

    it('should return false for LiquidBranch tags that are whitespace stripped', () => {
      ast = toAugmentedAst('{% if A -%} {% endif %}');
      expectPath(ast, 'children.0.children.0.isDanglingWhitespaceSensitive').to.be.false;
      ast = toAugmentedAst('{% if A %} {%- endif %}');
      expectPath(ast, 'children.0.children.0.isDanglingWhitespaceSensitive').to.be.false;
    });

    it('should return false for script-like tags', () => {
      const tags = ['script', 'style'];
      for (const tag of tags) {
        ast = toAugmentedAst(`<${tag}> </${tag}>`);
        expectPath(ast, 'children.0.isDanglingWhitespaceSensitive').to.be.false;
      }
    });
  });

  function toAugmentedAst(code: string, options: Partial<LiquidParserOptions> = {}) {
    const ast = toLiquidHtmlAST(code);
    options.originalText = ast.source;
    options.locStart = (node: LiquidHtmlNode) => node.position.start;
    options.locEnd = (node: LiquidHtmlNode) => node.position.end;
    return preprocess(ast, options as LiquidParserOptions);
  }

  function expectPath(ast: LiquidHtmlNode, path: string, message?: string) {
    return expect(deepGet(path.split('.'), ast), message);
  }
});
