// undefined は空欄（絞り込みなし）、null は解釈できない文字列
export function parseCap(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export interface CapInputsValidation {
  minInvalid: boolean;
  maxInvalid: boolean;
  reversed: boolean;
}

export function validateCapInputs(minText: string, maxText: string): CapInputsValidation {
  const min = parseCap(minText);
  const max = parseCap(maxText);
  return {
    minInvalid: min === null,
    maxInvalid: max === null,
    reversed: typeof min === 'number' && typeof max === 'number' && min > max,
  };
}
