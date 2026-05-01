import { describe, expect, it } from 'vitest';
import { formDataValue, formDataValues } from './form-data';

describe('formData helpers', () => {
  it('reads normal form data names first', () => {
    const formData = new FormData();
    formData.append('selectedSkuIds', '59');
    formData.append('1_selectedSkuIds', '43');

    expect(formDataValue(formData, 'selectedSkuIds')).toBe('59');
    expect(formDataValues(formData, 'selectedSkuIds')).toEqual(['59']);
  });

  it('reads Next server action prefixed names when direct names are absent', () => {
    const formData = new FormData();
    formData.append('1_selectedSkuIds', '59');
    formData.append('1_selectedSkuIds', '43');
    formData.append('1_agree', 'on');
    formData.append('0', '["$K1"]');

    expect(formDataValue(formData, 'agree')).toBe('on');
    expect(formDataValues(formData, 'selectedSkuIds')).toEqual(['59', '43']);
  });

  it('does not treat arbitrary underscore names as server action prefixes', () => {
    const formData = new FormData();
    formData.append('legacy_selectedSkuIds', '59');

    expect(formDataValue(formData, 'selectedSkuIds')).toBeNull();
    expect(formDataValues(formData, 'selectedSkuIds')).toEqual([]);
  });
});
