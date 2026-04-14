import { useState } from 'react';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import './App.css';

export default function App() {
  const [apiKey, setApiKey] = useState('BE83781BCE80465CBD967FBA2E14E57B');
  const [divisionId, setDivisionId] = useState('18');
  const [events, setEvents] = useState([]);
  const [people, setPeople] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="app">
      <h1>Safety Dashboard</h1>
      <p>API Key: {apiKey}</p>
    </div>
  );
}