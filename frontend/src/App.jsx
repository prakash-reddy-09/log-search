import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertCircle, ArrowUpRight, Check, ChevronDown, Clock3,
  FileText, Gauge, Search, Server, SlidersHorizontal, UploadCloud,
  X, Zap, RefreshCw, Database, Terminal
} from 'lucide-react'

const API = import.meta.env.VITE_API_BASE_URL || ''
const formatBytes = bytes => {
  if (bytes == null) return '—'
  const mb = bytes / 1048576
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`
}
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function Highlight({ text, query }) {
  const terms = query.trim().split(/\s+/).filter(Boolean)
  if (!terms.length) return text
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi')
  return text.split(pattern).map((part, i) =>
    terms.some(term => term.toLowerCase() === part.toLowerCase())
      ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>
  )
}

function App() {
  const [logs, setLogs] = useState([])
  const [selectedLog, setSelectedLog] = useState('')
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('')
  const [engine, setEngine] = useState('cpp')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const fileRef = useRef(null)

  async function loadLogs() {
    try {
      const response = await fetch(`${API}/api/logs`)
      if (!response.ok) throw new Error(await response.text())
      const list = await response.json()
      setLogs(list)
      setSelectedLog(current => current && list.some(item => String(item.id) === current)
        ? current : (list[0] ? String(list[0].id) : ''))
    } catch (e) {
      setError(`Could not load logs. ${e.message}`)
    }
  }

  useEffect(() => { loadLogs() }, [])

  async function uploadLog() {
    if (!file) return
    setUploading(true); setError(''); setStatus('Uploading and building the index…')
    try {
      const body = new FormData()
      body.append('file', file)
      const response = await fetch(`${API}/api/logs`, { method: 'POST', body })
      if (!response.ok) throw new Error(await response.text())
      setStatus('Log uploaded and indexed successfully.')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await loadLogs()
    } catch (e) {
      setError(`Upload failed. ${e.message}`); setStatus('')
    } finally { setUploading(false) }
  }

  async function runSearch(event) {
    event?.preventDefault()
    if (!selectedLog) { setError('Upload a log file before searching.'); return }
    setSearching(true); setError(''); setStatus('')
    const params = new URLSearchParams({ q: query, engine, limit: '200' })
    if (level) params.set('level', level)
    if (from) params.set('from', from.length === 16 ? `${from}:00` : from)
    if (to) params.set('to', to.length === 16 ? `${to}:00` : to)
    try {
      const response = await fetch(`${API}/api/logs/${encodeURIComponent(selectedLog)}/search?${params}`)
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json()
      setData(result)
      setStatus('Search completed.')
    } catch (e) {
      setError(`Search failed. ${e.message}`); setData(null)
    } finally { setSearching(false) }
  }

  const selected = logs.find(log => String(log.id) === selectedLog)
  const resultCount = data?.totalMatches ?? 0
  const duration = data?.tookMs
  const engineName = data?.engine === 'cpp' ? 'C++ index' : data?.engine === 'java' ? 'Java scan' : data?.engine
  const errorCount = useMemo(() => data?.results?.filter(r => /\bERROR\b/.test(r.text)).length ?? 0, [data])

  function chooseFile(nextFile) {
    if (!nextFile) return
    setFile(nextFile); setStatus(''); setError('')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Activity size={19}/></div><span>trace<span className="brand-dot">.</span></span></div>
        <div className="side-label">WORKSPACE</div>
        <button className="nav-item active"><Search size={17}/> Log explorer</button>
        <a className="nav-item" href="http://localhost:8080/swagger-ui/index.html" target="_blank" rel="noreferrer"><Terminal size={17}/> API docs <ArrowUpRight size={14} className="nav-end"/></a>
        <div className="sidebar-bottom">
          <div className="status-card"><span className="pulse"/><div><strong>Search service</strong><small>Connected to API</small></div></div>
          <div className="sidebar-foot">C++ inverted index <span>·</span> Spring Boot API</div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="slash">/</span><strong>Log explorer</strong></div>
          <div className="top-right"><span className="environment"><span/> LOCAL ENVIRONMENT</span><button className="icon-button" onClick={loadLogs} title="Refresh logs"><RefreshCw size={16}/></button></div>
        </header>

        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line"/> OBSERVABILITY TOOLKIT</div>
            <h1>Log explorer<span className="heading-period">.</span></h1>
            <p>Find the signal in the noise. Search indexed logs or compare against the Java baseline.</p>
          </div>
          <div className="heading-art"><div className="art-ring ring-one"/><div className="art-ring ring-two"/><Activity size={34}/></div>
        </section>

        {error && <div className="alert error-alert"><AlertCircle size={17}/><span>{error}</span><button onClick={() => setError('')}><X size={15}/></button></div>}
        {status && <div className="alert success-alert"><Check size={16}/><span>{status}</span></div>}

        <section className="workspace-grid">
          <div className="panel upload-panel">
            <div className="panel-heading">
              <div className="step-icon"><UploadCloud size={18}/></div>
              <div><div className="panel-kicker">STEP 01</div><h2>Ingest a log file</h2></div>
              <span className="optional-tag">INDEX</span>
            </div>
            <div
              className={`dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); chooseFile(e.dataTransfer.files[0]) }}
              onClick={() => fileRef.current?.click()}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" hidden onChange={e => chooseFile(e.target.files[0])}/>
              <div className="upload-symbol"><UploadCloud size={21}/></div>
              {file ? <><strong className="file-name">{file.name}</strong><span>{formatBytes(file.size)} · Ready to upload</span></>
                : <><strong>Drop your log file here</strong><span>or <em>browse files</em> from your computer</span></>}
              <small>Any plain-text log file</small>
            </div>
            <div className="upload-footer">
              <span>{file ? <><FileText size={14}/> {formatBytes(file.size)} selected</> : 'Files are indexed before they become searchable.'}</span>
              <button className="button button-primary" onClick={uploadLog} disabled={!file || uploading}>
                {uploading ? <><span className="spinner"/> Indexing</> : <>Upload &amp; index <ArrowUpRight size={15}/></>}
              </button>
            </div>
          </div>

          <div className="panel dataset-panel">
            <div className="panel-heading">
              <div className="step-icon purple"><Database size={18}/></div>
              <div><div className="panel-kicker">YOUR DATA</div><h2>Indexed logs</h2></div>
              <button className="text-button" onClick={loadLogs}><RefreshCw size={13}/> Refresh</button>
            </div>
            <div className="dataset-number">{logs.length.toString().padStart(2, '0')}<span> files available</span></div>
            {logs.length ? (
              <div className="dataset-select-wrap">
                <label htmlFor="log-select">ACTIVE DATASET</label>
                <div className="select-shell"><FileText size={15}/><select id="log-select" value={selectedLog} onChange={e => setSelectedLog(e.target.value)}>
                  {logs.map(log => <option value={log.id} key={log.id}>{log.id} · {formatBytes(log.sizeBytes)}</option>)}
                </select><ChevronDown size={15}/></div>
                <div className="dataset-meta"><span><span className="mini-dot"/> Indexed and ready</span><span>{formatBytes(selected?.sizeBytes)}</span></div>
              </div>
            ) : <div className="empty-dataset"><span>No indexed logs yet.</span><small>Upload a file to get started.</small></div>}
          </div>
        </section>

        <section className="panel search-panel">
          <div className="search-title-row">
            <div className="panel-heading">
              <div className="step-icon green"><Search size={18}/></div>
              <div><div className="panel-kicker">STEP 02</div><h2>Query your logs</h2></div>
            </div>
            <div className="engine-toggle" role="group" aria-label="Search engine">
              <button className={engine === 'cpp' ? 'selected' : ''} onClick={() => setEngine('cpp')}><Zap size={14}/> C++ index</button>
              <button className={engine === 'java' ? 'selected' : ''} onClick={() => setEngine('java')}><Server size={14}/> Java scan</button>
            </div>
          </div>
          <form onSubmit={runSearch}>
            <label className="field-label" htmlFor="query">SEARCH QUERY <span>·</span> AND MATCH</label>
            <div className="query-row">
              <div className="query-input-wrap"><Search size={18}/><input id="query" value={query} onChange={e => setQuery(e.target.value)} placeholder="Try: timeout payment, connection refused…" /></div>
              <button className="button button-search" type="submit" disabled={searching || !selectedLog}>
                {searching ? <><span className="spinner"/> Searching</> : <>Run search <ArrowUpRight size={16}/></>}
              </button>
            </div>
            <div className="filters-row">
              <div className="filter-control level-filter"><label htmlFor="level">LOG LEVEL</label><div className="select-shell"><SlidersHorizontal size={14}/><select id="level" value={level} onChange={e => setLevel(e.target.value)}><option value="">Any level</option><option>ERROR</option><option>WARN</option><option>INFO</option><option>DEBUG</option></select><ChevronDown size={14}/></div></div>
              <div className="filter-control"><label htmlFor="from">FROM</label><div className="date-wrap"><Clock3 size={14}/><input id="from" type="datetime-local" step="1" value={from} onChange={e => setFrom(e.target.value)}/></div></div>
              <div className="filter-control"><label htmlFor="to">TO</label><div className="date-wrap"><Clock3 size={14}/><input id="to" type="datetime-local" step="1" value={to} onChange={e => setTo(e.target.value)}/></div></div>
              <button className="reset-button" type="button" onClick={() => {setLevel('');setFrom('');setTo('')}}>Reset filters</button>
            </div>
          </form>
          <div className="engine-note"><span className="note-dot"/>{engine === 'cpp' ? 'C++ inverted index' : 'Java sequential scan'} <span className="note-separator">·</span> {engine === 'cpp' ? 'Optimized full-text lookup' : 'Baseline implementation'} <span className="note-separator">·</span> Up to 200 results</div>
        </section>

        <section className="results-section">
          <div className="results-heading">
            <div><div className="panel-kicker">OUTPUT</div><h2>Search results</h2></div>
            {data && <div className="result-stats"><div><strong>{resultCount.toLocaleString()}</strong><span>MATCHES</span></div><div><strong>{duration ?? '—'}<small> ms</small></strong><span>EXECUTION</span></div><div><strong>{data.returned ?? data.results?.length ?? 0}</strong><span>RETURNED</span></div></div>}
          </div>
          <div className="results-box">
            {!data && !searching ? <div className="results-empty"><div className="terminal-icon"><Terminal size={22}/></div><strong>Waiting for a query</strong><span>Choose a dataset, enter search terms, and run your first search.</span></div>
              : searching ? <div className="results-empty"><span className="large-spinner"/><strong>Searching indexed logs…</strong><span>Scanning for matching events.</span></div>
              : data.results?.length ? <>
                <div className="result-toolbar"><span><span className="live-dot"/> {data.results.length} lines displayed</span><span>{engineName} <span className="note-separator">·</span> {errorCount} errors in results</span></div>
                <div className="log-output">{data.results.map((result, index) => {
                  const match = /\s(ERROR|WARN|INFO|DEBUG)\s/.exec(result.text)
                  const severity = match?.[1] || 'OTHER'
                  return <div className="log-line" key={`${result.lineNumber}-${index}`}><span className="line-number">{String(result.lineNumber).padStart(5, '0')}</span><span className={`severity ${severity.toLowerCase()}`}>{severity}</span><code><Highlight text={result.text} query={query}/></code></div>
                })}</div>
              </> : <div className="results-empty"><div className="terminal-icon"><Search size={22}/></div><strong>No matching events</strong><span>Try fewer terms or broaden your time range.</span></div>}
          </div>
          <div className="results-foot"><span><Gauge size={14}/> Built for fast log investigation</span><span>TRACE / LOG SEARCH <b>v1.0</b></span></div>
        </section>
        <footer className="footer">A lightweight observability workspace <span>·</span> Spring Boot + C++</footer>
      </main>
    </div>
  )
}

export default App
