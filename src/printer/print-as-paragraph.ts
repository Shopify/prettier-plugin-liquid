import { Doc, doc } from 'prettier';
import { assertNever } from '~/utils';
import { FORCE_FLAT_GROUP_ID, intersperse } from '~/printer/utils';
import {
  NodeTypes,
  LiquidHtmlNode,
  LiquidAstPath,
  LiquidParserOptions,
  LiquidPrinter,
} from '~/types';

const { builders } = doc;
const { fill, line, softline } = builders;

type Chunk = DocsChunk | WhitespaceChunk | DocChunk;

enum ChunkTypes {
  WHITESPACE = 'whitespace', // a whitespace doc
  DOCS = 'docs', // array of doc
  DOC = 'raw', // just a doc
}

interface WhitespaceChunk {
  type: ChunkTypes.WHITESPACE;
  value: Doc;
}

interface DocsChunk {
  type: ChunkTypes.DOCS;
  doc: Doc[];
}

interface DocChunk {
  type: ChunkTypes.DOC;
  value: Doc;
}

class ParagraphBuilder {
  private chunks: (DocsChunk | WhitespaceChunk)[] = [];

  get last(): Chunk | undefined {
    return this.chunks[this.chunks.length - 1];
  }

  // The logic we want here is the following:
  // - whenever we push whitespace, we push whitespace.
  // - we group subsequent pushes into an array
  //
  // So that at the end of the day, you have
  // [doc, whitespace, doc, whitespace, doc, whitespace]
  push(chunk: Exclude<Chunk, DocsChunk>) {
    // if whitespace
    if (chunk.type === ChunkTypes.WHITESPACE) {
      return this.chunks.push(chunk);
    }

    // initialize the doc array if it wasn't already
    if (!this.last || this.last.type === ChunkTypes.WHITESPACE) {
      this.chunks.push({
        type: ChunkTypes.DOCS,
        doc: [],
      });
    }

    // push to it
    if (this.last && this.last.type === ChunkTypes.DOCS) {
      this.last.doc.push(chunk.value);
    }
  }

  // Convert back into a doc the intermediate representation that made the
  // code slightly easier to follow/code. (Is it really?)
  asDoc(): Doc[] {
    return this.chunks.map((chunk) => {
      switch (chunk.type) {
        case ChunkTypes.WHITESPACE:
          return chunk.value;
        case ChunkTypes.DOCS:
          return chunk.doc;
        default:
          return assertNever(chunk);
      }
    });
  }
}

const LIQUID_SENSITIVE_NODE_TYPES = [
  NodeTypes.LiquidDrop,
  NodeTypes.HtmlElement,
];

function isWhitespaceSensitive(node: LiquidHtmlNode) {
  return LIQUID_SENSITIVE_NODE_TYPES.includes(node.type);
}

/**
 * This function takes a node (assuming it has at least one TextNode
 * children) and reindents its children as a paragraph while maintaining
 * whitespace (if there is some) between adjacent nodes. And sometimes
 * forcing nodes to be adjacent to one another when nodes are "missing
 * whitespace"-sensitive (e.g. HTMLElement & to avoid weird LiquidDrops)
 *
 * Things we want:
 *
 * <p>
 *   a paragraph with {% if c %}inline{% endif %} liquid that
 *   {%- if true %}
 *      would break tags on new lines
 *   {% endif -%}
 *   even if there wasn't spaces around the tag. But would make
 *   sure that something like
 *   (======={{ product.price }}) is dropped as a "chunk." because
 *   doing something like (========
 *   {{- product.price -}}
 *   ) would look awkward as hell.
 * </p>
 *
 * <p>
 *   Similarly, letters in the middle of a word that we want to
 *   em<em>phasize</em> should come out as a "chunk". Because em
 *   <em>phasize</em> would not produce the same result.
 * </p>
 *
 * This has got to have been the hardest thing to nail. And I'm not even
 * 100% sure that it covers all cases.
 */
export function printAsParagraph(
  path: LiquidAstPath,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  property: string,
): Doc {
  const { locStart, locEnd } = options;
  let curr: LiquidHtmlNode | null = null;
  let prev: LiquidHtmlNode | null = null;

  const builder = new ParagraphBuilder();

  path.each((path) => {
    curr = path.getValue();

    // This part conditionally adds line | softline between child nodes of
    // different types. We don't want to add softline between whitespace
    // sensitive nodes because it might cause a weird output. We'll let the
    // builder "force" those to be next to each other.
    if (curr && prev) {
      if (
        locStart(curr) === locEnd(prev) &&
        !isWhitespaceSensitive(curr) &&
        !isWhitespaceSensitive(prev)
      ) {
        builder.push({
          type: ChunkTypes.WHITESPACE,
          value: softline,
        });
      } else if (locStart(curr) > locEnd(prev)) {
        builder.push({
          type: ChunkTypes.WHITESPACE,
          value: line,
        });
      }
    }

    // This part splits the text nodes into words and adds them to the
    // "fill" individually.
    if (curr.type === NodeTypes.TextNode) {
      const wordChunks: DocChunk[] = curr.value
        .split(/\s+/)
        .map((word) => ({ type: ChunkTypes.DOC, value: word }));
      const chunks = intersperse<DocChunk | WhitespaceChunk>(wordChunks, {
        type: ChunkTypes.WHITESPACE,
        value: line,
      });

      for (const chunk of chunks) {
        builder.push(chunk);
      }
    } else {
      builder.push({
        type: ChunkTypes.DOC,
        value: print(
          path,
          isWhitespaceSensitive(curr) ? FORCE_FLAT_GROUP_ID : undefined,
        ),
      });
    }

    prev = curr;
  }, property);

  return fill(builder.asDoc());
}
