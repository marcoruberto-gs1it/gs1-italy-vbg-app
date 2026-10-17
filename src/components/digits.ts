/** Raggruppa le cifre come nel testo leggibile sotto i codici, così vanno a capo tra un gruppo e l'altro. */
export function groupDigits(digits: string) {
  if (digits.length === 13) return [digits[0], digits.slice(1, 7), digits.slice(7)]
  if (digits.length === 8) return [digits.slice(0, 4), digits.slice(4)]
  // GTIN-14: indicatore · 12 cifre · cifra di controllo
  if (digits.length === 14) return [digits[0], digits.slice(1, 7), digits.slice(7, 13), digits[13]]
  // SSCC: estensione · 16 cifre · cifra di controllo
  if (digits.length === 18) return [digits[0], digits.slice(1, 9), digits.slice(9, 17), digits[17]]
  return digits.match(/.{1,5}/g) ?? [digits]
}
