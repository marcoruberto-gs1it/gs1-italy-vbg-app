import { LANGS, setLang, useLang } from '../i18n'

/** Scelta della lingua (IT / EN): la scelta viene ricordata, anche nella dashboard VbG Platform. */
export function LangSwitch({ compact = false }: { compact?: boolean }) {
  const current = useLang()
  return (
    <div className={`lang-switch ${compact ? 'is-compact' : ''}`} role="radiogroup" aria-label="Lingua / Language">
      {LANGS.map((l) => (
        <button key={l.id} type="button" role="radio" lang={l.id} aria-checked={current === l.id} aria-label={l.label} title={l.label} className={current === l.id ? 'is-active' : ''} onClick={() => setLang(l.id)}>
          {l.short}
        </button>
      ))}
    </div>
  )
}
