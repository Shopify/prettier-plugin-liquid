# Parser

In this doc, we'll go over two topics:

- Why we need our own HTML + Liquid parser
- Why and how we got to three stages

## **TL;DR**

Since we need a Liquid _and_ HTML AST to print prettier Liquid+HTML, we need a special parser that handles both. None exist, so we made our own.

Our parser has three stages:

1. [The OhmJS source code to CST transformation](./parser-stage-1-source-code-to-cst.md)
1. [The CST to AST transformation](./parser-stage-2-cst-to-ast.md)
1. [The AST augmentation](./parser-stage-3-ast-to-augmented-ast.md)

The **OhmJS transformation** takes **sourceCode** and turns it into a **Concrete Syntax Tree (CST)**—an intermediary representation of the source code that is _almost_ an AST. Implemented in [`toLiquidCST(source)`](../../src/parser/cst.ts).

The **CST to AST transformation** walks the **CST** and returns an **AST**. Implemented in [`cstToAst(cst)`](../../src/parser/ast.ts).

The **AST augmentation** walks the **AST** and adds new properties on it (e.g. `parentNode`, `firstChild`, `lastChild`, `isIndentationSensitive`, etc.). Implemented in [`preprocess(ast, config)`](../../src/printer/print-preprocess.ts).

In other words, it goes like this:

```mermaid
flowchart LR
  sourceCode(sourceCode) -- "toLiquidCST()" -->
  CST(CST) -- "cstToAst()" -->
  AST(AST) -- "preprocess()" -->
  AugmentedAST(AugmentedAST)
```

The rest of this doc explains why and how we got there.

## The big problem

Consider the following statements:

- Prettier is $f(\text{AST}, \text{Config})$
- HTML parsers return an HTML ASTs (with no notion of Liquid)
- Liquid parsers return Liquid ASTs (with no notion of HTML)

If we want a formatter that pretty-prints HTML and Liquid _together_, then we need a parser that merges HTML and Liquid _together_.

That is, if we take the following Liquid+HTML code as example:

```liquid
{%for product in all_products%}
  <img
    src="{{ product.featured_image | image_url }}"
    loading="lazy"
  >
{%endfor %}
```

The problem is that neither parser understand both languages. They use strings to represent the parts they don't understand:

```mermaid
%%{init: { 'theme': 'dark', 'themeVariables': { 'fontFamily': 'monospace'} } }%%
flowchart
  subgraph Html AST
    HRoot((Root)) -- child -->
      HTextNode1["#quot;<span style='color:rgb(45, 164, 78)'>{%for product in all_products%}</span><span>#bsol;</span>n #quot;"]

    HRoot -- child -->
      VoidElement["
        tag: img
      "]
    VoidElement -- attribute -->
      Attr1["
        name: src
        value: #quot;<span style='color:rgb(45, 164, 78)'>{{ product.featured_image | image_url }}</span>#quot;
      "]
    VoidElement -- attribute -->
      Attr2["
        name: #quot;loading#quot;
        value: #quot;lazy#quot;
      "]

    HRoot -- child -->
      HTextNode2["
        #quot;<span>#bsol;</span>n<span style='color:rgb(45, 164, 78)'>{%endfor %}</span><span>#bsol;</span>n#quot;
      "]
  end

  style HTextNode1 text-align:left;
  style HTextNode2 text-align:left;
  style VoidElement text-align:left;
  style Attr1 text-align:left;
  style Attr2 text-align:left;
```

```mermaid
%%{init: { 'theme': 'dark', 'themeVariables': { 'fontFamily': 'monospace'} } }%%
flowchart
  subgraph Liquid AST
    LRoot((Root)) -->
      LiquidNode["
        LiquidTag
        name: for
        variable: product
        collection: all_products
      "]

    LiquidNode -- "child" -->
      LTextNode1["
        '#bsol;n  #lt;img#bsol;n    src=#quot;'
      "]

    LiquidNode -- "child" -->
      LiquidDrop["
        LiquidDrop
        variable: product
        lookup: ['featured_image']
        filters: ['image_url']
      "]

    LiquidNode -- "child" -->
      LTextNode2["
        '#bsol;n loading=#quot;lazy#quot;#bsol;n   #gt;'
      "]
    style LiquidNode text-align:left;
    style LiquidDrop text-align:left;
    style LTextNode1 text-align:left,color:#2da44e;
    style LTextNode2 text-align:left,color:#2da44e;
  end
```

## The big solution

What we need is an AST that combines both Liquid _and_ HTML. Something like this:

```mermaid
%%{init: { 'theme': 'dark', 'themeVariables': { 'fontFamily': 'monospace'} } }%%
flowchart
  subgraph Liquid HTML AST
    Root((Root)) -->
      LiquidNode["
        <span style='color:rgb(45, 164, 78)'>LiquidTag</span>
        name: for
        variable: product
        collection: all_products
      "]

    LiquidNode -- "child" -->
      VoidElement["
        <span style='color:rgb(45, 164, 78)'>HtmlElement</span>
        name: img
      "]

    VoidElement -- "attribute" -->
      Attr1["
        AttributeDoubleQuoted
        name: 'src'
      "]
    Attr1 -- "value" -->
      LiquidDrop["
        <span style='color:rgb(45, 164, 78)'>LiquidDrop</span>
        variable: product
        lookup: ['featured_image']
        filters: ['image_url']
      "]

    VoidElement -- "attribute" -->
      Attr2["
        AttributeDoubleQuoted
        name: 'loading'
        value: 'lazy'
      "]

    classDef Left text-align:left;
    class LiquidNode,VoidElement,Attr1,Attr2,LiquidDrop Left;
  end
```

### Getting to a solution

But making a parser is a lot of work... So we took a shortcut by using a parser-generator.

We used [OhmJS](https://ohmjs.org/). Why? I'll admit this:

- Its syntax is pretty
- It has rather good [online editor](https://ohmjs.org/editor/):
  - Lets you iteratively come up with the grammar
  - Lets you visualize the Syntax tree
  - Lets you write explore

More details to follow...

### Problems with OhmJS

The problem with parser generators, however, is that they only spit out Trees for [_context-free grammars_](https://en.wikipedia.org/wiki/Context-free_grammar).

And since HTML and Liquid are _both_ [context-sensitive grammars](https://en.wikipedia.org/wiki/Context-sensitive_grammar), we can't parse both together in one go.

However, we recognized that the _tokens_ contained in HTML and Liquid _are_ context-free.

That is, you could parse `<a class="link"><a>hi</a></a>` as a series of five independent nodes, but not as a tree two child deep.

In other words, you can parse open and close tags independently, but not recognize the parent/child relationship just yet.

So, we're left with a series of context-free nodes:

![ohm-cst-illustration](../images/ohm-nodes.png)

Since those are rather useful (!), [our first stage](./parser-stage-1-cst-to-ast.md) takes source code and turns it into what we call the **Concrete Syntax Tree[^1].**

### Solution to OhmJS

But—like we said—a CST isn't exactly what we desire. We're almost there but not quite.

This is what [our second stage](./parser-stage-2-cst-to-ast.md) does. It takes the CST we get form Ohm and turn into an AST.

### Oh and one more thing

Some properties are easier to add to the tree once the tree is built. For example: `firstChild`, `lastChild`, `parentNode`, etc.

That's why we have a `preprocess` step that walks the tree and adds those properties to the tree.

It's only a separate step because it makes things easier.

This [third stage](./parser-stage-3-ast-to-augmented-ast.md) takes the AST and turns it into an AugmentedAST.

## Where to go from here

### Breadth first

- [The printer](printer.md)

### Depth first

- [The OhmJS source code to CST transformation](./parser-stage-1-source-code-to-cst.md)
- [The CST to AST transformation](./parser-stage-2-cst-to-ast.md)
- [The AST augmentation](./parser-stage-3-ast-to-augmented-ast.md)
