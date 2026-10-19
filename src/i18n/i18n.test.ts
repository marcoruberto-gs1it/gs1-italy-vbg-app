import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import EN from './en.json'
import { _setLangForTest, browserLang, detectLang, t } from './index'

const SRC = join(__dirname, '..')

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return sources(p)
    return /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) && !p.includes(join('src', 'i18n')) ? [p] : []
  })
}

/** Primo argomento letterale di ogni chiamata t('…') nel codice. */
function keys() {
  const found = new Map<string, string>()
  for (const file of sources(SRC)) {
    const code = readFileSync(file, 'utf8')
    for (const m of code.matchAll(/(?<![\w.])[tk]\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)) found.set(m[2].replace(/\\(.)/g, '$1'), file)
    if (/(?<![\w.])t\(\s*`/.test(code)) throw new Error(`${file}: t() con template literal; usa '…{nome}…' e le variabili`)
  }
  return found
}

describe('traduzioni', () => {
  it('ogni testo dell’interfaccia ha la traduzione inglese', () => {
    const missing = [...keys()].filter(([k]) => !(k in EN)).map(([k, f]) => `${f.replace(SRC, 'src')}: ${k}`)
    expect(missing).toEqual([])
  })
  it('le traduzioni mantengono le stesse variabili', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    const wrong = Object.entries(EN as Record<string, string>).filter(([it, en]) => vars(it) !== vars(en)).map(([it]) => it)
    expect(wrong).toEqual([])
  })
})

describe('lingua', () => {
  it('sceglie dall’indirizzo, poi dalla scelta salvata, poi dal browser', () => {
    expect(detectLang('en', 'it', ['it-IT'])).toBe('en')
    expect(detectLang(null, 'it', ['en-US'])).toBe('it')
    expect(detectLang(null, null, ['it-IT', 'en'])).toBe('it')
    expect(detectLang(null, null, ['de-DE', 'it'])).toBe('it')
    expect(detectLang(null, null, ['de-DE', 'fr'])).toBe('en')
    expect(browserLang(['en-US', 'it-IT'])).toBe('en')
    expect(browserLang(['IT_it'])).toBe('it')
    expect(browserLang([])).toBe('en')
    expect(detectLang('xx', null, [])).toBe('en')
  })
  it('traduce e sostituisce le variabili', () => {
    _setLangForTest('it')
    expect(t('{n} scansioni', { n: 3 })).toBe('3 scansioni')
    _setLangForTest('en')
    expect(t('Testo non tradotto')).toBe('Testo non tradotto')
  })
})
