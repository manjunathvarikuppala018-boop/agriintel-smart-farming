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
  const clampedVal = Math.min(Math.max(value, 0), max)
  const angle      = -135 + (clampedVal / max) * 270
  const color      = status === 'Critical' ? '#ef4444'
                   : status === 'Low'      ? '#f97316'
                   : status === 'Excess'   ? '#3b82f6'
                   : '#4ade80'

  // Compute filled arc path
  const toRad = deg => (deg * Math.PI) / 180
  const cx = 100, cy = 130, r = 75
  const startAngle = -225  // left end of arc
  const endAngle   = startAngle + (clampedVal / max) * 270
  const x1 = cx + r * Math.cos(toRad(startAngle))
  const y1 = cy + r * Math.sin(toRad(startAngle))
  const x2 = cx + r * Math.cos(toRad(endAngle))
  const y2 = cy + r * Math.sin(toRad(endAngle))
  const largeArc = endAngle - startAngle > 180 ? 1 : 0

  return (
    <div className="gauge-wrap">
      <svg viewBox="0 0 200 170" className="gauge-svg">
        <defs>
          <linearGradient id="gaugeTrack" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#ef4444" stopOpacity="0.3"/>
            <stop offset="45%"  stopColor="#4ade80" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.3"/>
          </linearGradient>
          <linearGradient id="gaugeFill" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#ef4444"/>
            <stop offset="45%"  stopColor="#4ade80"/>
            <stop offset="100%" stopColor="#3b82f6"/>
          </linearGradient>
        </defs>

        {/* Track arc */}
        <path
          d={`M ${cx + r * Math.cos(toRad(-225))} ${cy + r * Math.sin(toRad(-225))} A ${r} ${r} 0 1 1 ${cx + r * Math.cos(toRad(45))} ${cy + r * Math.sin(toRad(45))}`}
          fill="none" stroke="url(#gaugeTrack)" strokeWidth="14" strokeLinecap="round"
        />

        {/* Filled arc */}
        {clampedVal > 0 && (
          <path
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
            style={{filter:`drop-shadow(0 0 6px ${color}88)`}}
          />
        )}

        {/* Needle */}
        <g transform={`rotate(${angle}, ${cx}, ${cy})`}>
          <line x1={cx} y1={cy} x2={cx} y2={cy - 58}
            stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx={cx} cy={cy} r="6" fill={color}/>
          <circle cx={cx} cy={cy} r="2.5" fill="#0a1a0a"/>
        </g>

        {/* Value text */}
        <text x={cx} y={cy - 10} textAnchor="middle"
          fill={color} fontSize="24" fontWeight="800"
          fontFamily="'Courier New', monospace">{clampedVal}%</text>

        {/* Status text */}
        <text x={cx} y={cy + 10} textAnchor="middle"
          fill={color} fontSize="10" opacity="0.8" letterSpacing="1">{status.toUpperCase()}</text>

        {/* Labels */}
        <text x="18" y="155" fill="#ef4444" fontSize="9" opacity="0.6">DRY</text>
        <text x="160" y="155" fill="#3b82f6" fontSize="9" opacity="0.6">WET</text>
        <text x={cx} y="158" textAnchor="middle" fill="#4ade80" fontSize="8" opacity="0.4">SOIL MOISTURE</text>
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
  const [selectedCrop, setSelectedCrop] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherCity, setWeatherCity]       = useState('')
  const [weatherFetched, setWeatherFetched] = useState(false)
  const [yieldForm, setYieldForm]   = useState({ rainfall:'', temperature:'', pesticides:'', year:'2024' })
  const [yieldResult, setYieldResult] = useState(null)
  const [diseaseForm, setDiseaseForm] = useState({ crop:'rice', symptoms:[], method:'symptoms' })
  const [diseaseResult, setDiseaseResult] = useState(null)
  const [imageFile, setImageFile]         = useState(null)
  const [imagePreview, setImagePreview]   = useState(null)
  const [sensorForm, setSensorForm]       = useState({ moisture:'', humidity:'', temperature:'', crop:'rice' })
  const [autoForm, setAutoForm]           = useState({ moisture:'', humidity:'', temperature:'', crop:'rice' })
  const [manualForm, setManualForm]       = useState({ moisture:'', humidity:'', temperature:'', crop:'rice' })
  const [sensorResult, setSensorResult]   = useState(null)
  const [suitability, setSuitability]     = useState(null)
  const [sensorMode, setSensorMode]       = useState('auto')
  const [sensorResultMode, setSensorResultMode] = useState(null)
  const [soilForm, setSoilForm]           = useState({ N:'', P:'', K:'', ph:'', rainfall:'' })
  const [cropFromSensor, setCropFromSensor] = useState(null)
  const [showSoilForm, setShowSoilForm]   = useState(false)
  const [showAnyway, setShowAnyway]       = useState(false)

  // ── Live IoT polling ──────────────────────────────────────────────────────
  const [userPickedCrop, setUserPickedCrop] = useState(false)

  useEffect(() => {
    if (tab !== 'sensors') return
    const poll = async () => {
      try {
        const { data } = await axios.get(`${API}/sensors/live`)
        if (data.status !== 'no_data' && data.moisture) {
          if (sensorMode === 'auto') setSensorResult(data)
          if (data.raw) {
            setAutoForm(prev => ({
              ...prev,
              moisture   : String(data.raw.moisture),
              humidity   : String(data.raw.humidity),
              temperature: String(data.raw.temperature),
              crop       : userPickedCrop ? prev.crop : (data.raw.crop || prev.crop)
            }))
            // also sync sensorForm only in auto mode
            if (sensorMode === 'auto') {
              setSensorForm(prev => ({
                ...prev,
                moisture   : String(data.raw.moisture),
                humidity   : String(data.raw.humidity),
                temperature: String(data.raw.temperature),
                crop       : userPickedCrop ? prev.crop : (data.raw.crop || prev.crop)
              }))
            }
          }
        }
      } catch(e) {}
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [tab, userPickedCrop])
  // ─────────────────────────────────────────────────────────────────────────

  const fetchWeather = async () => {
    if (!weatherCity.trim()) return
    setWeatherLoading(true)
    try {
      const API_KEY = '594fec36c503ba3149eeca629e995acf'
      const geoRes  = await axios.get(
        `https://api.openweathermap.org/geo/1.0/direct?q=${weatherCity},IN&limit=1&appid=${API_KEY}`
      )
      if (!geoRes.data.length) { setError('City not found. Try again.'); setWeatherLoading(false); return }

      const { lat, lon } = geoRes.data[0]

      const weatherRes = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
      )

      const forecastRes = await axios.get(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&cnt=40`
      )

      const temp     = weatherRes.data.main.temp
      const humidity = weatherRes.data.main.humidity

      let totalRain = 0
      forecastRes.data.list.forEach(item => {
        if (item.rain && item.rain['3h']) totalRain += item.rain['3h']
      })
      const monthlyRainEstimate = Math.round(totalRain * 4.3)

      setMainForm(prev => ({
        ...prev,
        temperature: String(Math.round(temp * 10) / 10),
        humidity   : String(humidity),
        rainfall   : String(monthlyRainEstimate)
      }))
      setWeatherFetched(true)
      setError('')
    } catch(e) {
      setError('Weather fetch failed. Check city name or API key.')
    } finally {
      setWeatherLoading(false)
    }
  }

  const handleMain = async e => {
    e.preventDefault(); setLoading(true); setError(''); setMainResult(null); setSelectedCrop(null)
    try { const { data } = await axios.post(`${API}/recommend`, mainForm); setMainResult(data); setSelectedCrop(data.alternatives[0]) }
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
    e.preventDefault(); setLoading(true); setError(''); setSensorResult(null); setSuitability(null); setShowAnyway(false)
    const activeForm = sensorMode === 'auto' ? autoForm : manualForm
    try {
      const [sensorRes, suitRes] = await Promise.all([
        axios.post(`${API}/sensors`, activeForm),
        axios.post(`${API}/sensors/suitability`, {
          crop       : activeForm.crop,
          moisture   : parseFloat(activeForm.moisture) || 0,
          humidity   : parseFloat(activeForm.humidity) || 0,
          temperature: parseFloat(activeForm.temperature) || 0,
        })
      ])
      setSensorResult(sensorRes.data)
      setSuitability(suitRes.data)
      setSensorResultMode(sensorMode)
    }
    catch(err) { setError(err.response?.data?.error || 'Flask server not responding') }
    finally { setLoading(false) }
  }

  const handleCropFromSensor = async e => {
    e.preventDefault(); setLoading(true); setError(''); setCropFromSensor(null)
    try {
      const activeForm = sensorMode === 'auto' ? autoForm : manualForm
      const { data } = await axios.post(`${API}/recommend`, {
        N          : parseFloat(soilForm.N),
        P          : parseFloat(soilForm.P),
        K          : parseFloat(soilForm.K),
        ph         : parseFloat(soilForm.ph),
        rainfall   : parseFloat(soilForm.rainfall),
        temperature: parseFloat(activeForm.temperature) || 25,
        humidity   : parseFloat(activeForm.humidity) || 50,
      })
      setCropFromSensor(data)
    }
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

                {/* Auto-fetch weather */}
                <div className="weather-fetch-row">
                  <div className="field" style={{flex:1}}>
                    <label>City Name <span className="unit">auto-fill weather</span></label>
                    <input
                      type="text"
                      placeholder="e.g. Hyderabad"
                      value={weatherCity}
                      onChange={e => { setWeatherCity(e.target.value); setWeatherFetched(false) }}
                      onKeyDown={e => e.key === 'Enter' && fetchWeather()}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-weather"
                    onClick={fetchWeather}
                    disabled={weatherLoading || !weatherCity.trim()}>
                    {weatherLoading ? '...' : weatherFetched ? '✓ Fetched' : '⬡ Fetch'}
                  </button>
                </div>

                {weatherFetched && (
                  <div className="weather-fetched-info">
                    ◉ Weather auto-filled for {weatherCity} — edit manually if needed
                  </div>
                )}

                <div className="grid-3" style={{marginTop:'12px'}}>
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

                {/* ── Top 5 Crop Cards ── */}
                <div className="multi-rec-header">
                  <span className="section-tag" style={{marginBottom:'0.5rem',display:'inline-block'}}>CROP RECOMMENDATIONS</span>
                  <p className="multi-rec-sub">Select a crop to see detailed analysis</p>
                </div>
                <div className="multi-crop-grid">
                  {mainResult.alternatives.map((alt, i) => (
                    <div key={i}
                      className={"multi-crop-card " + (selectedCrop?.crop === alt.crop ? "mcc-selected" : "")}
                      onClick={() => setSelectedCrop(alt)}>
                      <div className="mcc-rank">#{i+1}</div>
                      <div className="mcc-name">{alt.crop.toUpperCase()}</div>
                      <div className="mcc-bar-wrap">
                        <div className="mcc-bar" style={{width:`${alt.confidence}%`,
                          background: i===0 ? '#4ade80' : i===1 ? '#22c55e' : i===2 ? '#16a34a' : 'rgba(74,222,128,0.4)'}}/>
                      </div>
                      <div className="mcc-conf">{alt.confidence}%</div>
                      {i === 0 && <div className="mcc-best-badge">Best Match</div>}
                    </div>
                  ))}
                </div>

                {/* ── Selected Crop Detail ── */}
                {selectedCrop && (
                  <div className="selected-crop-detail fade-in">
                    <div className="scd-header">
                      <span className="scd-crop">{selectedCrop.crop.toUpperCase()}</span>
                      <span className="scd-conf">{selectedCrop.confidence}% match</span>
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
                        <div className="chart-title">All Crop Confidence</div>
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

                    {/* ── NPK Improvement Suggestions ── */}
                    <div className="npk-suggestions">
                      <span className="detail-tag" style={{marginBottom:'0.8rem',display:'block'}}>⬡ Nutrient Improvement Suggestions</span>
                      <div className="npk-hint-grid">
                        {parseFloat(mainForm.N) < 40 && (
                          <div className="npk-hint">
                            <span className="npk-hint-icon npk-n">N</span>
                            <div>
                              <strong>Increase Nitrogen to 40–80 kg/ha</strong>
                              <p>Apply Urea (46-0-0) at 50 kg/ha. Boosts leafy crops like rice, wheat, maize.</p>
                            </div>
                          </div>
                        )}
                        {parseFloat(mainForm.N) >= 80 && (
                          <div className="npk-hint">
                            <span className="npk-hint-icon npk-n">N</span>
                            <div>
                              <strong>High Nitrogen — ideal for rice, maize, sugarcane</strong>
                              <p>Current N levels support high-yield cereal crops.</p>
                            </div>
                          </div>
                        )}
                        {parseFloat(mainForm.P) < 20 && (
                          <div className="npk-hint">
                            <span className="npk-hint-icon npk-p">P</span>
                            <div>
                              <strong>Increase Phosphorus to 20–60 kg/ha</strong>
                              <p>Apply DAP (18-46-0) at 30 kg/ha. Enables root crops like potato, carrot, groundnut.</p>
                            </div>
                          </div>
                        )}
                        {parseFloat(mainForm.P) >= 40 && (
                          <div className="npk-hint">
                            <span className="npk-hint-icon npk-p">P</span>
                            <div>
                              <strong>Good Phosphorus — supports fruiting crops</strong>
                              <p>Levels support tomato, cotton, chickpea, lentil cultivation.</p>
                            </div>
                          </div>
                        )}
                        {parseFloat(mainForm.K) < 20 && (
                          <div className="npk-hint">
                            <span className="npk-hint-icon npk-k">K</span>
                            <div>
                              <strong>Increase Potassium to 30–100 kg/ha</strong>
                              <p>Apply MOP (0-0-60) at 25 kg/ha. Improves disease resistance — enables banana, mango, potato.</p>
                            </div>
                          </div>
                        )}
                        {parseFloat(mainForm.K) >= 80 && (
                          <div className="npk-hint">
                            <span className="npk-hint-icon npk-k">K</span>
                            <div>
                              <strong>High Potassium — ideal for banana, papaya, coconut</strong>
                              <p>Current K levels are excellent for tropical fruit crops.</p>
                            </div>
                          </div>
                        )}
                        {(parseFloat(mainForm.ph) < 5.5 || parseFloat(mainForm.ph) > 7.5) && (
                          <div className="npk-hint">
                            <span className="npk-hint-icon npk-ph">pH</span>
                            <div>
                              <strong>Adjust pH to 6.0–7.0 for most crops</strong>
                              <p>{parseFloat(mainForm.ph) < 5.5
                                ? 'Soil too acidic — apply lime (CaCO₃) to raise pH. Enables wheat, maize, soybean.'
                                : 'Soil too alkaline — apply sulfur or gypsum to lower pH. Improves nutrient availability.'}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
                <div className="field" style={{marginTop:'1.2rem'}}>
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

            {/* ── Mode Toggle ── */}
            <div className="method-toggle" style={{marginBottom:'1.5rem'}}>
              <button type="button"
                className={`toggle-btn ${sensorMode === 'auto' ? 'active' : ''}`}
                onClick={() => { setSensorMode('auto'); setSensorResult(null); setSuitability(null); setShowAnyway(false) }}>
                ◉ Auto — IoT Device
              </button>
              <button type="button"
                className={`toggle-btn ${sensorMode === 'manual' ? 'active' : ''}`}
                onClick={() => { setSensorMode('manual'); setSensorResult(null); setSuitability(null); setShowAnyway(false); setManualForm({ moisture:'', humidity:'', temperature:'', crop:'rice' }) }}>
                ◈ Manual Input
              </button>
            </div>

            {/* ══ AUTO MODE ══ */}
            {sensorMode === 'auto' && (
              <div className="sensor-mode-panel">
                <div className="sensor-mode-info">
                  <span className="live-dot"/>
                  <span className="live-label">Live readings from Arduino — auto-updating every 3 seconds</span>
                </div>
                <div className="auto-readings-grid">
                  <div className="auto-reading-card">
                    <span className="arc-icon">◉</span>
                    <span className="arc-label">Soil Moisture</span>
                    <span className="arc-value">{autoForm.moisture || '--'}<span className="arc-unit">{autoForm.moisture ? '%' : ''}</span></span>
                  </div>
                  <div className="auto-reading-card">
                    <span className="arc-icon">◈</span>
                    <span className="arc-label">Humidity</span>
                    <span className="arc-value">{autoForm.humidity || '--'}<span className="arc-unit">{autoForm.humidity ? '%' : ''}</span></span>
                  </div>
                  <div className="auto-reading-card">
                    <span className="arc-icon">⬡</span>
                    <span className="arc-label">Temperature</span>
                    <span className="arc-value">{autoForm.temperature || '--'}<span className="arc-unit">{autoForm.temperature ? '°C' : ''}</span></span>
                  </div>
                </div>
                <form onSubmit={handleSensor} className="form" style={{marginTop:'1rem'}}>
                  <div className="field">
                    <label>Crop Type to Evaluate</label>
                    <select value={autoForm.crop} onChange={e => { setUserPickedCrop(true); setAutoForm({...autoForm,crop:e.target.value}); setSensorForm({...sensorForm,crop:e.target.value}) }}>
                      {['rice','wheat','maize','cotton','tomato','potato','sugarcane'].map(c => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="btn-primary" disabled={!autoForm.moisture}>
                    <span className="btn-icon">◉</span> Analyse Live Readings
                  </button>
                </form>
              </div>
            )}

            {/* ══ MANUAL MODE ══ */}
            {sensorMode === 'manual' && (
              <div className="sensor-mode-panel">
                <div className="sensor-mode-info manual-info">
                  <span className="manual-dot"/>
                  <span className="live-label">Enter sensor values manually</span>
                </div>
                <form onSubmit={e => { setSensorForm({...manualForm}); handleSensor(e) }} className="form">
                  <div className="param-group">
                    <div className="param-label"><span className="param-dot"/>Sensor Readings</div>
                    <div className="grid-2">
                      {[['moisture','Soil Moisture','%'],['humidity','Humidity','%'],['temperature','Temperature','°C']].map(([k,l,u]) => (
                        <div className="field" key={k}>
                          <label>{l} <span className="unit">{u}</span></label>
                          <input type="number" step="0.1" placeholder="0"
                            value={manualForm[k]}
                            onChange={e => setManualForm({...manualForm,[k]:e.target.value})} required/>
                        </div>
                      ))}
                      <div className="field">
                        <label>Crop Type</label>
                        <select value={manualForm.crop} onChange={e => setManualForm({...manualForm,crop:e.target.value})}>
                          {['rice','wheat','maize','cotton','tomato','potato','sugarcane'].map(c => (
                            <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <button type="submit" className="btn-primary">
                    <span className="btn-icon">◈</span> Analyse Sensor Data
                  </button>
                </form>
              </div>
            )}

            {sensorResult && sensorResultMode === sensorMode && (
              <div className="results fade-in">

                {/* ── Suitability Card ── */}
                {suitability && (
                  <div className={"suitability-card " + (suitability.suitable ? "suit-good" : "suit-bad")}>
                    <div className="suit-header">
                      <div>
                        <span className="suit-icon">{suitability.suitable ? "✓" : "✗"}</span>
                        <span className="suit-title">
                          {suitability.suitable
                            ? sensorForm.crop.charAt(0).toUpperCase() + sensorForm.crop.slice(1) + " — Ideal Conditions"
                            : sensorForm.crop.charAt(0).toUpperCase() + sensorForm.crop.slice(1) + " — Not Recommended"}
                        </span>
                      </div>
                      <span className="suit-pct">{suitability.suitability_pct}% match</span>
                    </div>

                    {/* Condition bars */}
                    <div className="suit-conditions">
                      {Object.entries(suitability.conditions).map(([key, val]) => (
                        <div key={key} className="suit-cond-row">
                          <span className="suit-cond-label">{key.charAt(0).toUpperCase()+key.slice(1)}</span>
                          <span className={"suit-cond-val " + (val.status === "optimal" ? "cond-ok" : "cond-bad")}>
                            {val.value}{key === "temperature" ? "°C" : "%"}
                          </span>
                          <span className="suit-cond-req">Required: {val.required}</span>
                          <span className={"suit-cond-badge " + (val.status === "optimal" ? "badge-ok" : "badge-bad")}>
                            {val.status === "optimal" ? "✓ OK" : val.status === "low" ? "↑ Low" : "↓ High"}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Issues */}
                    {suitability.issues.length > 0 && (
                      <div className="suit-issues">
                        {suitability.issues.map((issue, i) => (
                          <div key={i} className="suit-issue">⚠ {issue}</div>
                        ))}
                      </div>
                    )}

                    {/* Proceed anyway button */}
                    {!suitability.suitable && !showAnyway && (
                      <button className="btn-anyway" onClick={() => setShowAnyway(true)}>
                        Proceed anyway — show water & care requirements
                      </button>
                    )}
                  </div>
                )}

                {/* ── Sensor Readings (always show, or show if suitable/proceed anyway) ── */}
                {(suitability?.suitable || showAnyway || !suitability) && (
                  <>
                    <div className="sensor-display">
                      <MoistureGauge
                        value={parseFloat(sensorMode === 'auto' ? autoForm.moisture : manualForm.moisture) || 0}
                        status={sensorResult.moisture.status}
                      />
                      <div className="sensor-cards">
                        <div className={`sensor-card moist-${sensorResult.moisture.status.toLowerCase()}`}>
                          <span className="sc-icon">◉</span>
                          <span className="sc-label">Soil Moisture</span>
                          <span className="sc-value">{(sensorMode === 'auto' ? autoForm : manualForm).moisture}%</span>
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
                    {sensorResult.moisture.water_needed && suitability?.conditions?.moisture?.status !== 'optimal' && (
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
                  </>
                )}

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