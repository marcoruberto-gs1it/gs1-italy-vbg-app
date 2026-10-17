export type Point = { x: number; y: number }
export type Quad = { topLeft: Point; topRight: Point; bottomRight: Point; bottomLeft: Point }

export type Hit = {
  text: string
  format: string
  symbologyIdentifier: string
  position: Quad
}

export type DecoderRequest =
  | { type: 'frame'; id: number; width: number; height: number; buffer: ArrayBuffer }
  | { type: 'file'; id: number; blob: Blob }

export type DecoderResponse =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'result'; id: number; hit: Hit | null; error?: string }
