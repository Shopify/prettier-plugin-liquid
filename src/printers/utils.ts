import {LiquidHtmlNode, NodeTypes} from "../parsers";
import {assertNever} from "../utils";

export function isWhitespace(source: string, loc: number): boolean {
  if (loc < 0 || loc >= source.length) return true;
  return !!source[loc].match(/\s/);
}

export function getChildrenArray(node: LiquidHtmlNode, parentNode: LiquidHtmlNode) {
  switch (parentNode.type) {
    case NodeTypes.LiquidTag:
    case NodeTypes.Document:
    case NodeTypes.LiquidBranch:
      return parentNode.children;
    case NodeTypes.HtmlElement:
      if (parentNode.attributes.indexOf(node as any) !== -1) {
        return parentNode.attributes;
      } else if (parentNode.children) {
        return parentNode.children;
      }
    case NodeTypes.HtmlVoidElement:
    case NodeTypes.HtmlSelfClosingElement:
      return parentNode.attributes;
    case NodeTypes.AttrUnquoted:
    case NodeTypes.AttrDoubleQuoted:
    case NodeTypes.AttrSingleQuoted:
      return parentNode.value;
    case NodeTypes.HtmlRawNode:
    case NodeTypes.AttrEmpty:
    case NodeTypes.TextNode:
    case NodeTypes.LiquidDrop:
    case NodeTypes.LiquidRawTag:
      return undefined;
    default:
      assertNever(parentNode);
  }
}

export function getLeftSibling(
  node: LiquidHtmlNode,
  parentNode: LiquidHtmlNode | null,
): LiquidHtmlNode | undefined {
  if (!parentNode) return undefined;
  const children = getChildrenArray(node, parentNode);
  if (!children) return undefined;
  const index = children.indexOf(node);

  if (index === -1) {
    throw new Error(`Could not find ${node} in ${parentNode}`);
  }

  return children[index - 1];
}

export function getRightSibling(
  node: LiquidHtmlNode,
  parentNode: LiquidHtmlNode,
): LiquidHtmlNode | undefined {
  if (!parentNode) return undefined;
  const children = getChildrenArray(node, parentNode);
  if (!children) return undefined;
  const index = children.indexOf(node);

  if (index === -1) {
    throw new Error(`Could not find ${node} in ${parentNode}`);
  }

  return children[index + 1];
}

