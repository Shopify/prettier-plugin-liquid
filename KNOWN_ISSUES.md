## Liquid that can't be prettier

Like the [Ember/Handlebars plugin](https://prettier.io/blog/2021/05/09/2.3.0.html#:~:text=The%20feature%20is,under%20the%20hood.), this prettier plugin only supports a _subset_ of Liquid: Liquid that can be turned into a tree.

A common use case that isn't supported is opening HTML tags inside a Liquid block without closing it (and vice-versa):

```liquid
// not supported
{% if is_3d %}
  <product-media list=of props>
{% else %}
  <div>
{% endif %}
    content that goes in the middle
{% if is_3d %}
  </product-media>
{% else %}
  </div>
{% endif %}
```

When this happens, prettier will throw the following error:

```
example.liquid[error] example.liquid: LiquidHTMLParsingError: Attempting to close LiquidTag 'if' before HtmlElement 'div' was closed
[error]   3 |   <product-media list=of props>
[error]   4 | {% else %}
[error] > 5 |   <div>
[error]     |   ^^^^^
[error] > 6 | {% endif %}
[error]     | ^^^^^^^^^^^^
[error]   7 |     content that goes in the middle
[error]   8 | {% if is_3d %}
[error]   9 |   </product-media>
```

However... We _do_ support Liquid variables as HTML tag names.

```liquid
{% liquid
  if is_3d
    assign wrapper = 'product-media'
  else
    assign wrapper = 'div'
  endif
%}
<{{ wrapper }}>
  content that goes in the middle.
</{{ wrapper }}>
```

## Liquid-in-JS

**We do not plan to offer complete support for Liquid in JS.**

That said, we do offer _partial_ support for it. We support Liquid inside JavaScript strings:

```liquid
// 👍 supported, will be reformatted using prettier's own JavaScript formatter
<script>
  const mySetting = '{{ some_liquid_drop }}';
</script>

// 👎 not supported, will only reindent the code
<script>
  {% if condition %}
    // do stuff
  {% endif %}
</script>
```

If you want to refer to a JSON blob, you can do this "purely" by using a `<script type="application/json">` with a Liquid JSON dump in it:

```liquid
{% # dump your JSON in an application/json script tag %}
<script id="my-settings" type="application/json">
  {{ my_settings | json }}
</script>

{% # use your JSON by reading it with JavaScript %}
<script> 
  const myLiquidSettings = JSON.parse(
    document.getElementById('my-settings').textContent
  );
</script>
```

## Liquid-in-CSS

**We do not plan to offer complete support for Liquid in CSS (or any support for `.css.liquid`)**

Our recommendation is the following:
- Define [CSS Custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/--*) somewhere in your HTML-Liquid files.
- Use plain `.css` files that refer to those custom CSS properties

Example:

`theme.liquid`
```liquid
<style>
  :root {
    --accent-colour: {{ some_setting }};
  }
</style>
```

`styles.css`
```css
button.accent {
  color: var(--accent-colour);
}
```

You can see this pattern used in the Dawn repo. 
- [theme.liquid](https://github.com/Shopify/dawn/blob/main/layout/theme.liquid#L48-L184)
- [base.css](https://github.com/Shopify/dawn/blob/main/assets/base.css#L3-L14)

Pros of this approach:
- Your CSS files are then true CSS files. This means you can use the official syntax highlighting for CSS, the formatter for CSS, etc. Which are bound to have better support that this plugin can offer. 
- You can use build tools independently of Liquid that work with CSS files.
- You could even use LESS or SCSS independently if you are so inclined.
