export class GS1encoder {
  init(options?: { syntaxDictionary?: string; fallbackOnSyndictError?: boolean; noEmbedded?: boolean }): Promise<void>
  readonly version: string
  readonly errMarkup: string
  readonly hri: string[]
  aiDataStr: string | null
  dataStr: string
  validateAIassociations: boolean
  permitUnknownAIs: boolean
}
