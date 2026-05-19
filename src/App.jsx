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
  const col = danger ? '#ff4a6a' : primary ? '#4a9eff' : '#555'
  return (
    <button onClick={onClick} style={{ flex: primary ? 1 : undefined, padding: small ? '8px 14px' : '12px 0', background: primary ? 'linear-gradient(135deg,#4a9eff22,#a78bfa22)' : 'transparent', border: `1px solid ${danger ? '#ff4a6a44' : primary ? '#4a9eff' : '#2a2a3a'}`, borderRadius:8, color: col, cursor:'pointer', fontSize: small ? 11 : 12, fontFamily:"'DM Mono',monospace", letterSpacing:1, whiteSpace:'nowrap', ...style }}>
      {children}
    </button>
  )
}

function FocusInput({ inputRef, value, onChange, onKeyDown, placeholder, multiline }) {
  const s = { ...base.input, ...(multiline ? { minHeight:80, resize:'none', lineHeight:1.6 } : {}) }
  const focus = e => e.target.style.borderColor = '#4a9eff'
  const blur  = e => e.target.style.borderColor = '#2a2a3a'
  return multiline
    ? <textarea ref={inputRef} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} style={s} onFocus={focus} onBlur={blur} />
    : <input    ref={inputRef} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} style={s} onFocus={focus} onBlur={blur} />
}

function ProbePanel({ initialName, chainSource, savedAnswers, onSave, onExit, isEditing }) {
  const questions = initialName ? PROBE_QUESTIONS.slice(1) : PROBE_QUESTIONS
  const [step, setStep]       = useState(0)
  const [answers, setAnswers] = useState(savedAnswers || (initialName ? { name: initialName } : {}))
  const [answer, setAnswer]   = useState('')
  const inputRef = useRef(null)
  const currentQ = questions[step]
  const isLast   = step === questions.length - 1
  const progress = (step / questions.length) * 100

  useEffect(() => {
    setAnswer(answers[currentQ?.key] || '')
    setTimeout(() => inputRef.current?.focus(), 60)
  }, [step])

  const commit = () => {
    const val = answer.trim()
    const updated = val ? { ...answers, [currentQ.key]: val } : answers
    setAnswers(updated)
    return updated
  }

  const handleNext      = () => { const u = commit(); if (!isLast) { setStep(s => s+1); setAnswer('') } else onSave(u, false) }
  const handleSaveChain = () => { onSave(commit(), true) }
  const handleSkip      = () => { if (!isLast) { setStep(s => s+1); setAnswer('') } else onSave(answers, false) }

  return (
    <Overlay>
      <div style={{ marginBottom:16 }}>
        {chainSource && <Tag color='#a78bfa'>Chain from {chainSource}</Tag>}
        <div style={{ fontSize:10, color:'#444', letterSpacing:2, textTransform:'uppercase', marginBottom:4 }}>{isEditing ? 'Editing' : 'Building profile for'}</div>
        <Title>{answers.name || initialName || 'New Contact'}</Title>
      </div>
      <div style={{ height:2, background:'#1a1a2e', borderRadius:2, marginBottom:22 }}>
        <div style={{ height:'100%', width:`${progress}%`, background:'linear-gradient(90deg,#4a9eff,#a78bfa)', borderRadius:2, transition:'width 0.35s ease' }} />
      </div>
      <div style={{ fontSize:10, color:'#4a9eff', letterSpacing:2, textTransform:'uppercase', marginBottom:6 }}>{step + 1} / {questions.length} — {currentQ.label}</div>
      <div style={{ fontSize:16, color:'#c8c8d8', marginBottom:14, lineHeight:1.5 }}>{currentQ.q}</div>
      {currentQ.type === 'warmth' ? (
        <div style={{ display:'flex', gap:8, marginBottom:6 }}>
          {['Cold','Warm','Close'].map(w => (
            <button key={w} onClick={() => setAnswer(w)} style={{ flex:1, padding:'11px 0', borderRadius:8, border:`2px solid ${answer===w ? WARMTH_COLORS[w] : '#2a2a3a'}`, background: answer===w ? `${WARMTH_COLORS[w]}22` : 'transparent', color: answer===w ? WARMTH_COLORS[w] : '#555', cursor:'pointer', fontSize:12, fontFamily:"'DM Mono',monospace", letterSpacing:1, transition:'all 0.2s' }}>{w}</button>
          ))}
        </div>
      ) : (
        <FocusInput inputRef={inputRef} value={answer} onChange={e => setAnswer(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (currentQ.type !== 'textarea' || e.metaKey)) handleNext() }}
          placeholder={currentQ.placeholder} multiline={currentQ.type === 'textarea'} />
      )}
      <div style={{ display:'flex', gap:8, marginTop:14 }}>
        <Btn primary onClick={handleNext}>{isLast ? (isEditing ? 'SAVE CHANGES' : 'SAVE CONTACT') : 'NEXT →'}</Btn>
        <Btn onClick={handleSkip}>SKIP</Btn>
        <Btn onClick={onExit}>EXIT</Btn>
      </div>
      {isLast && !isEditing && (
        <div style={{ marginTop:14, padding:'12px 14px', background:'#090e18', borderRadius:8, border:'1px solid #1e2130' }}>
          <div style={{ fontSize:10, color:'#333', letterSpacing:2, marginBottom:8 }}>AFTER SAVING…</div>
          <Btn primary small onClick={handleSaveChain}>⟶ Add someone they introduced me to</Btn>
        </div>
      )}
    </Overlay>
  )
}

function ChainNameScreen({ fromName, onContinue, onExit }) {
  const [name, setName] = useState('')
  const ref = useRef(null)
  useEffect(() => { setTimeout(() => ref.current?.focus(), 60) }, [])
  return (
    <Overlay>
      <Tag color='#a78bfa'>Chain from {fromName}</Tag>
      <Title>Who did they introduce you to?</Title>
      <Sub style={{ marginBottom:18 }}>Enter the name of the next person in this chain</Sub>
      <FocusInput inputRef={ref} value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key==='Enter' && name.trim()) onContinue(name.trim()) }}
        placeholder='Full name…' />
      <div style={{ display:'flex', gap:8, marginTop:14 }}>
        <Btn primary onClick={() => { if (name.trim()) onContinue(name.trim()) }}>CONTINUE →</Btn>
        <Btn onClick={onExit}>EXIT CHAIN</Btn>
      </div>
    </Overlay>
  )
}

function PostSaveScreen({ savedName, onChain, onNewContact, onDone }) {
  return (
    <Overlay>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:12, color:'#7ed321' }}>✓</div>
        <Title>{savedName} saved</Title>
        <Sub style={{ marginBottom:26 }}>What would you like to do next?</Sub>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <Btn primary onClick={onChain}>⟶ Add someone {savedName} introduced me to</Btn>
          <Btn onClick={onNewContact}>+ Add a completely new contact</Btn>
          <Btn onClick={onDone} style={{ color:'#2a2a3a', borderColor:'#111' }}>Done for now</Btn>
        </div>
      </div>
    </Overlay>
  )
}

function Sidebar({ person, allPeople, onClose, onEdit, onDelete }) {
  const warmth = person.warmth || 'Cold'
  const color  = WARMTH_COLORS[warmth] || '#4a9eff'
  const via    = person.chainSource ? allPeople.find(p => p.name === person.chainSource) : null
  const fields = [
    { key:'email', label:'Email' }, { key:'phone', label:'Phone' },
    { key:'job_title', label:'Job Title' }, { key:'company', label:'Company' },
    { key:'how_met', label:'How You Met' }, { key:'last_touch', label:'Last Touchpoint' },
    { key:'notes', label:'Notes' },
  ]
  return (
    <div style={{ position:'fixed', right:0, top:0, bottom:0, width:300, background:'#090c13', borderLeft:'1px solid #1e2130', padding:'24px 20px', overflowY:'auto', zIndex:200, fontFamily:"'DM Mono',monospace", boxShadow:'-20px 0 60px rgba(0,0,0,0.5)' }}>
      <button onClick={onClose} style={{ position:'absolute', top:14, right:14, background:'none', border:'none', color:'#444', cursor:'pointer', fontSize:18 }}>✕</button>
      <Tag color={color}>{warmth}</Tag>
      <div style={{ fontSize:20, color:'#e8e8f0', fontFamily:"'Playfair Display',serif", fontWeight:700, lineHeight:1.2 }}>{person.name}</div>
      {person.job_title && <div style={{ fontSize:12, color:'#a78bfa', marginTop:4 }}>{person.job_title}{person.company ? ` · ${person.company}` : ''}</div>}
      {via && <div style={{ margin:'12px 0 0', padding:'8px 10px', background:'#0d1117', borderRadius:6, border:'1px solid #1e2130', fontSize:11, color:'#555' }}>Via <span style={{ color:'#a78bfa' }}>{via.name}</span></div>}
      <div style={{ height:1, background:'#1a1a2e', margin:'16px 0' }} />
      {fields.filter(f => person[f.key]).map(f => (
        <div key={f.key} style={{ marginBottom:14 }}>
          <div style={{ fontSize:10, color:'#4a9eff', letterSpacing:2, textTransform:'uppercase', marginBottom:3 }}>{f.label}</div>
          <div style={{ fontSize:13, color:'#a0a0b8', lineHeight:1.6 }}>{person[f.key]}</div>
        </div>
      ))}
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:16 }}>
        <Btn onClick={() => onEdit(person)}>EDIT PROFILE</Btn>
        <Btn danger onClick={() => onDelete(person)}>DELETE</Btn>
      </div>
    </div>
  )
}

function NetworkGraph({ people, onSelectPerson }) {
  const canvasRef  = useRef(null)
  const nodesRef   = useRef([])
  const animRef    = useRef(null)
  const dragging   = useRef(null)
  const hoveredRef = useRef(null)
  const dragMoved  = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)
    const existing = nodesRef.current
    nodesRef.current = people.map((p, i) => {
      const ex = existing.find(n => n.id === p.id)
      if (ex) return { ...ex, person: p }
      const angle = (i / Math.max(people.length, 1)) * Math.PI * 2
      const r = Math.min(canvas.width, canvas.height) * 0.28
      return { id: p.id, person: p, x: canvas.width/2 + Math.cos(angle)*r, y: canvas.height/2 + Math.sin(angle)*r, vx:0, vy:0 }
    })
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height)
      ctx.strokeStyle = '#0c1018'; ctx.lineWidth = 1
      for (let x=0;x<canvas.width;x+=44){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke()}
      for (let y=0;y<canvas.height;y+=44){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke()}
      const cx = canvas.width/2, cy = canvas.height/2
      const nodes = nodesRef.current
      for (let i=0;i<nodes.length;i++) {
        const a = nodes[i]
        for (let j=i+1;j<nodes.length;j++) {
          const b = nodes[j], dx=b.x-a.x, dy=b.y-a.y, d=Math.sqrt(dx*dx+dy*dy)||1, f=3200/(d*d)
          a.vx-=(dx/d)*f; a.vy-=(dy/d)*f; b.vx+=(dx/d)*f; b.vy+=(dy/d)*f
        }
        const dcx=cx-a.x, dcy=cy-a.y, dc=Math.sqrt(dcx*dcx+dcy*dcy)||1
        const spring=(dc-(155+i*16))*0.002
        a.vx+=(dcx/dc)*spring*dc; a.vy+=(dcy/dc)*spring*dc
        if (dragging.current?.id!==a.id){ a.vx*=0.84; a.vy*=0.84; a.x+=a.vx; a.y+=a.vy }
        a.x=Math.max(40,Math.min(canvas.width-40,a.x))
        a.y=Math.max(40,Math.min(canvas.height-40,a.y))
      }
      nodes.forEach(node => {
        if (!node.person.chainSource) return
        const src = nodes.find(n => n.person.name === node.person.chainSource)
        if (!src) return
        ctx.beginPath(); ctx.moveTo(src.x,src.y); ctx.lineTo(node.x,node.y)
        ctx.strokeStyle='#a78bfa44'; ctx.lineWidth=1; ctx.setLineDash([4,6]); ctx.stroke(); ctx.setLineDash([])
      })
      nodes.forEach(node => {
        const color = WARMTH_COLORS[node.person.warmth||'Cold']||'#4a9eff'
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(node.x,node.y)
        const g = ctx.createLinearGradient(cx,cy,node.x,node.y)
        g.addColorStop(0,'#a78bfa33'); g.addColorStop(1,`${color}55`)
        ctx.strokeStyle=g; ctx.lineWidth=node.id===hoveredRef.current?1.5:0.8; ctx.stroke()
      })
      ctx.beginPath(); ctx.arc(cx,cy,26,0,Math.PI*2)
      const yg=ctx.createRadialGradient(cx,cy,0,cx,cy,26)
      yg.addColorStop(0,'#a78bfa'); yg.addColorStop(1,'#4a9eff')
      ctx.fillStyle=yg; ctx.fill()
      ctx.font="bold 10px 'DM Mono',monospace"; ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText('YOU',cx,cy)
      nodes.forEach(node => {
        const warmth=node.person.warmth||'Cold', color=WARMTH_COLORS[warmth]||'#4a9eff', size=WARMTH_SIZES[warmth]||18, hov=hoveredRef.current===node.id
        if(hov){ctx.beginPath();ctx.arc(node.x,node.y,size+9,0,Math.PI*2);ctx.fillStyle=`${color}18`;ctx.fill()}
        ctx.beginPath(); ctx.arc(node.x,node.y,size,0,Math.PI*2)
        const ng=ctx.createRadialGradient(node.x-size*.3,node.y-size*.3,0,node.x,node.y,size)
        ng.addColorStop(0,`${color}ff`); ng.addColorStop(1,`${color}88`)
        ctx.fillStyle=ng; ctx.fill(); ctx.strokeStyle=hov?'#fff':color; ctx.lineWidth=1.5; ctx.stroke()
        ctx.font=`${hov?'bold ':''}10px 'DM Mono',monospace`; ctx.fillStyle=hov?'#fff':'#7070a0'; ctx.textAlign='center'; ctx.textBaseline='top'
        ctx.fillText(node.person.name.split(' ')[0], node.x, node.y+size+5)
        if (node.person.job_title){ctx.font="9px 'DM Mono',monospace";ctx.fillStyle='#3a3a5a';ctx.fillText(node.person.job_title.slice(0,14),node.x,node.y+size+17)}
      })
      animRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize',resize) }
  }, [people])

  const getNode = (x,y) => nodesRef.current.find(n => { const dx=n.x-x,dy=n.y-y,sz=WARMTH_SIZES[n.person.warmth||'Cold']||18; return Math.sqrt(dx*dx+dy*dy)<sz+6 })
  const onMouseMove = useCallback(e=>{const r=canvasRef.current.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,n=getNode(x,y);hoveredRef.current=n?.id||null;canvasRef.current.style.cursor=n?'pointer':'default';if(dragging.current){dragMoved.current=true;dragging.current.x=x;dragging.current.y=y;dragging.current.vx=0;dragging.current.vy=0}},[])
  const onMouseDown = useCallback(e=>{const r=canvasRef.current.getBoundingClientRect(),n=getNode(e.clientX-r.left,e.clientY-r.top);if(n){dragging.current=n;dragMoved.current=false}},[])
  const onMouseUp   = useCallback(e=>{const r=canvasRef.current.getBoundingClientRect(),n=getNode(e.clientX-r.left,e.clientY-r.top);if(n&&dragging.current?.id===n.id&&!dragMoved.current)onSelectPerson(n.person);dragging.current=null;dragMoved.current=false},[onSelectPerson])
  const onTouchStart = useCallback(e=>{const t=e.touches[0],r=canvasRef.current.getBoundingClientRect(),n=getNode(t.clientX-r.left,t.clientY-r.top);if(n){dragging.current=n;dragMoved.current=false}},[])
  const onTouchMove  = useCallback(e=>{e.preventDefault();const t=e.touches[0],r=canvasRef.current.getBoundingClientRect(),x=t.clientX-r.left,y=t.clientY-r.top;if(dragging.current){dragMoved.current=true;dragging.current.x=x;dragging.current.y=y;dragging.current.vx=0;dragging.current.vy=0}},[])
  const onTouchEnd   = useCallback(e=>{const t=e.changedTouches[0],r=canvasRef.current.getBoundingClientRect(),n=getNode(t.clientX-r.left,t.clientY-r.top);if(n&&dragging.current?.id===n.id&&!dragMoved.current)onSelectPerson(n.person);dragging.current=null;dragMoved.current=false},[onSelectPerson])

  return <canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block'}} onMouseMove={onMouseMove} onMouseDown={onMouseDown} onMouseUp={onMouseUp} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} />
}

export default function App() {
  const [people,   setPeople]   = useState([])
  const [loaded,   setLoaded]   = useState(false)
  const [selected, setSelected] = useState(null)
  const [screen,   setScreen]   = useState(null)
  const [probingName,  setProbingName]  = useState('')
  const [chainSource,  setChainSource]  = useState(null)
  const [editingId,    setEditingId]    = useState(null)
  const [lastSaved,    setLastSaved]    = useState(null)
  const [addName,      setAddName]      = useState('')
  const [showInput,    setShowInput]    = useState(false)
  const [showMenu,     setShowMenu]     = useState(false)

  useEffect(() => {
    dbGetAll().then(data => { setPeople(data); setLoaded(true) }).catch(() => setLoaded(true))
  }, [])

  const persist = async (updated) => { await dbSaveAll(updated) }

  const handleStartAdd = () => {
    if (!addName.trim()) return
    setProbingName(addName.trim()); setChainSource(null); setScreen('probing')
    setAddName(''); setShowInput(false)
  }

  const handleSave = async (answers, continueChain) => {
    const person = { id: Date.now().toString(), ...answers, chainSource: chainSource || null }
    const updated = [...people, person]
    setPeople(updated); await persist(updated); setLastSaved(person); setProbingName('')
    if (continueChain) { setChainSource(person.name); setScreen('chain-name') }
    else { setChainSource(null); setScreen('post-save') }
  }

  const handleEditSave = async (answers) => {
    const updated = people.map(p => p.id === editingId ? { ...p, ...answers } : p)
    setPeople(updated); await persist(updated); setEditingId(null); setScreen(null)
  }

  const handleDelete = async (person) => {
    if (!window.confirm(`Delete ${person.name}?`)) return
    const updated = people.filter(p => p.id !== person.id)
    setPeople(updated); await persist(updated); setSelected(null)
  }

  const handleEdit = (person) => { setSelected(null); setEditingId(person.id); setProbingName(person.name); setScreen('editing') }
  const exitAll    = () => { setScreen(null); setProbingName(''); setChainSource(null); setEditingId(null) }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(people, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `network-backup-${new Date().toISOString().slice(0,10)}.json`; a.click()
    setShowMenu(false)
  }

  const handleImport = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'
    input.onchange = async e => {
      const file = e.target.files[0]; if (!file) return
      const text = await file.text()
      try {
        const imported = JSON.parse(text)
        if (!Array.isArray(imported)) return alert('Invalid file format')
        const merged = [...people]
        const seen = new Set(people.map(p => p.id))
        imported.forEach(p => { if (!seen.has(p.id)) { seen.add(p.id); merged.push(p) } })
        setPeople(merged); await persist(merged)
        alert(`Imported ${imported.length} contacts`)
      } catch { alert('Could not read file') }
    }
    input.click(); setShowMenu(false)
  }

  if (!loaded) return <div style={{ background:'#070a10', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#4a9eff', fontFamily:"'DM Mono',monospace", fontSize:13, letterSpacing:2 }}>LOADING…</div>

  return (
    <div style={{ background:'#070a10', height:'100vh', display:'flex', flexDirection:'column', fontFamily:"'DM Mono',monospace", overflow:'hidden' }}>
      <div style={{ padding:'14px 18px', borderBottom:'1px solid #111827', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(7,10,16,0.96)', backdropFilter:'blur(10px)', zIndex:100, paddingTop:'max(14px, env(safe-area-inset-top))' }}>
        <div>
          <div style={{ fontSize:16, color:'#e8e8f0', fontFamily:"'Playfair Display',serif", fontWeight:700 }}>Network Intelligence</div>
          <div style={{ fontSize:9, color:'#2a2a3a', letterSpacing:3, textTransform:'uppercase', marginTop:1 }}>{people.length} contact{people.length!==1?'s':''}</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ display:'flex', gap:12, alignItems:'center', marginRight:4 }}>
            {Object.entries(WARMTH_COLORS).map(([w,c]) => (
              <div key={w} style={{ display:'flex', alignItems:'center', gap:4 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:c }}/>
                <span style={{ fontSize:9, color:'#333', letterSpacing:1 }}>{w}</span>
              </div>
            ))}
          </div>
          {showInput ? (
            <div style={{ display:'flex', gap:6 }}>
              <input autoFocus value={addName} onChange={e=>setAddName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleStartAdd()} placeholder='Full name…' style={{ background:'#111827', border:'1px solid #2a2a3a', borderRadius:8, color:'#e8e8f0', padding:'7px 12px', fontSize:13, fontFamily:"'DM Mono',monospace", outline:'none', width:150 }}/>
              <button onClick={handleStartAdd} style={{ padding:'7px 14px', background:'linear-gradient(135deg,#4a9eff22,#a78bfa22)', border:'1px solid #4a9eff', borderRadius:8, color:'#4a9eff', cursor:'pointer', fontSize:11, fontFamily:"'DM Mono',monospace" }}>ADD</button>
              <button onClick={()=>setShowInput(false)} style={{ padding:'7px 10px', background:'transparent', border:'1px solid #1e2130', borderRadius:8, color:'#444', cursor:'pointer', fontSize:11, fontFamily:"'DM Mono',monospace" }}>✕</button>
            </div>
          ) : (
            <button onClick={()=>setShowInput(true)} style={{ padding:'7px 16px', background:'linear-gradient(135deg,#4a9eff22,#a78bfa22)', border:'1px solid #4a9eff44', borderRadius:8, color:'#4a9eff', cursor:'pointer', fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:1 }}>+ ADD</button>
          )}
          <div style={{ position:'relative' }}>
            <button onClick={()=>setShowMenu(v=>!v)} style={{ padding:'7px 10px', background:'transparent', border:'1px solid #1e2130', borderRadius:8, color:'#444', cursor:'pointer', fontSize:14 }}>⋯</button>
            {showMenu && (
              <div style={{ position:'absolute', right:0, top:'110%', background:'#0d1117', border:'1px solid #2a2a3a', borderRadius:10, padding:'6px', zIndex:300, minWidth:160, boxShadow:'0 20px 40px rgba(0,0,0,0.5)' }}>
                {[['⬇ Export backup', handleExport], ['⬆ Import backup', handleImport]].map(([label, fn]) => (
                  <button key={label} onClick={fn} style={{ display:'block', width:'100%', padding:'10px 14px', background:'transparent', border:'none', color:'#a0a0b8', cursor:'pointer', fontSize:12, fontFamily:"'DM Mono',monospace", textAlign:'left', borderRadius:6 }}>{label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ flex:1, position:'relative' }} onClick={()=>setShowMenu(false)}>
        {people.length === 0 ? (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:52, height:52, borderRadius:'50%', background:'linear-gradient(135deg,#4a9eff,#a78bfa)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, marginBottom:16 }}>◉</div>
            <div style={{ fontSize:15, color:'#e8e8f0', fontFamily:"'Playfair Display',serif", marginBottom:6 }}>Your network starts here</div>
            <div style={{ fontSize:11, color:'#333', letterSpacing:1 }}>Tap + ADD to begin</div>
          </div>
        ) : (
          <NetworkGraph people={people} onSelectPerson={setSelected}/>
        )}
        {selected && <Sidebar person={selected} allPeople={people} onClose={()=>setSelected(null)} onEdit={handleEdit} onDelete={handleDelete}/>}
      </div>
      {screen === 'probing'    && <ProbePanel initialName={probingName||undefined} chainSource={chainSource} savedAnswers={null} onSave={handleSave} onExit={exitAll} isEditing={false}/>}
      {screen === 'editing'    && <ProbePanel initialName={probingName} chainSource={null} savedAnswers={people.find(p=>p.id===editingId)||{}} onSave={handleEditSave} onExit={exitAll} isEditing={true}/>}
      {screen === 'chain-name' && <ChainNameScreen fromName={chainSource} onContinue={name=>{setProbingName(name);setScreen('probing')}} onExit={exitAll}/>}
      {screen === 'post-save'  && lastSaved && <PostSaveScreen savedName={lastSaved.name} onChain={()=>{setChainSource(lastSaved.name);setScreen('chain-name')}} onNewContact={()=>{setChainSource(null);setProbingName('');setShowInput(true);setScreen(null)}} onDone={exitAll}/>}
    </div>
  )
}
