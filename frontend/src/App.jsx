import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js'
import { Radar, Bar } from 'react-chartjs-2'
import './App.css'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'
 
const SYMPTOMS = {
  rice   : ['brown spots','gray center','diamond lesions','yellowing edges','wilting','water soaked lesions','oval lesions','white mycelium','circular brown spots','yellow halo'],
  wheat  : ['yellow stripes','powdery pustules','leaf curling','white powder','stunted growth','black powder','dark spores'],
  maize  : ['cigar shaped lesions','gray green spots','brown pustules','yellow leaves','rectangular lesions','gray spots'],
  tomato : ['dark brown spots','concentric rings','yellowing','water soaked lesions','white mold','curling leaves','mosaic pattern'],
  cotton : ['holes in bolls','larval presence','curling leaves','thickened veins','angular spots','brown lesions'],
  potato : ['dark lesions','white mold underside','rotting tubers','brown spots','black stem base','wilting']
}

function ParticleCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    const particles = Array.from({ length: 60 }, () => ({
      x    : Math.random() * canvas.width,
      y    : Math.random() * canvas.height,
      r    : Math.random() * 1.5 + 0.3,
      dx   : (Math.random() - 0.5) * 0.3,
      dy   : -Math.random() * 0.4 - 0.1,
      alpha: Math.random() * 0.4 + 0.1
    }))
    let animId
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(74, 222, 128, ${p.alpha})`
        ctx.fill()
        p.x += p.dx
        p.y += p.dy
        if (p.y < 0) { p.y = canvas.height; p.x = Math.random() * canvas.width }
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1
      })
      animId = requestAnimationFrame(draw)
    }
    draw()
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} className="particle-canvas" />
}

function MoistureGauge({ value = 0, max = 100, status = 'Optimal' }) {
  const angle   = -135 + (value / max) * 270
  const color   = status === 'Critical' ? '#ef4444' : status === 'Low' ? '#f97316' : status === 'Excess' ? '#3b82f6' : '#4ade80'
  return (
    <div className="gauge-wrap">
      <svg viewBox="0 0 200 160" className="gauge-svg">
        <defs>
          <linearGradient id="gaugeTrack" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#ef4444" stopOpacity="0.4"/>
            <stop offset="40%"  stopColor="#4ade80" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.4"/>
          </linearGradient>
        </defs>
        <path d="M 20 140 A 80 80 0 1 1 180 140" fill="none" stroke="#1a2a1a" strokeWidth="16" strokeLinecap="round"/>
        <path d="M 20 140 A 80 80 0 1 1 180 140" fill="none" stroke="url(#gaugeTrack)" strokeWidth="16" strokeLinecap="round"/>
        <g transform={`rotate(${angle}, 100, 140)`}>
          <line x1="100" y1="140" x2="100" y2="72" stroke={color} strokeWidth="3" strokeLinecap="round"/>
          <circle cx="100" cy="140" r="7" fill={color}/>
          <circle cx="100" cy="140" r="3" fill="#0a1a0a"/>
        </g>
        <text x="100" y="125" textAnchor="middle" fill={color} fontSize="22" fontWeight="700" fontFamily="'Courier New', monospace">{value}%</text>
        <text x="100" y="145" textAnchor="middle" fill="#4ade80" fontSize="10" opacity="0.7">{status}</text>
        <text x="22"  y="158" fill="#4ade80" fontSize="9" opacity="0.5">DRY</text>
        <text x="152" y="158" fill="#3b82f6" fontSize="9" opacity="0.5">WET</text>
      </svg>
    </div>
  )
}

function LoadingPulse({ text = 'Analyzing' }) {
  const [dots, setDots] = useState('')
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="loading-pulse">
      <div className="pulse-rings">
        <div className="ring ring1"/><div className="ring ring2"/><div className="ring ring3"/>
        <div className="pulse-core"/>
      </div>
      <span className="pulse-text">{text}{dots}</span>
    </div>
  )
}

export default function App() {
  const [tab, setTab]         = useState('main')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [mainForm, setMainForm] = useState({ N:'', P:'', K:'', temperature:'', humidity:'', ph:'', rainfall:'' })
  const [mainResult, setMainResult] = useState(null)
  const [yieldForm, setYieldForm]   = useState({ rainfall:'', temperature:'', pesticides:'', year:'2024' })
  const [yieldResult, setYieldResult] = useState(null)
  const [diseaseForm, setDiseaseForm] = useState({ crop:'rice', symptoms:[], method:'symptoms' })
  const [diseaseResult, setDiseaseResult] = useState(null)
  const [imageFile, setImageFile]         = useState(null)
  const [imagePreview, setImagePreview]   = useState(null)
  const [sensorForm, setSensorForm]       = useState({ moisture:'', humidity:'', temperature:'', crop:'rice' })
  const [sensorResult, setSensorResult]   = useState(null)

  // ── Live IoT polling ──────────────────────────────────────────────────────
  const [userPickedCrop, setUserPickedCrop] = useState(false)

  useEffect(() => {
    if (tab !== 'sensors') return
    const poll = async () => {
      try {
        const { data } = await axios.get(`${API}/sensors/live`)
        if (data.status !== 'no_data' && data.moisture) {
          setSensorResult(data)
          if (data.raw) {
            setSensorForm(prev => ({
              ...prev,
              moisture   : String(data.raw.moisture),
              humidity   : String(data.raw.humidity),
              temperature: String(data.raw.temperature),
              // only update crop if user has not manually picked one
              crop       : userPickedCrop ? prev.crop : (data.raw.crop || prev.crop)
            }))
          }
        }
      } catch(e) {}
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [tab, userPickedCrop])
  // ─────────────────────────────────────────────────────────────────────────

  const handleMain = async e => {
    e.preventDefault(); setLoading(true); setError(''); setMainResult(null)
    try { const { data } = await axios.post(`${API}/recommend`, mainForm); setMainResult(data) }
    catch(err) { setError(err.response?.data?.error || 'Flask server not responding') }
    finally { setLoading(false) }
  }

  const handleYield = async e => {
    e.preventDefault(); setLoading(true); setError(''); setYieldResult(null)
    try { const { data } = await axios.post(`${API}/yield`, yieldForm); setYieldResult(data) }
    catch(err) { setError(err.response?.data?.error || 'Flask server not responding') }
    finally { setLoading(false) }
  }

  const handleDisease = async e => {
    e.preventDefault(); setLoading(true); setError(''); setDiseaseResult(null)
    try {
      if (diseaseForm.method === 'symptoms') {
        const { data } = await axios.post(`${API}/disease/symptoms`, { crop: diseaseForm.crop, symptoms: diseaseForm.symptoms })
        setDiseaseResult(data)
      } else {
        const fd = new FormData(); fd.append('file', imageFile)
        const { data } = await axios.post(`${API}/disease/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        setDiseaseResult(data)
      }
    } catch(err) { setError(err.response?.data?.error || 'Flask server not responding') }
    finally { setLoading(false) }
  }

  const handleSensor = async e => {
    e.preventDefault(); setLoading(true); setError(''); setSensorResult(null)
    try { const { data } = await axios.post(`${API}/sensors`, sensorForm); setSensorResult(data) }
    catch(err) { setError(err.response?.data?.error || 'Flask server not responding') }
    finally { setLoading(false) }
  }

  const toggleSymptom = s => setDiseaseForm(p => ({
    ...p, symptoms: p.symptoms.includes(s) ? p.symptoms.filter(x => x !== s) : [...p.symptoms, s]
  }))

  const radarData = mainResult ? {
    labels: ['N', 'P', 'K', 'pH', 'Temp', 'Humidity', 'Rainfall'],
    datasets: [{
      label: 'Soil & Weather Profile',
      data: [
        Math.min(parseFloat(mainForm.N) / 140 * 100, 100),
        Math.min(parseFloat(mainForm.P) / 145 * 100, 100),
        Math.min(parseFloat(mainForm.K) / 205 * 100, 100),
        Math.min(parseFloat(mainForm.ph) / 14 * 100, 100),
        Math.min(parseFloat(mainForm.temperature) / 50 * 100, 100),
        Math.min(parseFloat(mainForm.humidity), 100),
        Math.min(parseFloat(mainForm.rainfall) / 300 * 100, 100),
      ],
      backgroundColor: 'rgba(74,222,128,0.15)',
      borderColor: '#4ade80',
      pointBackgroundColor: '#4ade80',
      pointBorderColor: '#0a1a0a',
      pointRadius: 4,
    }]
  } : null

  const altBarData = mainResult ? {
    labels: mainResult.alternatives.map(a => a.crop),
    datasets: [{
      label: 'Confidence %',
      data: mainResult.alternatives.map(a => a.confidence),
      backgroundColor: ['rgba(74,222,128,0.8)', 'rgba(74,222,128,0.4)', 'rgba(74,222,128,0.2)'],
      borderColor: '#4ade80',
      borderWidth: 1,
      borderRadius: 6,
    }]
  } : null

  const tabs = [
    { id: 'main',    label: 'Crop & Irrigation', icon: '⬡' },
    { id: 'yield',   label: 'Yield Prediction',  icon: '◈' },
    { id: 'disease', label: 'Disease Detection', icon: '◎' },
    { id: 'sensors', label: 'IoT Sensors',        icon: '◉' },
  ]

  return (
    <div className="app">
      <ParticleCanvas />
      <div className="scan-line"/>

      <header className="header">
        <div className="header-glow"/>
        <div className="header-content">
          <div className="logo-mark">
            <span className="logo-hex">⬡</span>
            <div className="logo-text">
              <h1>AGRI<span className="logo-accent">INTEL</span></h1>
              <p>Precision Farming Intelligence System</p>
            </div>
          </div>
          <div className="header-stats">
            <div className="hstat"><span className="hstat-val">99.55%</span><span className="hstat-lbl">Model Accuracy</span></div>
            <div className="hstat-div"/>
            <div className="hstat"><span className="hstat-val">22</span><span className="hstat-lbl">Crop Classes</span></div>
            <div className="hstat-div"/>
            <div className="hstat"><span className="hstat-val">7</span><span className="hstat-lbl">AI Outputs</span></div>
          </div>
        </div>
      </header>

      <nav className="nav">
        {tabs.map(t => (
          <button key={t.id} className={`nav-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => { setTab(t.id); setError('') }}>
            <span className="nav-icon">{t.icon}</span>
            <span className="nav-label">{t.label}</span>
            {tab === t.id && <span className="nav-active-bar"/>}
          </button>
        ))}
      </nav>

      <main className="main">
        {error && <div className="error"><span className="error-icon">⚠</span>{error}</div>}
        {loading && <LoadingPulse text={
          tab === 'main' ? 'Analyzing soil parameters' :
          tab === 'yield' ? 'Predicting crop yield' :
          tab === 'disease' ? 'Scanning for diseases' : 'Reading sensor data'
        }/>}

        {tab === 'main' && !loading && (
          <div className="section fade-in">
            <div className="section-header">
              <span className="section-tag">MODULE 01</span>
              <h2>Crop Recommendation & Irrigation Analysis</h2>
            </div>
            <form onSubmit={handleMain} className="form">
              <div className="param-group">
                <div className="param-label"><span className="param-dot"/>Soil Parameters</div>
                <div className="grid-4">
                  {[['N','Nitrogen','kg/ha'],['P','Phosphorus','kg/ha'],['K','Potassium','kg/ha'],['ph','Soil pH','3.5–9.9']].map(([k,l,u]) => (
                    <div className="field" key={k}>
                      <label>{l} <span className="unit">{u}</span></label>
                      <input type="number" step="0.1" placeholder="0"
                        value={mainForm[k]}
                        onChange={e => setMainForm({...mainForm,[k]:e.target.value})} required/>
                    </div>
                  ))}
                </div>
              </div>
              <div className="param-group">
                <div className="param-label"><span className="param-dot"/>Weather Parameters</div>
                <div className="grid-3">
                  {[['temperature','Temperature','°C'],['humidity','Humidity','%'],['rainfall','Rainfall','mm']].map(([k,l,u]) => (
                    <div className="field" key={k}>
                      <label>{l} <span className="unit">{u}</span></label>
                      <input type="number" step="0.1" placeholder="0"
                        value={mainForm[k]}
                        onChange={e => setMainForm({...mainForm,[k]:e.target.value})} required/>
                    </div>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn-primary">
                <span className="btn-icon">⬡</span> Run Analysis
              </button>
            </form>

            {mainResult && (
              <div className="results fade-in">
                <div className="result-hero">
                  <div className="hero-crop">
                    <span className="hero-label">Recommended Crop</span>
                    <span className="hero-value">{mainResult.crop.toUpperCase()}</span>
                    <div className="confidence-bar-wrap">
                      <div className="confidence-bar" style={{width:`${mainResult.confidence}%`}}/>
                    </div>
                    <span className="hero-conf">{mainResult.confidence}% confidence</span>
                  </div>
                  <div className="hero-cards">
                    <div className="mini-card">
                      <span className="mini-icon">◈</span>
                      <span className="mini-label">Irrigation</span>
                      <span className="mini-value">{mainResult.irrigation.level}</span>
                      <span className="mini-sub">{mainResult.irrigation.amount}</span>
                    </div>
                    <div className="mini-card">
                      <span className="mini-icon">◎</span>
                      <span className="mini-label">Fertilizer</span>
                      <span className="mini-value">NPK</span>
                      <span className="mini-sub">{mainResult.fertilizer[0].split('—')[0]}</span>
                    </div>
                  </div>
                </div>

                <div className="charts-row">
                  <div className="chart-card">
                    <div className="chart-title">Soil & Weather Profile</div>
                    <Radar data={radarData} options={{
                      responsive: true,
                      plugins: { legend: { display: false } },
                      scales: { r: {
                        grid: { color: 'rgba(74,222,128,0.15)' },
                        ticks: { display: false },
                        pointLabels: { color: '#4ade80', font: { size: 11 } }
                      }}
                    }}/>
                  </div>
                  <div className="chart-card">
                    <div className="chart-title">Alternative Crops</div>
                    <Bar data={altBarData} options={{
                      responsive: true,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { color: 'rgba(74,222,128,0.1)' }, ticks: { color: '#4ade80' } },
                        y: { grid: { color: 'rgba(74,222,128,0.1)' }, ticks: { color: '#4ade80' }, max: 100 }
                      }
                    }}/>
                  </div>
                </div>

                <div className="detail-row">
                  <div className="detail-card">
                    <span className="detail-tag">Irrigation Method</span>
                    <p>{mainResult.irrigation.method}</p>
                  </div>
                  <div className="detail-card">
                    <span className="detail-tag">Fertilizer Recommendation</span>
                    <p>{mainResult.fertilizer[0]}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'yield' && !loading && (
          <div className="section fade-in">
            <div className="section-header">
              <span className="section-tag">MODULE 02</span>
              <h2>Crop Yield Prediction</h2>
            </div>
            <form onSubmit={handleYield} className="form">
              <div className="param-group">
                <div className="param-label"><span className="param-dot"/>Prediction Parameters</div>
                <div className="grid-2">
                  {[['rainfall','Annual Rainfall','mm'],['temperature','Avg Temperature','°C'],['pesticides','Pesticides Used','tonnes'],['year','Harvest Year','YYYY']].map(([k,l,u]) => (
                    <div className="field" key={k}>
                      <label>{l} <span className="unit">{u}</span></label>
                      <input type="number" step="0.1" placeholder="0"
                        value={yieldForm[k]}
                        onChange={e => setYieldForm({...yieldForm,[k]:e.target.value})} required/>
                    </div>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn-primary">
                <span className="btn-icon">◈</span> Predict Yield
              </button>
            </form>

            {yieldResult && (
              <div className="results fade-in">
                <div className="yield-display">
                  <div className="yield-main">
                    <span className="yield-label">Estimated Yield</span>
                    <span className="yield-number">{yieldResult.yield_tonnes_per_ha}</span>
                    <span className="yield-unit">tonnes / hectare</span>
                  </div>
                  <div className="yield-cards">
                    <div className="yield-card">
                      <span>{yieldResult.yield_hg_per_ha.toLocaleString()}</span>
                      <small>hg / ha</small>
                    </div>
                    <div className="yield-card">
                      <span>{yieldResult.yield_kg_per_ha.toLocaleString()}</span>
                      <small>kg / ha</small>
                    </div>
                  </div>
                </div>
                <div className="yield-bar-wrap">
                  <div className="yield-bar-track">
                    <div className="yield-bar-fill" style={{width:`${Math.min(yieldResult.yield_tonnes_per_ha / 10 * 100, 100)}%`}}/>
                  </div>
                  <span className="yield-bar-label">Yield scale (0–10 t/ha)</span>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'disease' && !loading && (
          <div className="section fade-in">
            <div className="section-header">
              <span className="section-tag">MODULE 03</span>
              <h2>Disease Detection System</h2>
            </div>
            <form onSubmit={handleDisease} className="form">
              <div className="method-toggle">
                {['symptoms','image'].map(m => (
                  <button key={m} type="button"
                    className={`toggle-btn ${diseaseForm.method === m ? 'active' : ''}`}
                    onClick={() => setDiseaseForm({...diseaseForm, method: m})}>
                    {m === 'symptoms' ? '◎ Symptom Analysis' : '⬡ Image Scan'}
                  </button>
                ))}
              </div>

              <div className="field">
                <label>Target Crop</label>
                <select value={diseaseForm.crop}
                  onChange={e => setDiseaseForm({...diseaseForm, crop: e.target.value, symptoms:[]})}>
                  {Object.keys(SYMPTOMS).map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>
                  ))}
                </select>
              </div>

              {diseaseForm.method === 'symptoms' ? (
                <div className="field">
                  <label>Observed Symptoms <span className="unit">select all that apply</span></label>
                  <div className="symptom-grid">
                    {SYMPTOMS[diseaseForm.crop].map(s => (
                      <label key={s} className={`symptom-check ${diseaseForm.symptoms.includes(s) ? 'checked' : ''}`}>
                        <input type="checkbox" checked={diseaseForm.symptoms.includes(s)} onChange={() => toggleSymptom(s)}/>
                        <span>{s}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="field">
                  <label>Upload Leaf Image</label>
                  <div className="upload-zone" onClick={() => document.getElementById('leafimg').click()}>
                    {imagePreview
                      ? <img src={imagePreview} alt="preview" className="img-preview"/>
                      : <><span className="upload-icon">⬡</span><span>Click to upload leaf image</span><span className="upload-sub">JPG, PNG supported</span></>
                    }
                    <input id="leafimg" type="file" accept="image/*" style={{display:'none'}}
                      onChange={e => { setImageFile(e.target.files[0]); setImagePreview(URL.createObjectURL(e.target.files[0])) }}/>
                  </div>
                </div>
              )}

              <button type="submit" className="btn-primary">
                <span className="btn-icon">◎</span> Detect Disease
              </button>
            </form>

            {diseaseResult && (
              <div className="results fade-in">
                {diseaseResult.results && diseaseResult.results.length > 0 ? (
                  diseaseResult.results.map((r, i) => (
                    <div key={i} className={`disease-card sev-${(r.severity||'medium').toLowerCase()}`}>
                      <div className="disease-top">
                        <div>
                          <span className="disease-rank">#{i+1}</span>
                          <span className="disease-name">{r.disease}</span>
                        </div>
                        <div className="disease-badges">
                          {r.severity && <span className={`sev-badge sev-${r.severity.toLowerCase()}`}>{r.severity}</span>}
                          <span className="conf-badge">{r.confidence_pct || r.confidence}%</span>
                        </div>
                      </div>
                      {r.cause && <div className="disease-cause">⬡ {r.cause}</div>}
                      <div className="disease-actions">
                        {r.treatment && <div className="action-card treatment"><span className="action-label">Treatment</span><p>{r.treatment}</p></div>}
                        {r.prevention && <div className="action-card prevention"><span className="action-label">Prevention</span><p>{r.prevention}</p></div>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-result">◎ No disease matched — try selecting more symptoms</div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'sensors' && !loading && (
          <div className="section fade-in">
            <div className="section-header">
              <span className="section-tag">MODULE 04</span>
              <h2>IoT Sensor Dashboard</h2>
            </div>
            <form onSubmit={handleSensor} className="form">
              <div className="param-group">
                <div className="param-label"><span className="param-dot"/>Live Sensor Input</div>
                <div className="grid-2">
                  {[['moisture','Soil Moisture','%'],['humidity','Humidity','%'],['temperature','Temperature','°C']].map(([k,l,u]) => (
                    <div className="field" key={k}>
                      <label>{l} <span className="unit">{u}</span></label>
                      <input type="number" step="0.1" placeholder="0"
                        value={sensorForm[k]}
                        onChange={e => setSensorForm({...sensorForm,[k]:e.target.value})} required/>
                    </div>
                  ))}
                  <div className="field">
                    <label>Crop Type</label>
                    <select value={sensorForm.crop} onChange={e => { setUserPickedCrop(true); setSensorForm({...sensorForm,crop:e.target.value}) }}>
                      {['rice','wheat','maize','cotton','tomato','potato','sugarcane'].map(c => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <button type="submit" className="btn-primary">
                <span className="btn-icon">◉</span> Analyse Sensor Data
              </button>
            </form>

            {sensorResult && (
              <div className="results fade-in">
                <div className="sensor-display">
                  <MoistureGauge
                    value={parseFloat(sensorResult.moisture.water_amount_mm > 0
                      ? Math.max(0, 60 - sensorResult.moisture.water_amount_mm)
                      : sensorForm.moisture)}
                    status={sensorResult.moisture.status}
                  />
                  <div className="sensor-cards">
                    <div className={`sensor-card moist-${sensorResult.moisture.status.toLowerCase()}`}>
                      <span className="sc-icon">◉</span>
                      <span className="sc-label">Soil Moisture</span>
                      <span className="sc-value">{sensorForm.moisture}%</span>
                      <span className="sc-status">{sensorResult.moisture.status}</span>
                      <span className="sc-action">{sensorResult.moisture.action}</span>
                    </div>
                    <div className={`sensor-card hum-${sensorResult.humidity.status.toLowerCase()}`}>
                      <span className="sc-icon">◈</span>
                      <span className="sc-label">Humidity</span>
                      <span className="sc-value">{sensorResult.humidity.value}%</span>
                      <span className="sc-status">{sensorResult.humidity.status}</span>
                      <span className="sc-action">{sensorResult.humidity.advice.split('.')[0]}</span>
                    </div>
                    <div className="sensor-card temp-normal">
                      <span className="sc-icon">⬡</span>
                      <span className="sc-label">Temperature</span>
                      <span className="sc-value">{sensorResult.temperature.value}°C</span>
                      <span className="sc-status">Live Reading</span>
                      <span className="sc-action">Celsius scale</span>
                    </div>
                  </div>
                </div>
                {sensorResult.moisture.water_needed && (
                  <div className="alert-critical">
                    <span className="alert-icon">⚠</span>
                    <div>
                      <strong>Irrigation Required</strong>
                      <p>Apply {sensorResult.moisture.water_amount_mm}mm of water — Urgency: {sensorResult.moisture.urgency}</p>
                    </div>
                  </div>
                )}
                <div className="detail-card">
                  <span className="detail-tag">Humidity Advisory</span>
                  <p>{sensorResult.humidity.advice}</p>
                </div>
                <div className="timestamp">Last updated: {sensorResult.timestamp}</div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="footer">
        <span>AGRI<span className="logo-accent">INTEL</span> — Smart Agriculture AI System</span>
        <span>Powered by Random Forest · CNN · IoT Integration</span>
      </footer>
    </div>
  )
}