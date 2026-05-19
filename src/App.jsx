import { useState, useEffect, useRef, useCallback } from 'react'

const DB_NAME = 'NetworkIntelligence'
const DB_VER  = 1
const STORE   = 'contacts'

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER)
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = e => res(e.target.result)
    req.onerror   = e => rej(e)
  })
}

async function dbGetAll() {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = e => res(e.target.result || [])
    req.onerror   = e => rej(e)
  })
}

async function dbSaveAll(people) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx    = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    store.clear()
    people.forEach(p => store.put(p))
    tx.oncomplete = () => res()
    tx.onerror    = e => rej(e)
  })
}

const PROBE_QUESTIONS = [
  { key: 'name',       label: 'Full Name',       q: "What's their full name?",                         type: 'text',     placeholder: 'e.g. Sarah Johnson' },
  { key: 'email',      label: 'Email',           q: "What's their email address?",                     type: 'text',     placeholder: 'e.g. sarah@company.com' },
  { key: 'phone',      label: 'Phone',           q: 'Do you have a phone number for them?',            type: 'text',     placeholder: 'e.g. +44 7700 900000' },
  { key: 'job_title',  label: 'Job Title',       q: "What's their job title?",                         type: 'text',     placeholder: 'e.g. Head of Growth' },
  { key: 'company',    label: 'Company',         q: 'What company are they at?',                       type: 'text',     placeholder: 'e.g. Acme Corp' },
  { key: 'how_met',    label: 'How You Met',     q: 'How and when did you first connect?',             type: 'text',     placeholder: 'e.g. Conference in Dubai, Jan 2024' },
  { key: 'warmth',     label: 'Relationship',    q: 'How would you rate this relationship?',           type: 'warmth' },
  { key: 'last_touch', label: 'Last Touchpoint', q: 'When did you last speak, and what was it about?', type: 'text',    placeholder: 'e.g. Call last week about Series A' },
  { key: 'notes',      label: 'Notes',           q: 'Anything else worth capturing about them?',       type: 'textarea', placeholder: 'Personality, goals, opportunities, watch-outs…' },
]

const WARMTH_COLORS = { Cold: '#4a9eff', Warm: '#f5a623', Close: '#7ed321' }
const WARMTH_SIZES  = { Cold: 18, Warm: 22, Close: 27 }

const base = {
  input: { width:'100%', background:'#111827', border:'1px solid #2a2a3a', borderRadius:8, color:'#e8e8f0', padding:'12px 16px', fontSize:14, fontFamily:"'DM Mono',monospace", outline:'none', boxSizing:'border-box', transition:'border-color 0.2s' },
}

function Overlay({ children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, fontFamily:"'DM Mono',monospace", padding:'16px' }}>
      <div style={{ background:'#0d1117', border:'1px solid #2a2a3a', borderRadius:16, width:'100%', maxWidth:480, padding:'32px 28px', boxShadow:'0 40px 80px rgba(0,0,0,0.7)', maxHeight:'90vh', overflowY:'auto' }}>
        {children}
      </div>
    </div>
  )
}

function Title({ children }) { return <div style={{ fontSize:20, color:'#e8e8f0', fontFamily:"'Playfair Display',serif", fontWeight:700, lineHeight:1.2, marginBottom:4 }}>{children}</div> }
function Sub({ children, style }) { return <div style={{ fontSize:13, color:'#555', lineHeight:1.5, ...style }}>{children}</div> }
function Tag({ color='#4a9eff', children }) { return <div style={{ display:'inline-block', padding:'2px 10px', borderRadius:20, background:`${color}22`, border:`1px solid ${color}`, color, fontSize:10, letterSpacing:2, textTransform:'uppercase', marginBottom:10 }}>{children}</div> }

function Btn({ primary, small, danger, children, style, onClick }) {
  const col = danger ? '#
