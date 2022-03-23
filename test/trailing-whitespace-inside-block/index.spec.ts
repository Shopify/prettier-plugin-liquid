import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

describe(`Unit: ${path.basename(__dirname)}`, () => {
  it.only('should format as expected', () => {
    assertFormattedEqualsFixed(__dirname);
  });
});
