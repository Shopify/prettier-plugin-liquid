import {
  CSS_DISPLAY_DEFAULT,
  CSS_DISPLAY_LIQUID_DEFAULT,
  CSS_DISPLAY_LIQUID_TAGS,
  CSS_DISPLAY_TAGS,
  CSS_WHITE_SPACE_DEFAULT,
  CSS_WHITE_SPACE_TAGS,
} from '~/constants.evaluate';
import {
  NodeTypes,
  LiquidParserOptions,
  Augment,
  AugmentedNode,
  WithCssProperties,
  WithSiblings,
} from '~/types';
import { assertNever } from '~/utils';

function getCssDisplay(
  node: AugmentedNode<WithSiblings>,
  options: LiquidParserOptions,
): string {
  if (node.prev && node.prev.type === NodeTypes.HtmlComment) {
    // <!-- display: block -->
    const match = node.prev.body.match(/^\s*display:\s*([a-z]+)\s*$/);
    if (match) {
      return match[1];
    }
  }

  switch (node.type) {
    case NodeTypes.HtmlElement:
    case NodeTypes.HtmlVoidElement:
    case NodeTypes.HtmlSelfClosingElement:
    case NodeTypes.HtmlRawNode: {
      switch (options.htmlWhitespaceSensitivity) {
        case 'strict':
          return 'inline';
        case 'ignore':
          return 'block';
        default: {
          return (
            (typeof node.name === 'string' && CSS_DISPLAY_TAGS[node.name]) ||
            CSS_DISPLAY_DEFAULT
          );
        }
      }
    }

    case NodeTypes.TextNode:
      return 'inline';

    case NodeTypes.LiquidTag:
    case NodeTypes.LiquidRawTag:
      switch (options.htmlWhitespaceSensitivity) {
        case 'strict':
          return 'inline';
        case 'ignore':
          return 'block';
        default: {
          return (
            CSS_DISPLAY_LIQUID_TAGS[node.name] || CSS_DISPLAY_LIQUID_DEFAULT
          );
        }
      }

    case NodeTypes.LiquidBranch:
    case NodeTypes.LiquidDrop:
      return 'inline';

    case NodeTypes.AttrDoubleQuoted:
    case NodeTypes.AttrSingleQuoted:
    case NodeTypes.AttrUnquoted:
    case NodeTypes.AttrEmpty:
      return 'inline';

    case NodeTypes.HtmlComment:
      return 'block';

    case NodeTypes.Document:
      return 'block';

    case NodeTypes.YAMLFrontmatter:
      return 'block';

    case NodeTypes.LiquidVariable:
    case NodeTypes.LiquidFilter:
    case NodeTypes.NamedArgument:
    case NodeTypes.LiquidLiteral:
    case NodeTypes.String:
    case NodeTypes.Number:
    case NodeTypes.Range:
    case NodeTypes.VariableLookup:
    case NodeTypes.AssignMarkup:
    case NodeTypes.PaginateMarkup:
    case NodeTypes.RenderMarkup:
    case NodeTypes.RenderVariableExpression:
      return 'should not be relevant';

    default:
      return assertNever(node);
  }
}

function getNodeCssStyleWhiteSpace(node: AugmentedNode<WithSiblings>): string {
  switch (node.type) {
    case NodeTypes.HtmlElement:
    case NodeTypes.HtmlVoidElement:
    case NodeTypes.HtmlSelfClosingElement:
    case NodeTypes.HtmlRawNode: {
      return (
        (typeof node.name === 'string' && CSS_WHITE_SPACE_TAGS[node.name]) ||
        CSS_WHITE_SPACE_DEFAULT
      );
    }

    case NodeTypes.TextNode:
      return CSS_WHITE_SPACE_DEFAULT;

    case NodeTypes.YAMLFrontmatter:
    case NodeTypes.LiquidRawTag:
      return 'pre';

    case NodeTypes.LiquidTag:
      return CSS_WHITE_SPACE_DEFAULT;

    case NodeTypes.LiquidBranch:
    case NodeTypes.LiquidDrop:
      return CSS_WHITE_SPACE_DEFAULT;

    case NodeTypes.AttrDoubleQuoted:
    case NodeTypes.AttrSingleQuoted:
    case NodeTypes.AttrUnquoted:
    case NodeTypes.AttrEmpty:
      return CSS_WHITE_SPACE_DEFAULT;

    case NodeTypes.HtmlComment:
      return CSS_WHITE_SPACE_DEFAULT;

    case NodeTypes.Document:
      return CSS_WHITE_SPACE_DEFAULT;

    case NodeTypes.LiquidVariable:
    case NodeTypes.LiquidFilter:
    case NodeTypes.NamedArgument:
    case NodeTypes.LiquidLiteral:
    case NodeTypes.String:
    case NodeTypes.Number:
    case NodeTypes.Range:
    case NodeTypes.VariableLookup:
    case NodeTypes.AssignMarkup:
    case NodeTypes.PaginateMarkup:
    case NodeTypes.RenderMarkup:
    case NodeTypes.RenderVariableExpression:
      return 'should not be relevant';

    default:
      return assertNever(node);
  }
}

export const augmentWithCSSProperties: Augment<WithSiblings> = (
  options,
  node,
) => {
  const augmentations: WithCssProperties = {
    cssDisplay: getCssDisplay(node, options),
    cssWhitespace: getNodeCssStyleWhiteSpace(node),
  };

  Object.assign(node, augmentations);
};
