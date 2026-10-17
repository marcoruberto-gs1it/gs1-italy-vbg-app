/// <reference lib="webworker" />
import { prepareZXingModule, readBarcodes, type ReaderOptions } from 'zxing-wasm/reader'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import type { DecoderRequest, DecoderResponse } from './types'

const ready = prepareZXingModule({
  overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
  fireImmediately: true,
})

const options: ReaderOptions = {
  formats: [
    'EAN13', 'EAN8', 'UPCA', 'UPCE', 'Code128', 'Code39', 'Code93', 'Codabar', 'ITF',
    'DataBar', 'DataBarExpanded', 'DataBarLimited', 'QRCode', 'MicroQRCode', 'DataMatrix', 'Aztec', 'PDF417', 'MaxiCode',
  ],
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  textMode: 'HRI',
  maxNumberOfSymbols: 1,
}

const post = (message: DecoderResponse) => self.postMessage(message)

ready.then(() => post({ type: 'ready' }), (error: unknown) => post({ type: 'error', message: String(error) }))

self.onmessage = async ({ data }: MessageEvent<DecoderRequest>) => {
  try {
    await ready
    const input = data.type === 'frame' ? new ImageData(new Uint8ClampedArray(data.buffer), data.width, data.height) : data.blob
    const [hit] = (await readBarcodes(input, options)).filter((result) => result.isValid && result.text)
    post({
      type: 'result',
      id: data.id,
      hit: hit
        ? {
            text: hit.text,
            format: hit.format,
            symbologyIdentifier: hit.symbologyIdentifier,
            position: hit.position,
            symbol: hit.symbol?.width ? { width: hit.symbol.width, height: hit.symbol.height, data: new Uint8ClampedArray(hit.symbol.data) } : undefined,
          }
        : null,
    })
  } catch (error) {
    post({ type: 'result', id: data.id, hit: null, error: String(error) })
  }
}
