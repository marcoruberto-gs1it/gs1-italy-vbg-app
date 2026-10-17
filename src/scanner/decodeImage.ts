import type { DecoderResponse, Hit } from './types'

/** Decodifica una foto in un worker dedicato, chiuso subito dopo. */
export function decodeImage(blob: Blob): Promise<Hit | null> {
  const worker = new Worker(new URL('./decoder.worker.ts', import.meta.url), { type: 'module' })
  return new Promise<Hit | null>((resolve) => {
    worker.onmessage = ({ data }: MessageEvent<DecoderResponse>) => {
      if (data.type === 'result') resolve(data.hit)
      else if (data.type === 'error') resolve(null)
      else return
      worker.terminate()
    }
    worker.onerror = () => {
      resolve(null)
      worker.terminate()
    }
    worker.postMessage({ type: 'file', id: 1, blob })
  })
}
