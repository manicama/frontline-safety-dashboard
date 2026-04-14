import { useState } from 'react';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './App.css';

const BASE = '/api/v1';

export default function App() {
  const [apiKey, setApiKey] = useState('BE83781BCE80465CBD967FBA2E14E57B');
  const [divisionId, setDivisionId] = useState('18');
  const [events, setEvents] = useState([]);
  const [people, setPeople] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const eventsRes = await fetch(`${BASE}/Events?ApiKey=${apiKey}`);
      const eventsText = await eventsRes.text();
      console.log('Events response:', eventsText.substring(0, 200));
      const allEvents = JSON.parse(eventsText);

      const peopleRes = await fetch(`${BASE}/Divisions/${divisionId}/people?ApiKey=${apiKey}`);
      const peopleText = await peopleRes.text();
      console.log('People response:', peopleText.substring(0, 200));
      const allPeople = JSON.parse(peopleText);

      const filtered = allEvents.filter(e => String(e.divisionID) === String(divisionId));
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
      complete: (results) => {
        console.log('First CSV row:', results.data[0]);
        console.log('CSV keys:', Object.keys(results.data[0]));
        setCsvData(results.data);
      }
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
  const hoursWorked = activeHeadcount * 2000;
  const recordable = events.filter(e => isRecordable(e.documentNumber) === true);
  const dartEvents = events.filter(e => isDART(e.documentNumber) === true);
  const trir = hoursWorked > 0 && csvData.length
    ? ((recordable.length * 200000) / hoursWorked).toFixed(2)
    : null;
  const dart = hoursWorked > 0 && csvData.length
    ? ((dartEvents.length * 200000) / hoursWorked).toFixed(2)
    : null;

  const pieData = csvData.length ? [
    { name: 'DART', value: dartEvents.length },
    { name: 'Recordable (non-DART)', value: recordable.length - dartEvents.length },
    { name: 'Not Recordable', value: events.length - recordable.length },
  ] : [];

  const COLORS = ['#ef9f27', '#378add', '#4a5060'];

  const barData = [
    { name: 'TRIR', yours: parseFloat(trir) || 0, industry: 2.7 },
    { name: 'DART', yours: parseFloat(dart) || 0, industry: 1.5 },
  ];

  return (
    <div className="app">
      <div className="header">
        <h1>Safety Metrics Dashboard</h1>
        <p className="subtitle">Frontline Data Solutions — EHS Analytics V1</p>
      </div>

      <div className="controls">
        <div className="control-group">
          <label>API Key</label>
          <input
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Enter API key"
          />
        </div>
        <div className="control-group">
          <label>Division ID</label>
          <input
            value={divisionId}
            onChange={e => setDivisionId(e.target.value)}
            placeholder="e.g. 18"
            style={{width: '80px'}}
          />
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
              <div className="kpi-value">{events.length}</div>
              <div className="kpi-sub">Division {divisionId}</div>
            </div>
            <div className="kpi-card red">
              <div className="kpi-label">Recordable</div>
              <div className="kpi-value">{csvData.length ? recordable.length : '—'}</div>
              <div className="kpi-sub">DART: {csvData.length ? dartEvents.length : '—'}</div>
            </div>
          </div>

          <div className="formula-bar">
            <span>TRIR = ({csvData.length ? recordable.length : 'N'} × 200,000) ÷ {hoursWorked.toLocaleString()} hrs</span>
            <span>DART = ({csvData.length ? dartEvents.length : 'N'} × 200,000) ÷ {hoursWorked.toLocaleString()} hrs</span>
            <span>Hours = {activeHeadcount} active employees × 2,000</span>
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
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </div>
            )}
            <div className="chart-card">
              <h3>TRIR vs DART vs Industry</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                  <XAxis dataKey="name" stroke="#5a6070" />
                  <YAxis stroke="#5a6070" />
                  <Tooltip />
                  <Bar dataKey="yours" fill="#378add" name="Your Rate" radius={[4,4,0,0]} />
                  <Bar dataKey="industry" fill="#3a4050" name="Industry Avg" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="table-card">
            <h3>Event Log ({events.length} events)</h3>
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
                {events.slice(0, 20).map(e => (
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
      )}
    </div>
  );
}