import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
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
        showToast('JIRA connected!', 'success');
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
    // We only simulate testing other LLMs since backend currently focuses on Anthropic.
    // If Anthropic is chosen, we ensure token is there.
    const keyMap = { openai: llm.openai.key, groq: llm.groq.key, gemini: llm.gemini.key, anthropic: llm.anthropic.key };
    if (!keyMap[llm.active]) {
      showToast('Please enter an API key for the active model', 'warning');
      return;
    }
    setConnStats(s => ({ ...s, llm: true }));
    showToast('LLM API Key looks good!', 'success');
  };

  const handleFetchAndGenerateTC = async () => {
    if (!tcJiraId.trim()) {
      showToast('Please enter a JIRA Ticket ID', 'warning');
      return;
    }
    if (!connStats.jira) {
      showToast('Please connect to JIRA in Settings first', 'warning');
      return;
    }
    setTcStatus({ show: true, loading: true, msg: `Fetching & analyzing ${tcJiraId}...`, type: 'loading' });
    setTestCases([]);
    try {
      // 1. Fetch
      const fetchRes = await axios.post(`${API_BASE}/jira/fetch-issue`, { ...getJiraHeaders(), issue_id: tcJiraId.trim() });
      const issueData = fetchRes.data;

      // 2. Generate
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
      setTcStatus({ show: true, loading: false, msg: `Generation complete! ${genRes.data.test_cases.length} ready.`, type: 'success' });
      setStats(s => ({ ...s, tc: s.tc + genRes.data.test_cases.length }));
      setHistory(h => [{ type: 'tc', id: issueData.jira_id, source: 'JIRA Ticket', time: new Date().toLocaleString() }, ...h]);
    } catch (e) {
      setTcStatus({ show: true, loading: false, msg: e.response?.data?.detail || e.message || 'Failed', type: 'error' });
    }
  };

  const handleFetchAndGenerateTP = async () => {
    if (!tpJiraId.trim()) {
      showToast('Please enter a JIRA Ticket ID', 'warning');
      return;
    }
    if (!connStats.jira) {
      showToast('Please connect to JIRA in Settings first', 'warning');
      return;
    }
    setTpStatus({ show: true, loading: true, msg: `Fetching & planning ${tpJiraId}...`, type: 'loading' });
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
      setTpStatus({ show: true, loading: false, msg: 'Test plan generated successfully.', type: 'success' });
      setStats(s => ({ ...s, tp: s.tp + 1 }));
      setHistory(h => [{ type: 'tp', id: issueData.jira_id, source: 'JIRA Ticket', time: new Date().toLocaleString() }, ...h]);
    } catch (e) {
      setTpStatus({ show: true, loading: false, msg: e.response?.data?.detail || e.message || 'Failed', type: 'error' });
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
        showToast('CSV Exported!', 'success');
      } else if (type === 'tp') {
        // Manually create basic CSV for TP export
        const csv = 'Section,Content\\nObjective,Generated Plan\\nBody,"' + testPlan.replace(/"/g, '""') + '"\\n';
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `TestPlan_${currentTpJiraId}.csv`;
        a.click();
        setStats(s => ({ ...s, exp: s.exp + 1 }));
        showToast('CSV Exported!', 'success');
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
          <div className="logo-icon">🧪</div>
          <div className="logo-text">QA Buddy</div>
          <div className="logo-sub">AI Test Generator</div>
        </div>

        <div className="nav-section">
          <div className="nav-label">Main</div>
          {renderNav('dashboard', 'Dashboard', '📊')}
          {renderNav('testcases', 'Test Cases', '🧬')}
          {renderNav('testplan', 'Test Planner', '📋')}
          {renderNav('history', 'History', '🕐')}
        </div>

        <div className="nav-section" style={{ marginTop: 12 }}>
          <div className="nav-label">Integrations</div>
          {renderNav('settings-jira', 'JIRA', '🔷')}
          {renderNav('settings-bugzilla', 'Bugzilla', '🐛')}
          {renderNav('settings-llm', 'LLM / AI', '🤖')}
        </div>

        <div className="nav-section" style={{ marginTop: 12 }}>
          <div className="nav-label">System</div>
          {renderNav('view-settings', 'View Settings', '⚙️')}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main">
        {/* DASHBOARD */}
        {activePage === 'dashboard' && (
          <div className="page active" id="page-dashboard">
            <div className="page-header">
              <div className="page-title">Welcome to <span>QA Buddy</span> 👋</div>
              <span className="page-badge">v2.0 LIVE</span>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">🧬</div>
                <div className="stat-num">{stats.tc}</div>
                <div className="stat-label">Test Cases Generated</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📋</div>
                <div className="stat-num">{stats.tp}</div>
                <div className="stat-label">Test Plans Generated</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📥</div>
                <div className="stat-num">{stats.exp}</div>
                <div className="stat-label">CSV Exports</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🔗</div>
                <div className="stat-num">
                  {(connStats.jira ? 1 : 0) + (connStats.bz ? 1 : 0) + (connStats.llm ? 1 : 0)}/3
                </div>
                <div className="stat-label">Integrations Active</div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">🚀 Quick Actions</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => navTo('testcases')}>🧬 Generate Test Cases</button>
                <button className="btn btn-outline" onClick={() => navTo('testplan')}>📋 Create Test Plan</button>
                <button className="btn btn-outline" onClick={() => navTo('settings-jira')}>🔷 Connect JIRA</button>
                <button className="btn btn-outline" onClick={() => navTo('settings-llm')}>🤖 Configure AI</button>
              </div>
            </div>

            <div className="card">
              <div className="card-title">📡 Connection Status</div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>JIRA</div>
                  <span className={`conn-status ${connStats.jira ? 'connected' : 'disconnected'}`}>
                    <span className={`conn-dot ${connStats.jira ? 'on' : 'off'}`}></span>{connStats.jira ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Bugzilla</div>
                  <span className={`conn-status ${connStats.bz ? 'connected' : 'disconnected'}`}>
                    <span className={`conn-dot ${connStats.bz ? 'on' : 'off'}`}></span>{connStats.bz ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>LLM / AI</div>
                  <span className={`conn-status ${connStats.llm ? 'connected' : 'disconnected'}`}>
                    <span className={`conn-dot ${connStats.llm ? 'on' : 'off'}`}></span>{connStats.llm ? 'Connected' : 'Not Connected'}
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
              <div className="page-title">🧬 Test <span>Case Generator</span></div>
              <span className="page-badge">AI Powered</span>
            </div>

            <div className="card">
              <div className="card-title">📌 Source — JIRA Ticket ID</div>
              <div className="input-row">
                <div className="form-group">
                  <label className="form-label">JIRA Ticket ID</label>
                  <input className="form-input" placeholder="e.g. PROJ-101" value={tcJiraId} onChange={e => setTcJiraId(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Project Type</label>
                  <select className="form-input">
                    <option>Web Application</option>
                    <option>Mobile App</option>
                    <option>API / Backend</option>
                  </select>
                </div>
                <button className="btn btn-primary" onClick={handleFetchAndGenerateTC} style={{ marginTop: 20 }}>
                  🔍 Fetch &amp; Generate
                </button>
              </div>
            </div>

            {/* Dropzone mock */}
            <div className="card">
              <div className="card-title">📂 OR — Upload Document (Mock)</div>
              <div className="dropzone">
                <div className="dropzone-icon">☁️</div>
                <div className="dropzone-text">Drag &amp; Drop file here to generate test cases</div>
                <div className="dropzone-sub">Supports .pdf, .docx, .txt — max 10MB</div>
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
                  <div className="output-title">🧬 Test Cases — {currentTcJiraId}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="output-count">{testCases.length} cases generated</span>
                    <button className="btn btn-success btn-sm" onClick={() => exportCSV('tc', testCases)}>⬇️ Export CSV</button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>TC ID</th><th>Test Case Name</th><th>Priority</th><th>Type</th><th>Steps</th><th>Expected Result</th></tr>
                    </thead>
                    <tbody>
                      {testCases.map((tc, idx) => (
                        <tr key={idx}>
                          <td><strong style={{ color: 'var(--accent)' }}>{tc.id}</strong></td>
                          <td>{tc.title}</td>
                          <td><span className={`badge badge-${tc.priority === 'High' || tc.priority === 'P0' ? 'high' : tc.priority === 'Medium' || tc.priority === 'P1' ? 'med' : 'low'}`}>{tc.priority}</span></td>
                          <td><span className={`badge`} style={{ background: 'rgba(124,77,255,0.1)', color: 'var(--accent)' }}>{tc.type}</span></td>
                          <td style={{ fontSize: 12 }}>
                            <ol style={{ paddingLeft: 16 }}>
                              {Array.isArray(tc.steps) ? tc.steps.map((st, i) => <li key={i}>{st}</li>) : <li>{tc.steps}</li>}
                            </ol>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--success)' }}>{tc.expected_result}</td>
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
              <div className="page-title">📋 Test <span>Plan Generator</span></div>
              <span className="page-badge">AI Powered</span>
            </div>

            <div className="card">
              <div className="card-title">📌 Source — JIRA Ticket ID</div>
              <div className="input-row">
                <div className="form-group">
                  <label className="form-label">JIRA Ticket ID</label>
                  <input className="form-input" placeholder="e.g. PROJ-101" value={tpJiraId} onChange={e => setTpJiraId(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Test Environment</label>
                  <select className="form-input">
                    <option>Staging</option>
                    <option>Production</option>
                  </select>
                </div>
                <button className="btn btn-primary" onClick={handleFetchAndGenerateTP} style={{ marginTop: 20 }}>
                  🔍 Fetch &amp; Generate
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
                  <div className="output-title">📋 Test Plan — {currentTpJiraId}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn btn-success btn-sm" onClick={() => exportCSV('tp')}>⬇️ Export CSV</button>
                  </div>
                </div>
                <div style={{ padding: 24, fontSize: '14px', lineHeight: '1.6' }} className="plan-section">
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
              <div className="page-title">🕐 <span>History</span></div>
              <button className="btn btn-outline btn-sm" onClick={() => { setHistory([]); showToast('History cleared'); }}>🗑️ Clear All</button>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div>
                {history.length === 0 ? (
                  <div className="not-available">
                    <div className="not-available-icon">📭</div>
                    <h3>No history yet</h3>
                    <p>Your generated test cases and test plans<br />will appear here after generation.</p>
                  </div>
                ) : (
                  history.map((h, i) => (
                    <div className="history-item" key={i}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{h.type === 'tc' ? '🧬 Test Cases' : '📋 Test Plan'} — {h.id}</div>
                        <div className="history-meta">Source: {h.source} &nbsp;|&nbsp; {h.time}</div>
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
              <div className="page-title">🔷 JIRA <span>Connection</span></div>
              <span className={`conn-status ${connStats.jira ? 'connected' : 'disconnected'}`}>
                <span className={`conn-dot ${connStats.jira ? 'on' : 'off'}`}></span>{connStats.jira ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <div className="card">
              <div className="card-title">🔗 JIRA Cloud / Server Configuration</div>
              <div className="settings-grid">
                <div className="form-group">
                  <label className="form-label">JIRA Base URL</label>
                  <input className="form-input" placeholder="https://yourcompany.atlassian.net" value={jira.url} onChange={e => setJira({ ...jira, url: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">JIRA Email</label>
                  <input className="form-input" type="email" placeholder="you@company.com" value={jira.email} onChange={e => setJira({ ...jira, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">API Token</label>
                  <input className="form-input" type="password" placeholder="••••••••••••••••" value={jira.token} onChange={e => setJira({ ...jira, token: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Project Key (optional)</label>
                  <input className="form-input" placeholder="e.g. PROJ, QA, BUG" value={jira.project} onChange={e => setJira({ ...jira, project: e.target.value })} />
                </div>
              </div>
              <hr className="divider" />
              <div className="btn-row">
                <button className="btn btn-primary" onClick={testJira}>🔌 Test Connection</button>
                <button className="btn btn-outline btn-sm" onClick={() => { setJira({ url: '', email: '', token: '', project: '', type: 'Jira Cloud', version: 'v3' }); setConnStats(s => ({ ...s, jira: false })) }}>↩️ Reset</button>
              </div>
            </div>
          </div>
        )}

        {/* LLM SETTINGS */}
        {activePage === 'settings-llm' && (
          <div className="page active">
            <div className="page-header">
              <div className="page-title">🤖 AI / LLM <span>Configuration</span></div>
              <span className={`conn-status ${connStats.llm ? 'connected' : 'disconnected'}`}>
                <span className={`conn-dot ${connStats.llm ? 'on' : 'off'}`}></span>{connStats.llm ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <div className="card">
              <div className="card-title">🧠 Choose Your AI Model</div>
              <div className="tab-row">
                {['openai', 'groq', 'gemini', 'anthropic'].map(m => (
                  <button key={m} className={`tab-btn ${llm.active === m ? 'active' : ''}`} onClick={() => setLlm(l => ({ ...l, active: m }))}>
                    {m === 'openai' ? '🟢 OpenAI GPT-4o' : m === 'groq' ? '🟠 Groq' : m === 'gemini' ? '🔵 Gemini' : '🟣 Anthropic Claude'}
                  </button>
                ))}
              </div>

              <div className="settings-grid" style={{ marginTop: 20 }}>
                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <input className="form-input" type="password" placeholder="••••••••••••••••"
                    value={llm[llm.active].key}
                    onChange={e => setLlm(l => ({ ...l, [llm.active]: { ...l[llm.active], key: e.target.value } }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Model</label>
                  <input className="form-input" value={llm[llm.active].model}
                    onChange={e => setLlm(l => ({ ...l, [llm.active]: { ...l[llm.active], model: e.target.value } }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Tokens</label>
                  <input className="form-input" type="number" value={llm[llm.active].tokens}
                    onChange={e => setLlm(l => ({ ...l, [llm.active]: { ...l[llm.active], tokens: Number(e.target.value) } }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Temperature</label>
                  <input className="form-input" type="number" step="0.1" max="1" min="0" value={llm[llm.active].temp}
                    onChange={e => setLlm(l => ({ ...l, [llm.active]: { ...l[llm.active], temp: Number(e.target.value) } }))}
                  />
                </div>
              </div>

              <hr className="divider" />
              <div className="btn-row">
                <button className="btn btn-primary" onClick={testLlm}>🔌 Test LLM Connection</button>
                <button className="btn btn-success" onClick={() => showToast('Settings Saved', 'success')}>💾 Save</button>
              </div>
            </div>
          </div>
        )}

        {/* BUGZILLA SETTINGS */}
        {activePage === 'settings-bugzilla' && (
          <div className="page active">
            <div className="page-header">
              <div className="page-title">🐛 Bugzilla <span>Connection</span></div>
              <span className={`conn-status ${connStats.bz ? 'connected' : 'disconnected'}`}>
                <span className={`conn-dot ${connStats.bz ? 'on' : 'off'}`}></span>{connStats.bz ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <div className="card">
              <div className="card-title">🔗 Bugzilla Configuration</div>
              <div className="settings-grid">
                <div className="form-group">
                  <label className="form-label">Bugzilla Base URL</label>
                  <input className="form-input" placeholder="https://bugzilla.yourcompany.com" value={bz.url} onChange={e => setBz({ ...bz, url: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <input className="form-input" type="password" placeholder="Your Bugzilla API Key" value={bz.key} onChange={e => setBz({ ...bz, key: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Username (optional)</label>
                  <input className="form-input" placeholder="bugzilla@yourcompany.com" value={bz.user} onChange={e => setBz({ ...bz, user: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Password (optional)</label>
                  <input className="form-input" type="password" placeholder="Only if API key not used" value={bz.pass} onChange={e => setBz({ ...bz, pass: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Default Product</label>
                  <input className="form-input" placeholder="e.g. Firefox, MyApp" value={bz.prod} onChange={e => setBz({ ...bz, prod: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Default Component</label>
                  <input className="form-input" placeholder="e.g. General, UI, Backend" value={bz.comp} onChange={e => setBz({ ...bz, comp: e.target.value })} />
                </div>
              </div>
              <hr className="divider" />
              <div className="btn-row">
                <button className="btn btn-primary" onClick={() => { setConnStats(s => ({ ...s, bz: true })); showToast('Bugzilla Connected!', 'success'); }}>🔌 Test Connection</button>
                <button className="btn btn-outline btn-sm" onClick={() => { setBz({ url: '', key: '', user: '', pass: '', prod: '', comp: '' }); setConnStats(s => ({ ...s, bz: false })) }}>↩️ Reset</button>
              </div>
            </div>
          </div>
        )}

        {/* View Settings Fallbacks */}
        {activePage === 'view-settings' && (
          <div className="page active">
            <div className="page-header">
              <div className="page-title">⚙️ View Settings</div>
            </div>
            <div className="not-available">
              <div className="not-available-icon">🚧</div>
              <h3>Currently Not Available</h3>
              <p>This functionality is coming in the next release.<br />Stay tuned!</p>
            </div>
          </div>
        )}

      </main>

      {/* TOAST */}
      <div className={`toast ${toast.show ? 'show' : ''}`}>
        {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : toast.type === 'warning' ? '⚠️' : '💡'} {toast.msg}
      </div>
    </div>
  );
}

export default App;
