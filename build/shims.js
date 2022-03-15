const fs = require('fs');
const path = require('path');

fs.writeFileSync(
  path.join(__dirname, 'shims/liquid-html-ohm.js'),
  'module.exports = ' +
    'String.raw`' +
    require('../grammar/liquid-html.ohm.js').replace(/`/g, '${"`"}') +
    '`;',
  'utf8',
);
