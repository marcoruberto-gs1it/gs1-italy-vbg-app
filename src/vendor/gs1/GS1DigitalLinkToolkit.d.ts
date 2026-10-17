export type AiEntry = {
  ai: string
  title: string
  label: string
  shortcode?: string
  format: string
  type: 'I' | 'Q' | 'D'
  fixedLength: boolean
  checkDigit?: string
  qualifiers?: string[]
  regex: string
}

export type AiValues = Record<string, string>

export default class GS1DigitalLinkToolkit {
  aitable: AiEntry[]
  aiQualifiers: Record<string, string[]>
  groupSeparator: string
  verifyCheckDigit(ai: string, value: string): void
  extractFromGS1elementStrings(elementStrings: string): AiValues
  extractFromGS1digitalLink(uri: string): { GS1: AiValues; other: AiValues }
  decompressGS1DigitalLink(uri: string, useShortText: boolean, uriStem: string): string
  buildGS1digitalLink(values: AiValues, useShortText: boolean, uriStem: string, nonGS1: AiValues): string
}
