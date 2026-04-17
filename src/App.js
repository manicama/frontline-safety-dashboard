import { useState } from 'react';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import './App.css';

const BASE = '/api/v1';

function getPrefix(docNumber) {
  return docNumber ? docNumber.substring(0, 4).toLowerCase() : '';
}

function monthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (d.getFullYear() === 1900) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function quarterKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (d.getFullYear() === 1900) return null;
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `${d.getFullYear()} Q${q}`;
}

function inDateRange(dateStr, from, to) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (from && d < new Date(from)) return false;
  if (to && d > new Date(to)) return false;
  return true;
}

function monthsBetween(from, to) {
  if (!from || !to) return 12;
  const start = new Date(from);
  const end = new Date(to);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  return Math.max(1, months);
}

export default function App() {
  const [apiKey, setApiKey] = useState('BE83781BCE80465CBD967FBA2E14E57B');
  const [divisionId, setDivisionId] = useState('18');
  const [events, setEvents] = useState([]);
  const [people, setPeople] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [trendView, setTrendView] = useState('month');
  const [configOpen, setConfigOpen] = useState(true);

  const [trirDateFrom, setTrirDateFrom] = useState('');
  const [trirDateTo, setTrirDateTo] = useState('');
  const [trendDateFrom, setTrendDateFrom] = useState('');
  const [trendDateTo, setTrendDateTo] = useState('');
  const [ftEmployees, setFtEmployees] = useState('');
  const [hoursPerMonth, setHoursPerMonth] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const eventsRes = await fetch(`${BASE}/Events?ApiKey=${apiKey}`);
      const eventsText = await eventsRes.text();
      const allEvents = JSON.parse(eventsText);

      const peopleRes = await fetch(`${BASE}/Companies/2/people?ApiKey=${apiKey}`);
      const peopleText = await peopleRes.text();
      const allPeople = JSON.parse(peopleText);

      const filtered = allEvents.filter(e => !e.voided);
      setEvents(filtered);
      setPeople(allPeople);
      setLoaded(true);
    } catch (err) {
      setError('API call failed: ' + err.message);
    }
    setLoading(false);
  }

  function handleCSV(e) {
    const file = e.target.files[0];
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      beforeFirstChunk: (chunk) => {
        const rows = chunk.split('\n');
        rows.splice(0, 2);
        return rows.join('\n');
      },
      complete: (results) => setCsvData(results.data)
    });
  }

  function isRecordable(docNumber) {
    const row = csvData.find(r => Object.values(r).includes(docNumber));
    if (!row) return null;
    const key = Object.keys(row).find(k => k.toLowerCase().includes('osh'));
    return row[key]?.trim().toLowerCase() === 'yes';
  }

  function isDART(docNumber) {
    const row = csvData.find(r => Object.values(r).includes(docNumber));
    if (!row) return null;
    const key = Object.keys(row).find(k => k.toLowerCase().includes('result') || k.toLowerCase().includes('dart'));
    return row[key]?.trim().toLowerCase() === 'yes';
  }

  const activeHeadcount = people.filter(p => p.active === -1).length;
  const enteredFT = parseFloat(ftEmployees) || activeHeadcount;
  const enteredHoursPerMonth = parseFloat(hoursPerMonth) || 167;
  const months = monthsBetween(trirDateFrom, trirDateTo);
  const computedHours = enteredFT * enteredHoursPerMonth * months;

  const trirFilteredEvents = events.filter(e =>
    trirDateFrom || trirDateTo
      ? inDateRange(e.dateDrafted, trirDateFrom, trirDateTo)
      : true
  );

  const trendFilteredEvents = events.filter(e =>
    trendDateFrom || trendDateTo
      ? inDateRange(e.dateDrafted, trendDateFrom, trendDateTo)
      : true
  );

  const recordable = trirFilteredEvents.filter(e => isRecordable(e.documentNumber) === true);
  const dartEvents = trirFilteredEvents.filter(e => isDART(e.documentNumber) === true);

  const trir = computedHours > 0 && csvData.length
    ? ((recordable.length * 200000) / computedHours).toFixed(2)
    : null;
  const dart = computedHours > 0 && csvData.length
    ? ((dartEvents.length * 200000) / computedHours).toFixed(2)
    : null;

  const csvMatchedEvents = trirFilteredEvents.filter(e =>
    csvData.some(r => Object.values(r).includes(e.documentNumber))
  );

  const nearMissEvents = trendFilteredEvents.filter(e => getPrefix(e.documentNumber) === 'near');
  const incidentEvents = trendFilteredEvents.filter(e => getPrefix(e.documentNumber) === 'inci');

  const nearMissRate = trendFilteredEvents.length > 0
    ? ((nearMissEvents.length / trendFilteredEvents.length) * 100).toFixed(1)
    : null;

  const pieData = csvData.length ? [
    { name: 'DART', value: dartEvents.length },
    { name: 'Recordable (non-DART)', value: recordable.length - dartEvents.length },
    { name: 'Not Recordable', value: csvMatchedEvents.length - recordable.length },
  ] : [];

  const COLORS = ['#ef9f27', '#378add', '#c8d0dc'];

  const barData = [
    { name: 'TRIR', yours: parseFloat(trir) || 0, industry: 2.7 },
    { name: 'DART', yours: parseFloat(dart) || 0, industry: 1.5 },
  ];

  const trendData = (() => {
    const map = {};
    trendFilteredEvents.forEach(e => {
      const key = trendView === 'month'
        ? monthKey(e.dateDrafted)
        : quarterKey(e.dateDrafted);
      if (!key) return;
      if (!map[key]) map[key] = { period: key, incidents: 0, nearMiss: 0, total: 0 };
      map[key].total++;
      if (getPrefix(e.documentNumber) === 'inci') map[key].incidents++;
      if (getPrefix(e.documentNumber) === 'near') map[key].nearMiss++;
    });
    return Object.values(map).sort((a, b) => a.period.localeCompare(b.period));
  })();

  return (
    <div className="app">
      <div className="header">
        <h1>Safety Metrics Dashboard</h1>
        <p className="subtitle">Frontline Data Solutions — EHS Analytics V1</p>
      </div>

      <div className="controls">
        <div className="control-group">
          <label>API Key</label>
          <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Enter API key" />
        </div>
        <div className="control-group">
          <label>Division ID</label>
          <input value={divisionId} onChange={e => setDivisionId(e.target.value)} placeholder="e.g. 18" style={{width: '80px'}} />
        </div>
        <button onClick={loadData} disabled={loading}>
          {loading ? 'Loading...' : 'Load Data'}
        </button>
        <div className="control-group">
          <label>Upload CSV Export</label>
          <input type="file" accept=".csv" onChange={handleCSV} />
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {loaded && (
        <div className="dashboard">

          <div className="config-panel">
            <div className="config-header" onClick={() => setConfigOpen(!configOpen)}>
              <div className="config-title">
                <span className="config-icon">⚙</span>
                Admin Configuration
              </div>
              <span className="config-toggle">{configOpen ? '▲ Collapse' : '▼ Expand'}</span>
            </div>
            {configOpen && (
              <div className="config-body">
                <div className="config-section">
                  <div className="config-section-title">Workforce & Hours</div>
                  <div className="config-row">
                    <div className="control-group">
                      <label>Full Time Employees</label>
                      <input
                        type="number"
                        value={ftEmployees}
                        onChange={e => setFtEmployees(e.target.value)}
                        placeholder="Enter number"
                        style={{width:'160px'}}
                      />
                    </div>
                    <div className="control-group">
                      <label>Hours Worked Per Month</label>
                      <input
                        type="number"
                        value={hoursPerMonth}
                        onChange={e => setHoursPerMonth(e.target.value)}
                        placeholder="Enter hours"
                        style={{width:'160px'}}
                      />
                    </div>
                    {(ftEmployees || hoursPerMonth) && (
                      <div className="config-total-hours">
                        Total hours: <strong>{computedHours.toLocaleString()}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="section-block">
            <div className="section-header">
              <div className="section-header-left">
                <h2>TRIR & DART</h2>
                <p>Recordable incident rates compared to industry benchmarks</p>
              </div>
              <div className="date-filter-group">
                <span className="date-filter-label">Date Range</span>
                <input type="date" value={trirDateFrom} onChange={e => setTrirDateFrom(e.target.value)} />
                <span className="date-sep">→</span>
                <input type="date" value={trirDateTo} onChange={e => setTrirDateTo(e.target.value)} />
                {(trirDateFrom || trirDateTo) && (
                  <button className="btn-clear" onClick={() => { setTrirDateFrom(''); setTrirDateTo(''); }}>Clear</button>
                )}
              </div>
            </div>

            <div className="kpi-grid">
              <div className="kpi-card blue">
                <div className="kpi-label">TRIR</div>
                <div className="kpi-value">{trir ?? '—'}</div>
                <div className="kpi-sub">Industry avg: 2.7</div>
              </div>
              <div className="kpi-card amber">
                <div className="kpi-label">DART Rate</div>
                <div className="kpi-value">{dart ?? '—'}</div>
                <div className="kpi-sub">Industry avg: 1.5</div>
              </div>
              <div className="kpi-card green">
                <div className="kpi-label">Total Events</div>
                <div className="kpi-value">{csvData.length ? csvMatchedEvents.length : '—'}</div>
                <div className="kpi-sub">Division: Denver</div>
              </div>
              <div className="kpi-card red">
                <div className="kpi-label">Recordable</div>
                <div className="kpi-value">{csvData.length ? recordable.length : '—'}</div>
                <div className="kpi-sub">DART: {csvData.length ? dartEvents.length : '—'}</div>
              </div>
            </div>

            <div className="charts-grid">
              {csvData.length > 0 && (
                <div className="chart-card">
                  <h3>Incident Breakdown</h3>
                  <PieChart width={300} height={250}>
                    <Pie
                      data={pieData}
                      cx={150}
                      cy={110}
                      outerRadius={90}
                      innerRadius={50}
                      dataKey="value"
                      label={({name, value}) => `${name}: ${value}`}
                    >
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </div>
              )}
              <div className="chart-card">
                <h3>TRIR vs DART vs Industry</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8edf2" />
                    <XAxis dataKey="name" stroke="#8a94a6" />
                    <YAxis stroke="#8a94a6" />
                    <Tooltip />
                    <Bar dataKey="yours" fill="#378add" name="Your Rate" radius={[4,4,0,0]} />
                    <Bar dataKey="industry" fill="#c8d0dc" name="Industry Avg" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="table-card">
              <h3>Event Log ({csvMatchedEvents.length} events)</h3>
              <table>
                <thead>
                  <tr>
                    <th>Event Number</th>
                    <th>Title</th>
                    <th>Date</th>
                    <th>Stage</th>
                    <th>OSHA Recordable</th>
                    <th>DART</th>
                  </tr>
                </thead>
                <tbody>
                  {csvMatchedEvents.slice(0, 20).map(e => (
                    <tr key={e.eventId}>
                      <td className="doc-num">{e.documentNumber}</td>
                      <td>{e.title?.substring(0, 40)}</td>
                      <td>{e.dateDrafted?.substring(0, 10)}</td>
                      <td>{e.stage?.trim()}</td>
                      <td>
                        {isRecordable(e.documentNumber) === null
                          ? '—'
                          : isRecordable(e.documentNumber)
                          ? <span className="badge-yes">Yes</span>
                          : <span className="badge-no">No</span>}
                      </td>
                      <td>
                        {isDART(e.documentNumber) === null
                          ? '—'
                          : isDART(e.documentNumber)
                          ? <span className="badge-dart">Yes</span>
                          : <span className="badge-no">No</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="section-block">
            <div className="section-header">
              <div className="section-header-left">
                <h2>Incident Insights</h2>
                <p>Near miss trends and incident patterns over time</p>
              </div>
              <div className="date-filter-group">
                <span className="date-filter-label">Date Range</span>
                <input type="date" value={trendDateFrom} onChange={e => setTrendDateFrom(e.target.value)} />
                <span className="date-sep">→</span>
                <input type="date" value={trendDateTo} onChange={e => setTrendDateTo(e.target.value)} />
                {(trendDateFrom || trendDateTo) && (
                  <button className="btn-clear" onClick={() => { setTrendDateFrom(''); setTrendDateTo(''); }}>Clear</button>
                )}
              </div>
            </div>

            <div className="kpi-grid">
              <div className="kpi-card amber">
                <div className="kpi-label">Near Miss Rate</div>
                <div className="kpi-value">{nearMissRate ?? '—'}%</div>
                <div className="kpi-sub">{nearMissEvents.length} of {trendFilteredEvents.length} events</div>
              </div>
              <div className="kpi-card blue">
                <div className="kpi-label">Total Incidents</div>
                <div className="kpi-value">{incidentEvents.length}</div>
                <div className="kpi-sub">OSHA recordable category</div>
              </div>
              <div className="kpi-card green">
                <div className="kpi-label">Near Misses</div>
                <div className="kpi-value">{nearMissEvents.length}</div>
                <div className="kpi-sub">Reported this period</div>
              </div>
              <div className="kpi-card red">
                <div className="kpi-label">Incident to Near Miss</div>
                <div className="kpi-value">
                  {nearMissEvents.length > 0
                    ? `1:${(nearMissEvents.length / Math.max(incidentEvents.length, 1)).toFixed(1)}`
                    : '—'}
                </div>
                <div className="kpi-sub">Higher ratio is better</div>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-header">
                <h3>Incident Trends</h3>
                <div className="toggle-group">
                  <button className={`toggle-btn ${trendView === 'month' ? 'active' : ''}`} onClick={() => setTrendView('month')}>Monthly</button>
                  <button className={`toggle-btn ${trendView === 'quarter' ? 'active' : ''}`} onClick={() => setTrendView('quarter')}>Quarterly</button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8edf2" />
                  <XAxis dataKey="period" stroke="#8a94a6" tick={{fontSize: 11}} />
                  <YAxis stroke="#8a94a6" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="incidents" stroke="#e24b4a" strokeWidth={2} dot={true} name="Incidents" />
                  <Line type="monotone" dataKey="nearMiss" stroke="#ef9f27" strokeWidth={2} dot={true} name="Near Miss" />
                  <Line type="monotone" dataKey="total" stroke="#378add" strokeWidth={2} dot={true} name="Total" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}