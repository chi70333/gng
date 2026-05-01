function isServerActionPrefixedName(name: string, key: string): boolean {
  if (!name.endsWith(`_${key}`)) return false;

  const prefix = name.slice(0, -(key.length + 1));
  return /^[0-9]+$/.test(prefix);
}

export function formDataValues(formData: FormData, key: string): FormDataEntryValue[] {
  const directValues = formData.getAll(key);
  if (directValues.length > 0) return directValues;

  const prefixedValues: FormDataEntryValue[] = [];
  formData.forEach((value, name) => {
    if (isServerActionPrefixedName(name, key)) prefixedValues.push(value);
  });

  return prefixedValues;
}

export function formDataValue(formData: FormData, key: string): FormDataEntryValue | null {
  return formDataValues(formData, key)[0] ?? null;
}
