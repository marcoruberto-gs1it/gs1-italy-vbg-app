export type Point = { x: number; y: number }
export type Quad = { topLeft: Point; topRight: Point; bottomRight: Point; bottomLeft: Point }

/** Matrice dei moduli del simbolo letto (solo codici 2D): 0 = modulo scuro. */
export type SymbolMatrix = { width: number; height: number; data: Uint8ClampedArray }

export type Hit = {
  text: string
  format: string
  symbologyIdentifier: string
  position: Quad
  symbol?: SymbolMatrix
}

export type DecoderRequest =
  /** binarizer: soglia per separare barre e spazi (FixedThreshold aiuta con le immagini un po' sfocate). */
  | { type: 'frame'; id: number; width: number; height: number; buffer: ArrayBuffer; binarizer?: 'LocalAverage' | 'FixedThreshold' }
  | { type: 'file'; id: number; blob: Blob }

export type DecoderResponse =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'result'; id: number; hits: Hit[]; error?: string }
