-- ============================================================================
-- VbG Scan · statistiche sulle scansioni
-- Da eseguire nel SQL Editor di Supabase (progetto bpgdftmvduzahbczxiik).
-- Si può rieseguire: crea solo ciò che manca e aggiorna le viste.
--
-- Principi:
--  · scrive solo il Cloudflare Worker, con la chiave segreta (che scavalca RLS);
--  · il pubblico (chiavi anon/publishable) non può leggere né scrivere nulla;
--  · nessun dato personale: niente IP, niente identificativi di dispositivo,
--    dei link si salva solo il dominio; posizione a livello di regione (da Cloudflare);
--  · le viste aggregate mostrano solo gruppi con almeno 10 letture.
-- ============================================================================

create table if not exists public.scan_events (
  id                bigint generated always as identity primary key,
  created_at        timestamptz not null default now(),

  -- Dove: dedotto da Cloudflare dall'indirizzo IP, che non viene salvato
  country           text,          -- ISO 3166-1, es. IT
  region_code       text,          -- ISO 3166-2, es. 25 (Lombardia)
  region            text,          -- nome della regione, es. Lombardy
  is_eu             boolean,

  -- Come
  source            text not null check (source in ('camera', 'image', 'manual')),
  device            text check (device in ('mobile', 'desktop')),
  app_version       text,

  -- Che cosa è stato letto
  symbology         text,          -- EAN-13, GS1 DataMatrix, QR Code Standard GS1…
  is_2d             boolean,
  content_kind      text check (content_kind in ('gs1', 'url', 'text')),
  compliance        text check (compliance in ('gs1', 'error', 'partial', 'manual', 'none')),
  check_digit_ok    boolean,
  syntax_ok         boolean,
  syntax_error      text,          -- messaggio della GS1 Barcode Syntax Engine
  primary_ai        text,          -- 01 = GTIN, 00 = SSCC, 414 = GLN…
  primary_key       text,          -- valore della chiave (GTIN a 14 cifre per i prodotti)
  ai_list           text[],        -- AI presenti nel codice (lotto, scadenza…)
  issuer_mo         text,          -- organizzazione GS1 del prefisso (dalla tabella dei prefissi)

  -- Verified by GS1
  vbg_state         text check (vbg_state in ('verified', 'licensed', 'invalid', 'error')),
  vbg_complete      boolean,
  vbg_core_count    smallint check (vbg_core_count between 0 and 7),
  vbg_error_code    text,          -- es. E039 (numero non assegnato)
  company_prefix    text,          -- licenza GS1 del titolare (GS1 Company Prefix)
  licensee_name     text,
  brand_name        text,          -- marchio del prodotto (da Verified by GS1)
  licensee_gln      text,
  licensing_mo      text,
  gpc_brick         text,
  gpc_brick_name    text,
  gpc_segment       text,

  -- Link contenuto nel codice (solo il dominio)
  link_domain       text,
  link_level        text check (link_level in ('trusted', 'unknown', 'danger', 'pending')),
  link_imitates     text,          -- dominio registrato a cui somiglia
  link_threats      text[]         -- segnalazioni di Google Web Risk
);

-- Colonne aggiunte dopo la prima versione (per i database già creati).
alter table public.scan_events add column if not exists brand_name text;

comment on table public.scan_events is
  'Una riga per scansione completata nell''app VbG Scan. Nessun dato personale: niente IP né identificativi; posizione a livello di regione dedotta da Cloudflare.';

create index if not exists scan_events_created_at_idx   on public.scan_events (created_at);
create index if not exists scan_events_primary_key_idx  on public.scan_events (primary_key);
create index if not exists scan_events_prefix_idx       on public.scan_events (company_prefix);
create index if not exists scan_events_gpc_idx          on public.scan_events (gpc_brick);
create index if not exists scan_events_region_idx       on public.scan_events (country, region_code);
create index if not exists scan_events_link_domain_idx  on public.scan_events (link_domain) where link_domain is not null;

-- Sicurezza: RLS attiva e nessuna policy → le chiavi pubbliche non vedono nulla.
alter table public.scan_events enable row level security;
revoke all on public.scan_events from anon, authenticated;

-- ============================================================================
-- Viste aggregate (security_invoker: rispettano i permessi di chi le interroga)
-- ============================================================================

-- Barometro: diffusione dei codici 2D per mese, regione e segmento GPC.
create or replace view public.barometro_2d
with (security_invoker = on) as
select
  date_trunc('month', created_at)::date                        as mese,
  country,
  region_code,
  coalesce(gpc_segment, 'Non classificato')                    as segmento_gpc,
  count(*)                                                     as letture,
  count(*) filter (where is_2d)                                as letture_2d,
  round(100.0 * count(*) filter (where is_2d) / count(*), 1)   as quota_2d_pct,
  count(*) filter (where symbology = 'QR Code Standard GS1')   as qr_code_standard_gs1,
  count(*) filter (where symbology = 'GS1 DataMatrix')         as gs1_datamatrix
from public.scan_events
where source <> 'manual' and content_kind = 'gs1'
group by 1, 2, 3, 4
having count(*) >= 10;

-- Benchmark di categoria: qualità dei dati e adozione del 2D per categoria GPC.
create or replace view public.benchmark_categoria
with (security_invoker = on) as
select
  date_trunc('month', created_at)::date                                 as mese,
  gpc_segment                                                           as segmento_gpc,
  gpc_brick,
  max(gpc_brick_name)                                                   as categoria,
  count(*)                                                              as letture,
  count(distinct primary_key)                                           as gtin_distinti,
  round(avg(vbg_core_count), 2)                                         as media_dati_essenziali,
  round(100.0 * count(*) filter (where vbg_complete) / count(*), 1)     as schede_complete_pct,
  round(100.0 * count(*) filter (where compliance = 'gs1') / count(*), 1) as conformi_gs1_pct,
  round(100.0 * count(*) filter (where is_2d) / count(*), 1)            as quota_2d_pct
from public.scan_events
where primary_ai = '01' and gpc_brick is not null
group by 1, 2, 3
having count(*) >= 10;

-- Ritorno di qualità: errori per prefisso aziendale e simbologia (solo codici letti, non digitati).
create or replace view public.qualita_errori
with (security_invoker = on) as
select
  date_trunc('month', created_at)::date                                  as mese,
  company_prefix,
  max(licensee_name)                                                     as titolare,
  symbology,
  count(*)                                                               as letture,
  count(*) filter (where check_digit_ok = false)                         as errori_cifra_controllo,
  count(*) filter (where syntax_ok = false)                              as errori_sintassi,
  count(*) filter (where compliance = 'partial')                         as codici_non_standard,
  round(100.0 * count(*) filter (where compliance in ('error', 'partial')) / count(*), 1) as errori_pct
from public.scan_events
where source <> 'manual'
group by 1, 2, 4;

-- Brand protection: codici autentici che puntano a domini non registrati dal titolare.
create or replace view public.allerte_brand
with (security_invoker = on) as
select
  company_prefix,
  max(licensee_name)                    as titolare,
  primary_key                           as gtin,
  link_domain,
  max(link_imitates)                    as somiglia_a,
  bool_or(link_level = 'danger')        as sospetto,
  bool_or(cardinality(link_threats) > 0) as segnalato_google,
  count(*)                              as letture,
  min(created_at)                       as prima_lettura,
  max(created_at)                       as ultima_lettura,
  array_agg(distinct region_code) filter (where region_code is not null) as regioni
from public.scan_events
where vbg_state = 'verified' and link_domain is not null and link_level in ('unknown', 'danger')
group by 1, 3, 4;

-- Possibili codici abusivi: numeri mai assegnati da GS1 che compaiono più volte.
create or replace view public.prefissi_non_assegnati
with (security_invoker = on) as
select
  left(primary_key, 8)          as inizio_codice,
  vbg_error_code,
  count(*)                      as letture,
  count(distinct primary_key)   as codici_distinti,
  min(created_at)               as prima_lettura,
  max(created_at)               as ultima_lettura
from public.scan_events
where vbg_state = 'invalid' and vbg_error_code = 'E039'
group by 1, 2
having count(*) >= 3;

revoke all on public.barometro_2d, public.benchmark_categoria, public.qualita_errori,
              public.allerte_brand, public.prefissi_non_assegnati from anon, authenticated;
