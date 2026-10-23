import type { DecoderResponse, Hit } from './types'

/** Ordine di lettura di un'etichetta: dall'alto in basso, poi da sinistra a destra. */
export const byPosition = (hits: Hit[]) =>
  [...hits].sort((a, b) => a.position.topLeft.y - b.position.topLeft.y || a.position.topLeft.x - b.position.topLeft.x)

/** Decodifica una foto in un worker dedicato, chiuso subito dopo: tutti i barcode trovati, dall'alto in basso. */
export function decodeImage(blob: Blob): Promise<Hit[]> {
  const worker = new Worker(new URL('./decoder.worker.ts', import.meta.url), { type: 'module' })
  return new Promise<Hit[]>((resolve) => {
    worker.onmessage = ({ data }: MessageEvent<DecoderResponse>) => {
      if (data.type === 'result') resolve(byPosition(data.hits))
      else if (data.type === 'error') resolve([])
      else return
      worker.terminate()
    }
    worker.onerror = () => {
      resolve([])
      worker.terminate()
    }
    worker.postMessage({ type: 'file', id: 1, blob })
  })
}
