/**
 * Evidence & Notices — page-local synthetic data.
 * Hashes are real SHA-256 outputs of placeholder strings; every artefact is demo data.
 */
import type { Tone } from '@/components/kit'

export type Artefact = {
  id: string
  name: string
  plain: string
  format: string
  size: string
  sha256: string
  /** block hash = SHA-256(prev block hash ‖ artefact hash) */
  block: string
  tone: Tone
}

export const GENESIS = '0'.repeat(64)

export const ARTEFACTS: Artefact[] = [
  { id: 'graph', name: 'Fund-flow graph', plain: 'Picture of where the money went, hop by hop', format: 'PNG', size: '1.8 MB', sha256: '6395eee4da226b77b7e08e2ad4250623831a1246aaeaafccb83f96db48069ccf', block: '6384dc5834fb4c13ed7ffbd0ac19552d1dead982ff62c5dde0c6c5782da5425b', tone: 'teal' },
  { id: 'hops', name: 'Hop-by-hop table', plain: 'Every transfer with time, amount and wallet', format: 'CSV', size: '24 KB', sha256: '545155df08941d24818938fd9347c2dc9bc234db67d4810824932b3353b0c868', block: '7669161c0a5b8c73ca1b6594d0e352a17af73876492ac2f1904b1aba434d3996', tone: 'sky' },
  { id: 'attr', name: 'Attribution reasoning', plain: 'Why we believe the exchange is Meridian', format: 'PDF', size: '312 KB', sha256: 'b26edc866911f8e57e604b8f33198c55bdef828d1d3058eef3ea100c60162111', block: 'faf629421cc63c21338ef3ed954656dc700343ea85417ae4978439ac97a33943', tone: 'gold' },
  { id: 'risk', name: 'Risk explanation', plain: 'What made this wallet high risk, factor by factor', format: 'PDF', size: '186 KB', sha256: 'e1469b17200e973208f337ebd88c6d2c3c881c02bb48a66ae456f23fc70ee74d', block: '143b60906effe6b583dd7ac639d9f6876c0b919770ff3d7fc0d91fe2b93eca90', tone: 'crimson' },
  { id: 'raw', name: 'Raw transaction JSON', plain: 'Original blockchain records, untouched', format: 'JSON', size: '2.4 MB', sha256: 'f6d7c499e4d0244beee2d207659b1194126379dd74aa973a9bc6d5ba9a564a13', block: '93b9bc964af322a41439becaf8133bb8f2a34e2ea7ff0b4a3c7f2cd8d3e6c2a7', tone: 'violet' },
  { id: 'custody', name: 'Chain-of-custody log', plain: 'Who opened or changed the pack, and when', format: 'JSON', size: '9 KB', sha256: '5675640cbbdb60a706252359042cc4e77c3fb99f317ca11a0b825fd05b5fe0cb', block: '380789959b076bdef9fa69c4d9bd09b1b802dfc75308df7a1bfb24e138c3fd4e', tone: 'moss' },
]

export const ROOT = ARTEFACTS[ARTEFACTS.length - 1].block

export const CUSTODY = [
  { at: '11:05', what: 'Complaint received via NCRP', who: 'System' },
  { at: '11:06', what: 'Trace started · 41 s', who: 'SI Kavita Rathore' },
  { at: '11:31', what: 'Attribution confirmed · Meridian (0.94)', who: 'SI Kavita Rathore' },
  { at: '11:47', what: 'Pack sealed · 6 artefacts hashed', who: 'KAIZEN' },
]

export const TX = {
  routeA: 'a41c7e09b3f25d8846e1c0f97b2d34a5e6f81c09d2b7a43e58f16c20d9e7b13a',
  routeB: '0x5e2b9c1f07d4a83e6b19f2c50a7d84e3b61c9f08a2d5e74b13c06f9a8d2e57b4',
}

export type NoticeKey = 'n94' | 'n106' | 'n63'

export const NOTICES: { key: NoticeKey; tab: string; section: string; title: string; ref: string; verify?: boolean }[] = [
  { key: 'n94', tab: 'Data & freeze request', section: 'BNSS §94', title: 'Notice for production of records and request to freeze', ref: 'KZN/JPR/2026/0417/N1', verify: true },
  { key: 'n106', tab: 'Seizure order request', section: 'BNSS §106', title: 'Request to seize property suspected to be proceeds of crime', ref: 'KZN/JPR/2026/0417/N2' },
  { key: 'n63', tab: 'Electronic-evidence certificate', section: 'BSA §63', title: 'Certificate for admissibility of electronic records', ref: 'KZN/JPR/2026/0417/C1' },
]

export const STEPS = ['Draft', 'Officer review', 'SP approval', 'Sent via SAHYOG', 'Acknowledged']
