import { expectFormatted, readFile } from '../test-helpers';
import * as path from 'path';

describe(`Unit: ${path.basename(__dirname)}`, () => {
  it.only('should format as expected', () => {
    expectFormatted(__dirname, 'index.liquid').to.eql(
      readFile(__dirname, 'fixed.liquid')
    )
  })
})
