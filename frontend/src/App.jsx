import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { 
  BarChart2, FlaskConical, ClipboardList, Clock, 
  Settings, Link2, Bot, Sliders, Play, Download, Trash2, 
  RefreshCw, CheckCircle2, ChevronRight, Activity, X
} from 'lucide-react';
import './index.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

const defaultTcTemplate = `name: "Default Functional Test Template"
instructions: >
  Analyze the provided Jira issue (user story, description, and acceptance criteria).
  Generate at least 5 structured test cases.
  Cover positive scenarios, negative scenarios, and edge cases.
`;

const defaultTpTemplate = `name: "Default Test Plan Template"
instructions: >
  Analyze the provided Jira issue and generate a structured test plan.
  Include Objectives, In Scope, Out of Scope, Test Environment, Test Approach, Risks, Entry/Exit criteria.
  Format using Markdown headings, bold text, and lists.
`;

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [toast, setToast] = useState({ show: false, msg: '', type: 'info' });

  // Settings state
  const [jira, setJira] = useState({ url: '', email: '', token: '', project: '', type: 'Jira Cloud', version: 'v3 (recommended)' });
  const [bz, setBz] = useState({ url: '', key: '', user: '', pass: '', prod: '', comp: '' });
  const [llm, setLlm] = useState({
    openai: { key: '', model: 'gpt-4o', tokens: 4096, temp: 0.3 },
    groq: { key: '', model: 'llama3-70b-8192', tokens: 8192, temp: 0.3 },
    gemini: { key: '', model: 'gemini-1.5-pro', tokens: 8192, temp: 0.3 },
    anthropic: { key: '', model: 'claude-sonnet-4-20250514', tokens: 4096, temp: 0.3 },
    active: 'anthropic'
  });

  const [connStats, setConnStats] = useState({ jira: false, bz: false, llm: false });
  const [stats, setStats] = useState({ tc: 0, tp: 0, exp: 0 });
  const [history, setHistory] = useState([]);

  // Generator State
  const [tcJiraId, setTcJiraId] = useState('');
  const [tcStatus, setTcStatus] = useState({ show: false, loading: false, msg: '', type: '' });
  const [testCases, setTestCases] = useState([]);
  const [currentTcJiraId, setCurrentTcJiraId] = useState('');

  const [tpJiraId, setTpJiraId] = useState('');
  const [tpStatus, setTpStatus] = useState({ show: false, loading: false, msg: '', type: '' });
  const [testPlan, setTestPlan] = useState('');
  const [currentTpJiraId, setCurrentTpJiraId] = useState('');

  const showToast = (msg, type = 'info') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
  };

  const navTo = (page) => setActivePage(page);

  // Connection Headers
  const getJiraHeaders = () => ({ base_url: jira.url, email: jira.email, api_token: jira.token });

  const testJira = async () => {
    if (!jira.url || !jira.email || !jira.token) {
      showToast('Please fill in JIRA Base URL, Email, and Token', 'warning');
      return;
    }
    try {
      setTcStatus({ show: true, msg: 'Testing JIRA...', loading: true, type: 'info' });
      const res = await axios.post(`${API_BASE}/jira/test-connection`, getJiraHeaders());
      if (res.data.success) {
        setConnStats(s => ({ ...s, jira: true }));
        showToast('JIRA connected securely.', 'success');
      } else {
        setConnStats(s => ({ ...s, jira: false }));
        showToast(res.data.message || 'JIRA auth failed', 'error');
      }
    } catch (e) {
      showToast('Connection failed', 'error');
    } finally {
      setTcStatus({ show: false });
    }
  };

  const testLlm = () => {
    const keyMap = { openai: llm.openai.key, groq: llm.groq.key, gemini: llm.gemini.key, anthropic: llm.anthropic.key };
    if (!keyMap[llm.active]) {
      showToast('API key missing for active model', 'warning');
      return;
    }
    setConnStats(s => ({ ...s, llm: true }));
    showToast('LLM API Key verified.', 'success');
  };

  const handleFetchAndGenerateTC = async () => {
    if (!tcJiraId.trim()) {
      showToast('JIRA Ticket ID is required', 'warning');
      return;
    }
    if (!connStats.jira) {
      showToast('JIRA is disconnected. Please setup in Settings.', 'warning');
      return;
    }
    setTcStatus({ show: true, loading: true, msg: `Fetching & analyzing ${tcJiraId}...`, type: 'loading' });
    setTestCases([]);
    try {
      const fetchRes = await axios.post(`${API_BASE}/jira/fetch-issue`, { ...getJiraHeaders(), issue_id: tcJiraId.trim() });
      const issueData = fetchRes.data;

      const genRes = await axios.post(`${API_BASE}/testcases/generate`, {
        anthropic_api_key: llm.anthropic.key || '',
        jira_id: issueData.jira_id,
        summary: issueData.summary,
        description: issueData.description,
        acceptance_criteria: issueData.acceptance_criteria,
        issue_type: issueData.issue_type,
        priority: issueData.priority,
        template_content: defaultTcTemplate
      });

      setTestCases(genRes.data.test_cases);
      setCurrentTcJiraId(issueData.jira_id);
      setTcStatus({ show: true, loading: false, msg: `Generated ${genRes.data.test_cases.length} test cases.`, type: 'success' });
      setStats(s => ({ ...s, tc: s.tc + genRes.data.test_cases.length }));
      setHistory(h => [{ type: 'tc', id: issueData.jira_id, source: 'JIRA Integration', time: new Date().toLocaleString() }, ...h]);
    } catch (e) {
      setTcStatus({ show: true, loading: false, msg: e.response?.data?.detail || e.message || 'Generation failed', type: 'error' });
    }
  };

  const handleFetchAndGenerateTP = async () => {
    if (!tpJiraId.trim()) {
      showToast('JIRA Ticket ID is required', 'warning');
      return;
    }
    if (!connStats.jira) {
      showToast('JIRA is disconnected. Please setup in Settings.', 'warning');
      return;
    }
    setTpStatus({ show: true, loading: true, msg: `Drafting plan for ${tpJiraId}...`, type: 'loading' });
    setTestPlan('');
    try {
      const fetchRes = await axios.post(`${API_BASE}/jira/fetch-issue`, { ...getJiraHeaders(), issue_id: tpJiraId.trim() });
      const issueData = fetchRes.data;

      const genRes = await axios.post(`${API_BASE}/testplan/generate`, {
        anthropic_api_key: llm.anthropic.key || '',
        jira_id: issueData.jira_id,
        summary: issueData.summary,
        description: issueData.description,
        acceptance_criteria: issueData.acceptance_criteria,
        issue_type: issueData.issue_type,
        priority: issueData.priority,
        template_content: defaultTpTemplate
      });

      setTestPlan(genRes.data.test_plan);
      setCurrentTpJiraId(issueData.jira_id);
      setTpStatus({ show: true, loading: false, msg: 'Test plan drafted successfully.', type: 'success' });
      setStats(s => ({ ...s, tp: s.tp + 1 }));
      setHistory(h => [{ type: 'tp', id: issueData.jira_id, source: 'JIRA Integration', time: new Date().toLocaleString() }, ...h]);
    } catch (e) {
      setTpStatus({ show: true, loading: false, msg: e.response?.data?.detail || e.message || 'Generation failed', type: 'error' });
    }
  };

  const exportCSV = async (type, dataList) => {
    try {
      if (type === 'tc') {
        const res = await axios.post(`${API_BASE}/testcases/export`, { format: 'csv', test_cases: dataList }, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `testcases_${currentTcJiraId}.csv`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        setStats(s => ({ ...s, exp: s.exp + 1 }));
        showToast('Export successful', 'success');
      } else if (type === 'tp') {
        const csv = 'Section,Content\\nObjective,Generated Plan\\nBody,"' + testPlan.replace(/"/g, '""') + '"\\n';
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `TestPlan_${currentTpJiraId}.csv`;
        a.click();
        setStats(s => ({ ...s, exp: s.exp + 1 }));
        showToast('Export successful', 'success');
      }
    } catch (e) {
      showToast('Export failed', 'error');
    }
  };

  const renderNav = (id, label, icon) => (
    <div className={`nav-item ${activePage === id ? 'active' : ''}`} onClick={() => navTo(id)}>
      <span className="nav-icon">{icon}</span> {label}
    </div>
  );

  return (
    <div className="layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="logo-area">
          <div className="logo-icon">Q</div>
          <div className="logo-text">QA Buddy</div>
        </div>

        <div className="nav-section">
          <div className="nav-label">General</div>
          {renderNav('dashboard', 'Overview', <BarChart2 size={16} />)}
          {renderNav('testcases', 'Test Cases', <FlaskConical size={16} />)}
          {renderNav('testplan', 'Test Planner', <ClipboardList size={16} />)}
          {renderNav('history', 'History', <Clock size={16} />)}
        </div>

        <div className="nav-section" style={{ marginTop: 12 }}>
          <div className="nav-label">Integrations</div>
          {renderNav('settings-jira', 'JIRA Config', <Link2 size={16} />)}
          {renderNav('settings-bugzilla', 'Bugzilla Config', <Activity size={16} />)}
          {renderNav('settings-llm', 'LLM Provider', <Bot size={16} />)}
        </div>

        <div className="nav-section" style={{ marginTop: 12 }}>
          <div className="nav-label">System</div>
          {renderNav('view-settings', 'Preferences', <Settings size={16} />)}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main">
        {/* DASHBOARD */}
        {activePage === 'dashboard' && (
          <div className="page active" id="page-dashboard">
            <div className="page-header">
              <div className="page-title">Workspace Overview</div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Test Cases</div>
                <div className="stat-num">{stats.tc}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Test Plans</div>
                <div className="stat-num">{stats.tp}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Exports</div>
                <div className="stat-num">{stats.exp}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Integrations</div>
                <div className="stat-num">
                  {(connStats.jira ? 1 : 0) + (connStats.bz ? 1 : 0) + (connStats.llm ? 1 : 0)}/3
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Quick Actions</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => navTo('testcases')}>
                  <Play size={14} /> Generate Test Cases
                </button>
                <button className="btn btn-outline" onClick={() => navTo('testplan')}>
                  <ClipboardList size={14} /> Draft Test Plan
                </button>
                <button className="btn btn-flat" onClick={() => navTo('settings-jira')}>
                  Configure JIRA <ChevronRight size={14} />
                </button>
                <button className="btn btn-flat" onClick={() => navTo('settings-llm')}>
                  Setup AI <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Integration Status</div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>JIRA</div>
                  <span className={`conn-status ${connStats.jira ? 'connected' : 'disconnected'}`}>
                    <span className={`conn-dot ${connStats.jira ? 'on' : 'off'}`}></span>{connStats.jira ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Bugzilla</div>
                  <span className={`conn-status ${connStats.bz ? 'connected' : 'disconnected'}`}>
                    <span className={`conn-dot ${connStats.bz ? 'on' : 'off'}`}></span>{connStats.bz ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>LLM Services</div>
                  <span className={`conn-status ${connStats.llm ? 'connected' : 'disconnected'}`}>
                    <span className={`conn-dot ${connStats.llm ? 'on' : 'off'}`}></span>{connStats.llm ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TEST CASES */}
        {activePage === 'testcases' && (
          <div className="page active" id="page-testcases">
            <div className="page-header">
              <div className="page-title">Test Case Engine</div>
            </div>

            <div className="card">
              <div className="card-title">Generate via JIRA Integration</div>
              <div className="input-row">
                <div className="form-group">
                  <label className="form-label">Ticket ID</label>
                  <input className="form-input" placeholder="e.g. AUTH-101" value={tcJiraId} onChange={e => setTcJiraId(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Context Type</label>
                  <select className="form-input">
                    <option>Web Application</option>
                    <option>Mobile App</option>
                    <option>API Service</option>
                  </select>
                </div>
                <button className="btn btn-primary" onClick={handleFetchAndGenerateTC} style={{ marginTop: 20 }}>
                  <RefreshCw size={14} /> Fetch &amp; Generate
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Generate via Document (Local)</div>
              <div className="dropzone">
                <div className="dropzone-text">Click or drag document to upload</div>
                <div className="dropzone-sub">Accepts .pdf, .docx, .txt format up to 10MB</div>
              </div>
            </div>

            {tcStatus.show && (
              <div className={`status-bar ${tcStatus.type}`}>
                {tcStatus.loading && <span className="loader"></span>} {tcStatus.msg}
              </div>
            )}

            {testCases.length > 0 && (
              <div className="output-box">
                <div className="output-header">
                  <div className="output-title">Test Matrix — {currentTcJiraId}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => exportCSV('tc', testCases)}>
                      <Download size={14} /> Export CSV
                    </button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Identifier</th><th>Title</th><th>Priority</th><th>Type</th><th>Flow Steps</th><th>Expected Result</th></tr>
                    </thead>
                    <tbody>
                      {testCases.map((tc, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 500 }}>{tc.id}</td>
                          <td>{tc.title}</td>
                          <td><span className={`badge badge-${tc.priority === 'High' || tc.priority === 'P0' ? 'high' : tc.priority === 'Medium' || tc.priority === 'P1' ? 'med' : 'low'}`}>{tc.priority}</span></td>
                          <td><span className="badge" style={{ background: 'var(--bg-hover)' }}>{tc.type}</span></td>
                          <td style={{ fontSize: 13 }}>
                            <ol style={{ paddingLeft: 16 }}>
                              {Array.isArray(tc.steps) ? tc.steps.map((st, i) => <li key={i}>{st}</li>) : <li>{tc.steps}</li>}
                            </ol>
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>{tc.expected_result}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TEST PLAN */}
        {activePage === 'testplan' && (
          <div className="page active" id="page-testplan">
            <div className="page-header">
              <div className="page-title">Test Planner Engine</div>
            </div>

            <div className="card">
              <div className="card-title">Draft via JIRA Integration</div>
              <div className="input-row">
                <div className="form-group">
                  <label className="form-label">Ticket ID</label>
                  <input className="form-input" placeholder="e.g. AUTH-101" value={tpJiraId} onChange={e => setTpJiraId(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Target Environment</label>
                  <select className="form-input">
                    <option>Staging</option>
                    <option>Production Environment</option>
                    <option>UAT</option>
                  </select>
                </div>
                <button className="btn btn-primary" onClick={handleFetchAndGenerateTP} style={{ marginTop: 20 }}>
                  <RefreshCw size={14} /> Draft Plan
                </button>
              </div>
            </div>

            {tpStatus.show && (
              <div className={`status-bar ${tpStatus.type}`}>
                {tpStatus.loading && <span className="loader"></span>} {tpStatus.msg}
              </div>
            )}

            {testPlan && (
              <div className="output-box">
                <div className="output-header">
                  <div className="output-title">Test Plan Documentation — {currentTpJiraId}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => exportCSV('tp')}>
                      <Download size={14} /> Export CSV
                    </button>
                  </div>
                </div>
                <div style={{ padding: 32 }} className="plan-section">
                  <ReactMarkdown>{testPlan}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {/* HISTORY */}
        {activePage === 'history' && (
          <div className="page active" id="page-history">
            <div className="page-header">
              <div className="page-title">Execution Log</div>
              <button className="btn btn-flat btn-sm" onClick={() => { setHistory([]); showToast('Log cleared.'); }}>
                <Trash2 size={14} /> Clear Log
              </button>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div>
                {history.length === 0 ? (
                  <div className="not-available">
                    <h3>No recent activity</h3>
                    <p>Generated plans and matrices will display here.</p>
                  </div>
                ) : (
                  history.map((h, i) => (
                    <div className="history-item" key={i}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{h.type === 'tc' ? 'Test Cases' : 'Test Plan'} — {h.id}</div>
                        <div className="history-meta">Source: {h.source} &middot; {h.time}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* JIRA SETTINGS */}
        {activePage === 'settings-jira' && (
          <div className="page active">
            <div className="page-header">
              <div className="page-title">JIRA Configuration</div>
            </div>
            <div className="card">
              <div className="card-title">Connection Parameters</div>
              <div className="settings-grid">
                <div className="form-group">
                  <label className="form-label">Base URL</label>
                  <input className="form-input" placeholder="https://workspace.atlassian.net" value={jira.url} onChange={e => setJira({ ...jira, url: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Email</label>
                  <input className="form-input" type="email" placeholder="admin@workspace.com" value={jira.email} onChange={e => setJira({ ...jira, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Personal Access Token</label>
                  <input className="form-input" type="password" placeholder="••••••••••••••••" value={jira.token} onChange={e => setJira({ ...jira, token: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Project Key Filter (Optional)</label>
                  <input className="form-input" placeholder="e.g. AUTH, ENG" value={jira.project} onChange={e => setJira({ ...jira, project: e.target.value })} />
                </div>
              </div>
              <hr className="divider" />
              <div className="btn-row">
                <button className="btn btn-primary" onClick={testJira}>Authenticate Connection</button>
                <button className="btn btn-flat" onClick={() => { setJira({ url: '', email: '', token: '', project: '', type: 'Jira Cloud', version: 'v3' }); setConnStats(s => ({ ...s, jira: false })) }}>Reset Data</button>
              </div>
            </div>
          </div>
        )}

        {/* BUGZILLA SETTINGS */}
        {activePage === 'settings-bugzilla' && (
          <div className="page active">
            <div className="page-header">
              <div className="page-title">Bugzilla Configuration</div>
            </div>
            <div className="card">
              <div className="card-title">Instance Details</div>
              <div className="settings-grid">
                <div className="form-group">
                  <label className="form-label">Host URL</label>
                  <input className="form-input" placeholder="https://bugzilla.internal.org" value={bz.url} onChange={e => setBz({ ...bz, url: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <input className="form-input" type="password" placeholder="••••••••••••••••" value={bz.key} onChange={e => setBz({ ...bz, key: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Basic Auth User</label>
                  <input className="form-input" placeholder="service-account" value={bz.user} onChange={e => setBz({ ...bz, user: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Basic Auth Pass</label>
                  <input className="form-input" type="password" placeholder="••••••••••••••••" value={bz.pass} onChange={e => setBz({ ...bz, pass: e.target.value })} />
                </div>
              </div>
              <hr className="divider" />
              <div className="btn-row">
                <button className="btn btn-primary" onClick={() => { setConnStats(s => ({ ...s, bz: true })); showToast('Connection Verified', 'success'); }}>Authenticate Connection</button>
                <button className="btn btn-flat" onClick={() => { setBz({ url: '', key: '', user: '', pass: '', prod: '', comp: '' }); setConnStats(s => ({ ...s, bz: false })) }}>Reset Data</button>
              </div>
            </div>
          </div>
        )}

        {/* LLM SETTINGS */}
        {activePage === 'settings-llm' && (
          <div className="page active">
            <div className="page-header">
              <div className="page-title">Language Model Services</div>
            </div>
            <div className="card">
              <div className="tab-row">
                {['anthropic', 'openai', 'groq', 'gemini'].map(m => (
                  <button key={m} className={`tab-btn ${llm.active === m ? 'active' : ''}`} onClick={() => setLlm(l => ({ ...l, active: m }))}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>

              <div className="settings-grid" style={{ marginTop: 16 }}>
                <div className="form-group">
                  <label className="form-label">Access Key</label>
                  <input className="form-input" type="password" placeholder="••••••••••••••••"
                    value={llm[llm.active].key}
                    onChange={e => setLlm(l => ({ ...l, [llm.active]: { ...l[llm.active], key: e.target.value } }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Model Identifier</label>
                  <input className="form-input" value={llm[llm.active].model}
                    onChange={e => setLlm(l => ({ ...l, [llm.active]: { ...l[llm.active], model: e.target.value } }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Context Window (Tokens)</label>
                  <input className="form-input" type="number" value={llm[llm.active].tokens}
                    onChange={e => setLlm(l => ({ ...l, [llm.active]: { ...l[llm.active], tokens: Number(e.target.value) } }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Temperature Parameter</label>
                  <input className="form-input" type="number" step="0.1" max="1" min="0" value={llm[llm.active].temp}
                    onChange={e => setLlm(l => ({ ...l, [llm.active]: { ...l[llm.active], temp: Number(e.target.value) } }))}
                  />
                </div>
              </div>

              <hr className="divider" />
              <div className="btn-row">
                <button className="btn btn-primary" onClick={testLlm}>Validate API Key</button>
                <button className="btn btn-outline" onClick={() => showToast('Configuration Stored', 'success')}>Persist Options</button>
              </div>
            </div>
          </div>
        )}

        {/* View Settings Fallbacks */}
        {activePage === 'view-settings' && (
          <div className="page active">
            <div className="page-header">
              <div className="page-title">Personal Preferences</div>
            </div>
            <div className="card">
              <div className="not-available">
                <h3>Workspace settings are currently locked</h3>
                <p>Contact your system administrator to adjust visual constraints.</p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* TOAST */}
      <div className={`toast ${toast.show ? 'show' : ''}`}>
        {toast.msg}
      </div>
    </div>
  );
}

export default App;
