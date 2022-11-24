import { AstPath, Doc, doc } from 'prettier';
import {
  HtmlComment,
  HtmlNode,
  HtmlSelfClosingElement,
  HtmlVoidElement,
  LiquidHtmlNode,
  LiquidParserOptions,
  LiquidPrinter,
  NodeTypes,
} from '~/types';
import {
  getLastDescendant,
  hasPrettierIgnore,
  isHtmlNode,
  isVoidElement,
  isHtmlElement,
  isLiquidNode,
  isNonEmptyArray,
  isPreLikeNode,
  hasNoCloseMarker,
  isTextLikeNode,
  shouldPreserveContent,
  isSelfClosing,
  isHtmlComment,
  isMultilineLiquidTag,
  hasMeaningfulLackOfLeadingWhitespace,
  hasMeaningfulLackOfTrailingWhitespace,
  last,
} from '~/printer/utils';

const {
  builders: { breakParent, indent, join, line, softline, hardline },
} = doc;
const { replaceTextEndOfLine } = doc.utils as any;

export function printClosingTag(
  node: LiquidHtmlNode,
  options: LiquidParserOptions,
) {
  return [
    hasNoCloseMarker(node) ? '' : printClosingTagStart(node, options),
    printClosingTagEnd(node, options),
  ];
}

export function printClosingTagStart(
  node: LiquidHtmlNode,
  options: LiquidParserOptions,
) {
  return node.lastChild &&
    needsToBorrowParentClosingTagStartMarker(node.lastChild)
    ? ''
    : [
        printClosingTagPrefix(node, options),
        printClosingTagStartMarker(node, options),
      ];
}

export function printClosingTagEnd(
  node: LiquidHtmlNode,
  options: LiquidParserOptions,
) {
  return (
    node.next
      ? needsToBorrowPrevClosingTagEndMarker(node.next)
      : needsToBorrowLastChildClosingTagEndMarker(node.parentNode!)
  )
    ? ''
    : [
        printClosingTagEndMarker(node, options),
        printClosingTagSuffix(node, options),
      ];
}

function printClosingTagPrefix(
  node: LiquidHtmlNode,
  options: LiquidParserOptions,
) {
  return needsToBorrowLastChildClosingTagEndMarker(node)
    ? printClosingTagEndMarker(node.lastChild, options)
    : '';
}

export function printClosingTagSuffix(
  node: LiquidHtmlNode,
  options: LiquidParserOptions,
) {
  return needsToBorrowParentClosingTagStartMarker(node)
    ? printClosingTagStartMarker(node.parentNode, options)
    : needsToBorrowNextOpeningTagStartMarker(node)
    ? printOpeningTagStartMarker(node.next)
    : '';
}

export function printClosingTagStartMarker(
  node: LiquidHtmlNode | undefined,
  options: LiquidParserOptions,
) {
  if (!node) return '';
  /* istanbul ignore next */
  if (shouldNotPrintClosingTag(node, options)) {
    return '';
  }
  switch (node.type) {
    // case 'ieConditionalComment':
    //   return '<!';
    case NodeTypes.HtmlElement:
    case NodeTypes.HtmlRawNode:
      // if (node.hasHtmComponentClosingTag) {
      //   return '<//';
      // }
      if (typeof node.name === 'string') {
        return `</${node.name}`;
      } else if (typeof node.name.markup === 'string') {
        return `</{{ ${node.name.markup.trim()} }}`;
      } else {
        return `</{{ ${node.name.markup.rawSource} }}`;
      }
    default:
      return '';
  }
}

export function printClosingTagEndMarker(
  node: LiquidHtmlNode | undefined,
  options: LiquidParserOptions,
) {
  if (!node) return '';
  if (shouldNotPrintClosingTag(node, options)) {
    return '';
  }

  switch (node.type) {
    // case 'ieConditionalComment':
    // case 'ieConditionalEndComment':
    //   return '[endif]-->';
    // case 'ieConditionalStartComment':
    //   return ']><!-->';
    // case 'interpolation':
    //   return '}}';
    case NodeTypes.HtmlSelfClosingElement: {
      // This looks like it doesn't make sense because it should be part of
      // the printOpeningTagEndMarker but this is handled somewhere else.
      // This function is used to determine what to borrow so the "end" to
      // borrow is actually the other end.
      return '/>';
    }

    default:
      return '>';
  }
}

function shouldNotPrintClosingTag(
  node: LiquidHtmlNode,
  _options: LiquidParserOptions,
) {
  return (
    !hasNoCloseMarker(node) &&
    !(node as any).blockEndPosition &&
    (hasPrettierIgnore(node) || shouldPreserveContent(node.parentNode!))
  );
}

export function needsToBorrowPrevClosingTagEndMarker(node: LiquidHtmlNode) {
  /**
   *     <p></p
   *     >123
   *     ^
   *
   *     <p></p
   *     ><a
   *     ^
   */
  return (
    !isLiquidNode(node) &&
    node.prev &&
    // node.prev.type !== 'docType' &&
    isHtmlNode(node.prev) &&
    hasMeaningfulLackOfLeadingWhitespace(node)
  );
}

export function needsToBorrowLastChildClosingTagEndMarker(
  node: LiquidHtmlNode,
) {
  /**
   *     <p
   *       ><a></a
   *       ></p
   *       ^
   *     >
   */
  return (
    isHtmlNode(node) &&
    node.lastChild &&
    hasMeaningfulLackOfTrailingWhitespace(node.lastChild) &&
    isHtmlNode(getLastDescendant(node.lastChild)) &&
    !isPreLikeNode(node)
  );
}

export function needsToBorrowParentClosingTagStartMarker(node: LiquidHtmlNode) {
  /**
   *     <p>
   *       123</p
   *          ^^^
   *     >
   *
   *         123</b
   *       ></a
   *        ^^^
   *     >
   */
  return (
    isHtmlNode(node.parentNode) &&
    !node.next &&
    hasMeaningfulLackOfTrailingWhitespace(node) &&
    !isLiquidNode(node) &&
    (isTextLikeNode(getLastDescendant(node)) ||
      isLiquidNode(getLastDescendant(node)))
  );
}

export function needsToBorrowNextOpeningTagStartMarker(node: LiquidHtmlNode) {
  /**
   *     123<p
   *        ^^
   *     >
   */
  return (
    node.next &&
    isHtmlNode(node.next) &&
    isTextLikeNode(node) &&
    hasMeaningfulLackOfTrailingWhitespace(node)
  );
}

function getPrettierIgnoreAttributeCommentData(value: string) {
  const match = value.trim().match(/^prettier-ignore-attribute(?:\s+(.+))?$/s);

  if (!match) {
    return false;
  }

  if (!match[1]) {
    return true;
  }

  return match[1].split(/\s+/);
}

export function needsToBorrowParentOpeningTagEndMarker(node: LiquidHtmlNode) {
  /**
   *     <p
   *       >123
   *       ^
   *
   *     <p
   *       ><a
   *       ^
   */
  return (
    isHtmlNode(node.parentNode) &&
    !node.prev &&
    hasMeaningfulLackOfLeadingWhitespace(node) &&
    !isLiquidNode(node)
  );
}

function printAttributes(
  path: AstPath<HtmlNode>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  attrGroupId: symbol,
) {
  const node = path.getValue();
  const { locStart, locEnd } = options;

  if (isHtmlComment(node)) return '';

  if (!isNonEmptyArray(node.attributes)) {
    return isSelfClosing(node)
      ? /**
         *     <br />
         *        ^
         */
        ' '
      : '';
  }

  const ignoreAttributeData =
    node.prev &&
    node.prev.type === NodeTypes.HtmlComment &&
    getPrettierIgnoreAttributeCommentData(node.prev.body);

  const hasPrettierIgnoreAttribute =
    typeof ignoreAttributeData === 'boolean'
      ? () => ignoreAttributeData
      : Array.isArray(ignoreAttributeData)
      ? (attribute: any) => ignoreAttributeData.includes(attribute.rawName)
      : () => false;

  const printedAttributes = path.map((attributePath) => {
    const attribute = attributePath.getValue();
    return hasPrettierIgnoreAttribute(attribute)
      ? replaceTextEndOfLine(
          options.originalText.slice(locStart(attribute), locEnd(attribute)),
        )
      : print(attributePath, { trailingSpaceGroupId: attrGroupId });
  }, 'attributes');

  const forceBreakAttrContent =
    node.attributes &&
    node.attributes.length > 0 &&
    node.source
      .slice(node.blockStartPosition.start, last(node.attributes).position.end)
      .includes('\n');

  const forceNotToBreakAttrContent =
    (options.singleLineLinkTags &&
      typeof node.name === 'string' &&
      node.name === 'link') ||
    ((isSelfClosing(node) ||
      isVoidElement(node) ||
      (isHtmlElement(node) && node.children.length > 0)) &&
      !forceBreakAttrContent &&
      node.attributes &&
      node.attributes.length === 1 &&
      !isLiquidNode(node.attributes[0]));

  const attributeLine = forceNotToBreakAttrContent
    ? ' '
    : options.singleAttributePerLine && node.attributes.length > 1
    ? hardline
    : line;

  const parts: Doc[] = [
    indent([
      forceNotToBreakAttrContent ? ' ' : line,
      forceBreakAttrContent ? breakParent : '',
      join(attributeLine, printedAttributes),
    ]),
  ];

  if (
    /**
     *     123<a
     *       attr
     *           ~
     *       >456
     */
    (node.firstChild &&
      needsToBorrowParentOpeningTagEndMarker(node.firstChild)) ||
    /**
     *     <span
     *       >123<meta
     *                ~
     *     /></span>
     */
    (hasNoCloseMarker(node) &&
      needsToBorrowLastChildClosingTagEndMarker(node.parentNode!)) ||
    forceNotToBreakAttrContent
  ) {
    parts.push(isSelfClosing(node) ? ' ' : '');
  } else {
    parts.push(
      options.bracketSameLine
        ? isSelfClosing(node)
          ? ' '
          : ''
        : isSelfClosing(node)
        ? line
        : softline,
    );
  }

  return parts;
}

function printOpeningTagEnd(node: LiquidHtmlNode) {
  return node.firstChild &&
    needsToBorrowParentOpeningTagEndMarker(node.firstChild)
    ? ''
    : printOpeningTagEndMarker(node);
}

export function printOpeningTag(
  path: AstPath<HtmlNode>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  attrGroupId: symbol,
) {
  const node = path.getValue();

  return [
    printOpeningTagStart(node, options),
    printAttributes(path, options, print, attrGroupId),
    hasNoCloseMarker(node) ? '' : printOpeningTagEnd(node),
  ];
}

export function printOpeningTagStart(
  node: LiquidHtmlNode,
  options: LiquidParserOptions,
) {
  return node.prev && needsToBorrowNextOpeningTagStartMarker(node.prev)
    ? ''
    : [printOpeningTagPrefix(node, options), printOpeningTagStartMarker(node)];
}

export function printOpeningTagPrefix(
  node: LiquidHtmlNode,
  options: LiquidParserOptions,
) {
  return needsToBorrowParentOpeningTagEndMarker(node)
    ? printOpeningTagEndMarker(node.parentNode)
    : needsToBorrowPrevClosingTagEndMarker(node)
    ? printClosingTagEndMarker(node.prev, options)
    : '';
}

// TODO
export function printOpeningTagStartMarker(node: LiquidHtmlNode | undefined) {
  if (!node) return '';
  switch (node.type) {
    // case 'ieConditionalComment':
    // case 'ieConditionalStartComment':
    //   return `<!--[if ${node.condition}`;
    // case 'ieConditionalEndComment':
    //   return '<!--<!';
    // case 'interpolation':
    //   return '{{';
    // case 'docType':
    //   return '<!DOCTYPE';
    case NodeTypes.HtmlComment:
      return '<!--';
    case NodeTypes.HtmlElement:
    case NodeTypes.HtmlSelfClosingElement:
    case NodeTypes.HtmlVoidElement:
    case NodeTypes.HtmlRawNode:
      // if (node.condition) {
      //   return `<!--[if ${node.condition}]><!--><${node.name}`;
      // }
      if (typeof node.name === 'string') {
        return `<${node.name}`;
      } else if (typeof node.name.markup === 'string') {
        return `<{{ ${node.name.markup.trim()} }}`;
      } else {
        return `<{{ ${node.name.markup.rawSource} }}`;
      }
    default:
      return ''; // TODO
  }
}

export function printOpeningTagEndMarker(node: LiquidHtmlNode | undefined) {
  if (!node) return '';
  switch (node.type) {
    // case 'ieConditionalComment':
    //   return ']>';
    case NodeTypes.HtmlComment:
      return '-->';
    case NodeTypes.HtmlSelfClosingElement:
    case NodeTypes.HtmlVoidElement:
      return '';
    case NodeTypes.HtmlElement:
    case NodeTypes.HtmlRawNode:
      return '>';
    default:
      return '>';
  }
}

export function getNodeContent(
  node: Exclude<
    HtmlNode,
    HtmlComment | HtmlVoidElement | HtmlSelfClosingElement
  >,
  options: LiquidParserOptions,
) {
  let start = node.blockStartPosition.end;
  if (
    node.firstChild &&
    needsToBorrowParentOpeningTagEndMarker(node.firstChild)
  ) {
    start -= printOpeningTagEndMarker(node).length;
  }

  let end = node.blockEndPosition.start;
  if (
    node.lastChild &&
    needsToBorrowParentClosingTagStartMarker(node.lastChild)
  ) {
    end += printClosingTagStartMarker(node, options).length;
  } else if (
    node.lastChild &&
    needsToBorrowLastChildClosingTagEndMarker(node)
  ) {
    end -= printClosingTagEndMarker(node.lastChild, options).length;
  }

  return options.originalText.slice(start, end);
}
