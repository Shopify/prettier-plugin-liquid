import { Printer, doc } from 'prettier';
import { RawMarkupKinds } from '~/parser';
import { LiquidHtmlNode, LiquidParserOptions, NodeTypes } from '~/types';

// null will pass through
export const ParserMap: { [key in RawMarkupKinds]: string | null } = {
  [RawMarkupKinds.css]: 'css',
  [RawMarkupKinds.html]: null,
  [RawMarkupKinds.javascript]: 'babel',
  [RawMarkupKinds.json]: 'json',
  [RawMarkupKinds.markdown]: 'markdown',
  [RawMarkupKinds.typescript]: 'typescript',
  [RawMarkupKinds.text]: null,
};

export const embed: Printer<LiquidHtmlNode>['embed'] = (
  path,
  _print,
  textToDoc,
  options,
) => {
  const node = path.getValue();
  switch (node.type) {
    case NodeTypes.RawMarkup: {
      const parser = ParserMap[node.kind];
      if (parser && node.value.trim() !== '') {
        return doc.utils.stripTrailingHardline(
          textToDoc(node.value, {
            ...options,
            singleQuote: (options as LiquidParserOptions).embeddedSingleQuote,
            parser,
            __embeddedInHtml: true,
          }),
        );
      }
    }
    default:
      return null;
  }
};
