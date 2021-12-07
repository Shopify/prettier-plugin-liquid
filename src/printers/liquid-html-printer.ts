import { Printer, doc } from 'prettier';
import { LiquidHtmlNode, NodeTypes } from '../parsers';

const { builders } = doc;

export const liquidHtmlPrinter: Printer<LiquidHtmlNode> = {
  print(path, _options, print) {
    const node = path.getValue();
    switch (node.type) {
      case NodeTypes.Document: {
        return path.map(print, "children");
      }
      default: {
        return node.type;
      }
    }
  },
}
