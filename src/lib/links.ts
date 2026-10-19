import { t } from '../i18n'

/* Etichette come getter: seguono la lingua corrente. Il sito GS1 Italy è in italiano. */
export const GS1_IT = 'https://gs1it.org'

export const serviceLinks = [
  { get label() { return t('Calcola la cifra di controllo') }, href: `${GS1_IT}/assistenza/calcolo-cifra-di-controllo/` },
  { label: 'Verified by GS1 (VbG)', href: `${GS1_IT}/servizi/verified-by-gs1/` },
  { get label() { return t('Ti serve un barcode GS1') }, href: `${GS1_IT}/serve-codice-a-barre/` },
  { label: 'FAQ', href: `${GS1_IT}/assistenza/faq/` },
]

export const legalLinks = [
  { get label() { return t('Privacy policy GS1 Italy') }, href: `${GS1_IT}/privacy-policy/` },
  { get label() { return t('Cookie') }, href: `${GS1_IT}/informativa-cookie/` },
  { get label() { return t('Accessibilità') }, href: `${GS1_IT}/accessibilita/` },
  { label: 'Disclaimer', href: `${GS1_IT}/disclaimer/` },
]

export const socialLinks = [
  { label: 'LinkedIn', href: 'https://linkedin.com/company/gs1-italy/' },
  { label: 'YouTube', href: 'https://www.youtube.com/c/GS1ItalyTV' },
  { label: 'Instagram', href: 'https://www.instagram.com/gs1italy/' },
  { label: 'Facebook', href: 'https://facebook.com/GS1Italy' },
]

