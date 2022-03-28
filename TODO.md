## Things that would make this production ready

- [x] The conditional addition of whitespace trimming modes to Liquid variables and tags when an element breaks:

  ```liquid
  Input:
    <div>{% if A %} {{ thing }} {% endif %}</div>

  Output:
    <div>
      {%- if A %}
        {{ thing }}
      {% endif -%}
    </div>
  ```

  Since there wasn't whitespace before prettier pretty-printed the code. Prettier should _never_ break existing code, so if the code splits on a new line.

  - [X] Inside `HTMLElement`s
  - [X] Inside `HTMLElement`s which contain `TextNode`s (paragraphs)
  - [X] Inside `LiquidTag`s
  - [X] Inside `LiquidTag`s which contain `TextNode`s (paragraphs)

- [ ] Prettier Liquid inside HTML attributes
  - [ ] We're not reindenting/breaking. But we should add whitespace inside nodes. e.g. `{{x}}` should become `{{ x }}`

- [ ] Identify issues by running prettier on our themes
  - [ ] Dawn

- [ ] Elaborate `LiquidTag` syntax support
  - [ ] Potentially break on long list of arguments
- [ ] Elaborate `LiquidDrop` syntax support
  - [ ] Conditions
  - [ ] Operators
  - [ ] Pipelines
  - [ ] Arguments
- [ ] Elaborate `{% liquid %}` syntax support
  - [ ] indenting `if` tags
  - [ ] indenting `case` tags

## Things that we won't do

- Liquid + JavaScript (very hard)
- Liquid + CSS (hard)

### Reasoning

It should be a non-goal to make a great experience for JavaScript + Liquid or CSS + Liquid. Use cases like these are better served by leveraging the existing tooling from the community. If you need data provided by Liquid, all you need to do is dump it and then reference it as though it was a global object or CSS var.

```liquid
<!-- layout/theme.liquid -->
<script src="{{ 'bundle.js' | asset_url }}" defer></script>
<script>
  window.myThemeData = {
     dataINeed: {{ dataINeed | json }},
  }
</script>

{{ 'theme.css' | asset_url | stylesheet_tag: preload: true }}
<style>
  :root {
    --theme-background-color: {{ settingBackgroundColor }};
  }
</style>
```

```javascript
// assets/bundle.js
console.log(window.myThemeData.dataINeed);
```

```css
// assets/theme.css
body {
  background-color: var(--theme-background-color);
}
```

The benefit of going this way is that you can then use all the tooling you want for CSS or JavaScript independently of Liquid. e.g. prettier plugin for both languages, write your JavaScript in TypeScript, etc.
