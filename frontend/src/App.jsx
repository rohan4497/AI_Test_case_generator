import { useState, useRef } from 'react';
import axios from 'axios';
import { 
  Settings, Link as LinkIcon, CheckCircle2, XCircle, 
  Search, FileText, Play, Download, Copy, AlertCircle,
  Loader2, Sparkles, Check
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

const defaultTemplate = `name: "Default Functional Test Template"
category: "Functional"
depth: "Comprehensive"
tone: "Professional, structured, clear"
instructions: >
  Analyze the provided Jira issue (user story, description, and acceptance criteria).
  Generate at least 5 structured test cases.
  Cover positive scenarios, negative scenarios, and edge cases.
`;

function App() {
  // Config & Auth State
  const [creds, setCreds] = useState({ base_url: '', email: '', api_token: '' });
  const [anthropicKey, setAnthropicKey] = useState('');
  const [connStatus, setConnStatus] = useState({ loading: false, success: null, msg: '' });

  // Input State
  const [issueId, setIssueId] = useState('');
  const [template, setTemplate] = useState(defaultTemplate);
  
  // Data State
  const [issueData, setIssueData] = useState(null);
  const [isFetchingIssue, setIsFetchingIssue] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Generation State
  const [testCases, setTestCases] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genMetadata, setGenMetadata] = useState(null);
  const [genError, setGenError] = useState('');
  
  // UI State
  const [copiedData, setCopiedData] = useState(false);

  // Handlers
  const handleTestConnection = async () => {
    setConnStatus({ loading: true, success: null, msg: '' });
    try {
        const res = await axios.post(`${API_BASE}/jira/test-connection`, creds);
        setConnStatus({ loading: false, success: res.data.success, msg: res.data.message });
    } catch (err) {
        setConnStatus({ loading: false, success: false, msg: err.response?.data?.detail || err.message });
    }
  };

  const handleFetchIssue = async () => {
    if (!issueId.trim()) return;
    setIsFetchingIssue(true);
    setFetchError('');
    try {
        const res = await axios.post(`${API_BASE}/jira/fetch-issue`, {
            ...creds,
            issue_id: issueId.trim()
        });
        setIssueData(res.data);
    } catch (err) {
        setFetchError(err.response?.data?.detail || 'Failed to fetch issue');
    } finally {
        setIsFetchingIssue(false);
    }
  };

  const handleGenerate = async () => {
    if (!issueData) return;
    setIsGenerating(true);
    setGenError('');
    try {
        const res = await axios.post(`${API_BASE}/testcases/generate`, {
            anthropic_api_key: anthropicKey,
            jira_id: issueData.jira_id,
            summary: issueData.summary,
            description: issueData.description,
            acceptance_criteria: issueData.acceptance_criteria,
            issue_type: issueData.issue_type,
            priority: issueData.priority,
            template_content: template
        });
        
        if (res.data.test_cases?.length < 5) {
            setGenError('Warning: LLM returned fewer than 5 test cases. Consider expanding the context or template.');
        }
        
        setTestCases(res.data.test_cases);
        setGenMetadata(res.data.metadata);
    } catch (err) {
        setGenError(err.response?.data?.detail || 'LLM Generation failed');
    } finally {
        setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!testCases.length) return;
    const header = ["ID", "Title", "Type", "Priority", "Preconditions", "Steps", "Test Data", "Expected Result", "Linked Jira ID"].join("\t");
    const rows = testCases.map(tc => {
        const stepsStr = Array.isArray(tc.steps) ? tc.steps.join("; ") : tc.steps;
        return [tc.id, tc.title, tc.type, tc.priority, tc.preconditions, stepsStr, tc.test_data, tc.expected_result, tc.linked_jira_id].join("\t");
    }).join("\n");
    
    navigator.clipboard.writeText(header + "\n" + rows);
    setCopiedData(true);
    setTimeout(() => setCopiedData(false), 2000);
  };

  const exportData = async (format) => {
    if (!testCases.length) return;
    try {
        const res = await axios.post(`${API_BASE}/testcases/export`, {
            format,
            test_cases: testCases
        }, { responseType: 'blob' });
        
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `testcases.${format}`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
    } catch (e) {
        console.error("Export failed", e);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-7xl">
      <header className="mb-12 text-center relative z-10">
        <div className="inline-flex items-center justify-center p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mb-4 text-indigo-400">
            <Sparkles size={32} />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            AI Test Case <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">Generator</span>
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-lg">Intelligently transform Jira user stories into comprehensive, structured test cases using Anthropic Claude.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        {/* Left Column - Configuration & Input */}
        <div className="lg:col-span-1 space-y-6">
            <section className="glass-panel">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Settings className="text-indigo-400" size={20}/> Connection Panel
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Jira Base URL</label>
                        <input className="input-field" placeholder="https://your-domain.atlassian.net" value={creds.base_url} onChange={e => setCreds({...creds, base_url: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Jira Email</label>
                        <input className="input-field" placeholder="name@company.com" value={creds.email} onChange={e => setCreds({...creds, email: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Jira API Token</label>
                        <input type="password" className="input-field" placeholder="••••••••••••••" value={creds.api_token} onChange={e => setCreds({...creds, api_token: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Anthropic API Key <span className="text-xs text-slate-500">(Required for LLM)</span></label>
                        <input type="password" className="input-field border-emerald-900/50 focus:ring-emerald-500" placeholder="sk-ant-..." value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)} />
                    </div>
                    
                    <button onClick={handleTestConnection} disabled={connStatus.loading || !creds.base_url} className="btn-secondary w-full mt-2">
                        {connStatus.loading ? <Loader2 className="animate-spin" size={18}/> : <LinkIcon size={18}/>}
                        Test Connection
                    </button>
                    
                    {connStatus.msg && (
                        <div className={`p-3 rounded border text-sm flex items-start gap-2 ${connStatus.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                            {connStatus.success ? <CheckCircle2 size={18} className="shrink-0"/> : <XCircle size={18} className="shrink-0"/>}
                            <span>{connStatus.msg}</span>
                        </div>
                    )}
                </div>
            </section>

            <section className="glass-panel">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Search className="text-emerald-400" size={20}/> Fetch Issue
                </h2>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <input className="input-field flex-1" placeholder="e.g., PROJ-123" value={issueId} onChange={e => setIssueId(e.target.value)} />
                        <button onClick={handleFetchIssue} disabled={isFetchingIssue || !issueId} className="btn-secondary">
                            {isFetchingIssue ? <Loader2 className="animate-spin" size={18}/> : 'Fetch'}
                        </button>
                    </div>
                    {fetchError && (
                        <div className="text-red-400 text-sm flex items-center gap-2"><AlertCircle size={14}/> {fetchError}</div>
                    )}
                </div>
            </section>
            
            <section className="glass-panel">
                 <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Settings className="text-purple-400" size={20}/> Template Setup
                </h2>
                <textarea 
                    className="input-field font-mono text-xs h-40 resize-y" 
                    value={template} 
                    onChange={e => setTemplate(e.target.value)}
                />
            </section>
        </div>

        {/* Right Column - Context & Output */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* Context Card */}
            {issueData && (
                <section className="glass-panel border-l-4 border-l-indigo-500">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-1 rounded font-medium mr-2">{issueData.issue_type}</span>
                            <span className="bg-red-500/20 text-red-300 text-xs px-2 py-1 rounded font-medium mr-2">{issueData.priority}</span>
                            <span className="text-slate-400 text-sm">{issueData.jira_id}</span>
                            <h2 className="text-2xl font-semibold mt-2">{issueData.summary}</h2>
                        </div>
                        <button 
                            onClick={handleGenerate} 
                            disabled={isGenerating || !anthropicKey} 
                            className="btn-primary"
                        >
                            {isGenerating ? <Loader2 className="animate-spin" size={20}/> : <Play size={20} fill="currentColor" />}
                            Generate Tests
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 max-h-60 overflow-y-auto">
                            <h3 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Description</h3>
                            <div className="text-sm prose prose-invert max-w-none"><ReactMarkdown>{issueData.description}</ReactMarkdown></div>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 max-h-60 overflow-y-auto">
                            <h3 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Acceptance Criteria</h3>
                            <div className="text-sm prose prose-invert max-w-none whitespace-pre-wrap">{issueData.acceptance_criteria}</div>
                        </div>
                    </div>
                </section>
            )}

            {/* Output Panel */}
            {(testCases.length > 0 || isGenerating) && (
                <section className="glass-panel">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <FileText className="text-emerald-400" size={20}/> 
                            Generated Test Cases {testCases.length > 0 && <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full ml-2">{testCases.length}</span>}
                        </h2>
                        
                        {!isGenerating && testCases.length > 0 && (
                            <div className="flex gap-2">
                                <button onClick={copyToClipboard} className="btn-secondary text-xs px-3">
                                    {copiedData ? <Check size={14} className="text-emerald-400"/> : <Copy size={14}/>} {copiedData ? 'Copied' : 'Copy TSV'}
                                </button>
                                <button onClick={() => exportData('md')} className="btn-secondary text-xs px-3"><Download size={14}/> .MD</button>
                                <button onClick={() => exportData('csv')} className="btn-secondary text-xs px-3"><Download size={14}/> .CSV</button>
                            </div>
                        )}
                    </div>
                    
                    {genError && (
                        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded mb-4 text-sm flex items-center gap-2">
                            <AlertCircle size={16}/> {genError}
                        </div>
                    )}
                    
                    {isGenerating ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                                <Sparkles className="animate-pulse text-indigo-400 relative z-10" size={40}/>
                            </div>
                            <p className="animate-pulse font-medium">Analyzing context and generating test strategies...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-slate-700/50">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-slate-900/80 text-slate-300">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">ID</th>
                                        <th className="px-4 py-3 font-medium">Type</th>
                                        <th className="px-4 py-3 font-medium min-w-[200px]">Title</th>
                                        <th className="px-4 py-3 font-medium min-w-[300px]">Steps</th>
                                        <th className="px-4 py-3 font-medium min-w-[200px]">Expected Result</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {testCases.map((tc, idx) => (
                                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-3 text-indigo-400 font-mono">{tc.id}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-1 rounded ${
                                                    tc.type.includes('Positive') ? 'bg-emerald-500/20 text-emerald-300' :
                                                    tc.type.includes('Negative') ? 'bg-red-500/20 text-red-300' :
                                                    tc.type.includes('Edge') ? 'bg-amber-500/20 text-amber-300' :
                                                    'bg-slate-500/20 text-slate-300'
                                                }`}>{tc.type}</span>
                                            </td>
                                            <td className="px-4 py-3 font-medium whitespace-normal">{tc.title}</td>
                                            <td className="px-4 py-3 whitespace-normal">
                                                <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                                                    {Array.isArray(tc.steps) ? tc.steps.map((st, i) => <li key={i}>{st}</li>) : <li>{tc.steps}</li>}
                                                </ol>
                                            </td>
                                            <td className="px-4 py-3 whitespace-normal text-emerald-400/90">{tc.expected_result}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    
                    {genMetadata && !isGenerating && (
                        <div className="mt-4 text-right text-xs text-slate-500 font-mono">
                            Generated in {genMetadata.latency_sec}s • {genMetadata.tokens_used} tokens
                        </div>
                    )}
                </section>
            )}
        </div>
      </div>
    </div>
  );
}

export default App;
