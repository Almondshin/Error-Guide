import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';

// --- 타입 정의 ---
interface ErrorDefinition {
  id: string;
  code: string;
  description: string;
  message: string;
}

interface IssueDefinition {
  id: string;
  inquiry: string;
  answer: string;
  status: 'resolved' | 'pending';
  timestamp: number;
}

interface HistoryItem {
  id: string;
  timestamp: number;
  input: string;
  result: any;
}

type Tab = 'analyzer' | 'error-manager' | 'issue-manager' | 'mobile-guide';

// --- 유틸리티 ---
const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

const sanitizeContent = (text: string) => {
  if (!text) return '';
  // 줄바꿈 및 특수 공백 처리 최적화
  return text.replace(/<br\s*\/?>/gi, '\n').replace(/\\n/g, '\n').replace(/&nbsp;/g, ' ');
};

const SYSTEM_INSTRUCTION_BASE = `
# Role: Senior Technical Architect & Enterprise Consultant
당신은 Java, Spring Boot 3.x, PostgreSQL 기반 엔터프라이즈 시스템의 수석 아키텍트입니다.

# 핵심 언어 지침 (CRITICAL)
1. **모든 분석 결과물은 한국어로 작성하십시오.**
2. 가독성을 위해 표준 Markdown 문법을 철저히 준수하십시오.
3. 강조가 필요한 중요 용어(레이어 명칭, 에러 코드 등)는 반드시 **용어** (앞뒤로 별표 두 개) 형태의 볼드체로 작성하십시오.
4. 문단 구분을 명확히 하여 텍스트가 뭉쳐 보이지 않게 하십시오.

# 핵심 제약 사항
1. **절대 금지 문구**: "External Interface Layer Identity Data Verification / OTP Validation" 문구 사용 금지.
2. **레이어 명칭**: 한글 우선 (예: **외부 인터페이스 계층**, **비즈니스 서비스 레이어**, **JPA 영속성 계층** 등).
`;

// --- 컴포넌트 ---

const FormattedCell = ({ text, className }: { text: string, className?: string }) => {
  if (!text) return null;
  const lines = text.split(/<br\s*\/?>|\n/gi);
  return (
    <div className={className}>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </div>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('analyzer');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  const [errorDefs, setErrorDefs] = useState<ErrorDefinition[]>([]);
  const [editingDef, setEditingDef] = useState<ErrorDefinition | null>(null);
  const [showErrorForm, setShowErrorForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  
  const [errorSearchTerm, setErrorSearchTerm] = useState('');
  const [errorCurrentPage, setErrorCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const [issueDefs, setIssueDefs] = useState<IssueDefinition[]>([]);
  const [editingIssue, setEditingIssue] = useState<Partial<IssueDefinition> | null>(null);
  const [showIssueForm, setShowIssueForm] = useState(false);

  useEffect(() => {
    const savedHistory = localStorage.getItem('eg_v53_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    const savedDefs = localStorage.getItem('eg_v53_error_defs');
    if (savedDefs) setErrorDefs(JSON.parse(savedDefs));
    const savedIssues = localStorage.getItem('eg_v53_issues');
    if (savedIssues) setIssueDefs(JSON.parse(savedIssues));
  }, []);

  const persist = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

  const handleHistoryClick = (item: HistoryItem) => {
    setInput(item.input);
    setResult(item.result);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const errorCtx = errorDefs.slice(0, 30).map(d => `[E:${d.code}] ${d.description}`).join('\n');
      const issueCtx = issueDefs.slice(0, 10).map(i => `[C] Q:${i.inquiry.substring(0, 30)}/A:${i.answer.substring(0, 30)}`).join('\n');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Input Trace:\n"${input}"`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_BASE + `\n\n# Context:\n${errorCtx}\n\n# Case Base:\n${issueCtx}`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              diagnosis: { 
                type: Type.OBJECT, 
                properties: { 
                  layer: { type: Type.STRING }, 
                  step: { type: Type.STRING }, 
                  summary: { type: Type.STRING } 
                }, 
                required: ["layer", "step", "summary"] 
              },
              solutionDescription: { type: Type.STRING },
              preCheck: { type: Type.STRING },
              insight: { type: Type.STRING }
            },
            required: ["diagnosis", "solutionDescription", "preCheck", "insight"]
          }
        }
      });
      const parsed = JSON.parse(response.text || '{}');
      setResult(parsed);
      const newHist = [{ id: generateId(), timestamp: Date.now(), input, result: parsed }, ...history].slice(0, 15);
      setHistory(newHist);
      persist('eg_v53_history', newHist);
    } catch (e: any) { 
      setError("AI 진단 중 오류가 발생했습니다: " + e.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleSaveErrorDef = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDef) return;
    const item = { ...editingDef, id: editingDef.id || generateId() };
    const updated = editingDef.id ? errorDefs.map(d => d.id === editingDef.id ? item : d) : [item, ...errorDefs];
    setErrorDefs(updated);
    persist('eg_v53_error_defs', updated);
    setShowErrorForm(false);
    setEditingDef(null);
  };

  const handleBulkImport = () => {
    if (!bulkInput.trim()) return;
    try {
      const parsed = JSON.parse(bulkInput);
      if (!Array.isArray(parsed)) throw new Error("JSON 배열 형식이 아닙니다.");
      const newItems = parsed.map(p => ({ 
        id: generateId(),
        code: String(p.code || ''),
        description: String(p.description || ''),
        message: String(p.message || '')
      }));
      const updated = [...newItems, ...errorDefs];
      setErrorDefs(updated);
      persist('eg_v53_error_defs', updated);
      setShowBulkImport(false);
      setBulkInput('');
      alert(`${newItems.length}건이 임포트되었습니다.`);
    } catch (e: any) { alert("오류: " + e.message); }
  };

  const deleteErrorDef = (id: string) => {
    if (window.confirm("삭제하시겠습니까?")) {
      const updated = errorDefs.filter(d => String(d.id) !== String(id));
      setErrorDefs(updated);
      persist('eg_v53_error_defs', updated);
    }
  };

  const handleSaveIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIssue?.inquiry || !editingIssue?.answer) return;
    const item: IssueDefinition = {
      id: editingIssue.id || generateId(),
      inquiry: String(editingIssue.inquiry),
      answer: String(editingIssue.answer),
      status: (editingIssue.status as any) || 'pending',
      timestamp: Date.now()
    };
    const updated = editingIssue.id ? issueDefs.map(i => i.id === editingIssue.id ? item : i) : [item, ...issueDefs];
    setIssueDefs(updated);
    persist('eg_v53_issues', updated);
    setShowIssueForm(false);
    setEditingIssue(null);
  };

  const deleteIssue = (id: string) => {
    if (window.confirm("사례를 삭제하시겠습니까?")) {
      const updated = issueDefs.filter(i => String(i.id) !== String(id));
      setIssueDefs(updated);
      persist('eg_v53_issues', updated);
    }
  };

  const filteredErrorDefs = useMemo(() => 
    errorDefs.filter(d => 
      String(d.code).toLowerCase().includes(errorSearchTerm.toLowerCase()) || 
      String(d.description).toLowerCase().includes(errorSearchTerm.toLowerCase())
    ), [errorDefs, errorSearchTerm]);

  const paginatedErrorDefs = useMemo(() => {
    const start = (errorCurrentPage - 1) * itemsPerPage;
    return filteredErrorDefs.slice(start, start + itemsPerPage);
  }, [filteredErrorDefs, errorCurrentPage]);

  return (
    <div className="enterprise-shell">
      <header className="enterprise-header">
        <div className="brand-logo" onClick={() => setActiveTab('analyzer')}>
          <div className="logo-icon">EG</div>
          <div className="logo-text">
            <h1>Error Guide</h1>
            <span className="version-tag">Professional Edition v5.3</span>
          </div>
        </div>
        <nav className="header-nav">
          <button className={activeTab === 'analyzer' ? 'active' : ''} onClick={() => setActiveTab('analyzer')}>진단 엔진</button>
          <button className={activeTab === 'error-manager' ? 'active' : ''} onClick={() => setActiveTab('error-manager')}>에러 관리</button>
          <button className={activeTab === 'issue-manager' ? 'active' : ''} onClick={() => setActiveTab('issue-manager')}>지식 베이스</button>
          <button className={activeTab === 'mobile-guide' ? 'active' : ''} onClick={() => setActiveTab('mobile-guide')}>기술 가이드</button>
        </nav>
      </header>

      <main className="main-viewport">
        {activeTab === 'analyzer' && (
          <div className="view-container animate-fade">
            <div className="layout-grid">
              <aside className="input-side">
                <div className="card shadow-lg sticky-aside">
                  <div className="panel-top">
                    <h3>장애 정밀 분석</h3>
                    <p>로그 전문 또는 스택 트레이스를 입력하세요.</p>
                  </div>
                  <div className="mt-4">
                    <textarea 
                      className="expert-textarea"
                      value={input} 
                      onChange={(e) => setInput(e.target.value)} 
                      placeholder="분석할 로그를 붙여넣으세요..."
                    />
                  </div>
                  <button className="primary-btn fluid mt-4" onClick={handleAnalyze} disabled={loading || !input.trim()}>
                    {loading ? '엔진 가동 중...' : '아키텍처 진단 실행'}
                  </button>
                  {error && <div className="alert-error-box mt-3">{error}</div>}
                  
                  <div className="history-section mt-8">
                    <div className="flex-between mb-3">
                      <label className="overline-title">분석 히스토리</label>
                      <button className="action-text-btn" onClick={() => { setHistory([]); persist('eg_v53_history', []); }}>Clear</button>
                    </div>
                    <div className="history-scroll">
                      {history.length > 0 ? history.map(h => (
                        <div key={h.id} className="history-card" onClick={() => handleHistoryClick(h)}>
                          <div className="h-meta">
                            <span className="h-indicator"></span>
                            <span className="h-time">{new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="h-snippet">{h.input.substring(0, 40)}...</div>
                        </div>
                      )) : <div className="empty-small">기록이 없습니다.</div>}
                    </div>
                  </div>
                </div>
              </aside>

              <section className="result-side">
                {loading ? (
                  <div className="loading-container card shadow-md">
                    <div className="loader-ring"></div>
                    <h3>AI 전문가 엔진 분석 중</h3>
                    <p>시스템 레이어와 장애 패턴을 대조하여 해결책을 도출하고 있습니다.</p>
                  </div>
                ) : result ? (
                  <div className="result-report animate-slide-up">
                    <div className="report-card card shadow-lg">
                      <div className="report-header">
                        <div className="tag-group">
                          <span className="tag-solid-primary">{result.diagnosis.layer}</span>
                          <span className="tag-outline-muted">{result.diagnosis.step}</span>
                        </div>
                        <div className="report-info">Diagnostic Code: {generateId().toUpperCase().slice(0, 6)}</div>
                      </div>
                      
                      <div className="report-section mt-6">
                        <h4 className="report-label">원인 진단 요약</h4>
                        <div className="summary-pannel markdown-content">
                          <ReactMarkdown>{sanitizeContent(result.diagnosis.summary)}</ReactMarkdown>
                        </div>
                      </div>

                      <div className="report-section mt-8">
                        <h4 className="report-label">기술적 조치 가이드</h4>
                        <div className="rich-content-box markdown-content">
                          <ReactMarkdown>{sanitizeContent(result.solutionDescription)}</ReactMarkdown>
                        </div>
                      </div>

                      <div className="report-section mt-10 border-t pt-6">
                         <div className="insight-hero">
                           <div className="insight-icon">💡</div>
                           <div className="insight-body">
                             <h4 className="insight-title">Architectural Insight</h4>
                             <div className="insight-text markdown-content">
                               <ReactMarkdown>{sanitizeContent(result.insight)}</ReactMarkdown>
                             </div>
                           </div>
                         </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="initial-empty-state">
                    <div className="empty-hero">
                      <div className="hero-icon-wrap">⚙️</div>
                      <h2>분석 리포트 대기</h2>
                      <p>진단을 요청하거나 히스토리를 불러와 전문 리포트를 생성하세요.</p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {activeTab === 'error-manager' && (
          <div className="view-container animate-fade">
             <div className="page-header flex-between mb-6">
                <div>
                  <h2>에러 코드 지식 관리</h2>
                  <p>전사 시스템 에러 표준 가이드를 통합 관리합니다.</p>
                </div>
                <div className="flex gap-2">
                  <button className="secondary-btn" onClick={() => setShowBulkImport(!showBulkImport)}>대량 임포트</button>
                  <button className="primary-btn" onClick={() => { setEditingDef({id:'', code:'', description:'', message:''}); setShowErrorForm(true); }}>신규 등록</button>
                </div>
             </div>

             {showBulkImport && (
                <div className="bulk-editor-card card shadow-lg mb-6 animate-slide-up">
                   <div className="flex-between mb-3">
                      <label className="font-bold text-sm">JSON 대량 임포트</label>
                      <code className="code-example">[{`"code": "...", "description": "...", "message": "..."`}]</code>
                   </div>
                   <textarea 
                     className="monotype-textarea"
                     value={bulkInput} 
                     onChange={e => setBulkInput(e.target.value)} 
                     placeholder='JSON 데이터를 입력하세요...' 
                   />
                   <div className="flex justify-end mt-3 gap-2">
                      <button className="secondary-btn" onClick={() => setShowBulkImport(false)}>취소</button>
                      <button className="primary-btn" onClick={handleBulkImport}>임포트 실행</button>
                   </div>
                </div>
             )}

             {showErrorForm && (
               <div className="modal-form-overlay card shadow-2xl animate-slide-up mb-8">
                 <form onSubmit={handleSaveErrorDef}>
                    <h3 className="mb-4">에러 가이드 {editingDef?.id ? '편집' : '등록'}</h3>
                    <div className="form-grid-layout">
                      <div className="field">
                        <label>에러 코드</label>
                        <input type="text" required value={editingDef?.code} onChange={e => setEditingDef({...editingDef!, code: e.target.value})} placeholder="CODE-100" />
                      </div>
                      <div className="field">
                        <label>관리 상세 설명</label>
                        <input type="text" required value={editingDef?.description} onChange={e => setEditingDef({...editingDef!, description: e.target.value})} placeholder="발생 원인 및 기술적 배경" />
                      </div>
                      <div className="field full">
                        <label>사용자 노출 메시지</label>
                        <textarea required value={editingDef?.message} onChange={e => setEditingDef({...editingDef!, message: e.target.value})} placeholder="고객 안내 문구" style={{height: '100px'}} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6 border-t pt-5">
                      <button type="button" className="secondary-btn" onClick={() => setShowErrorForm(false)}>취소</button>
                      <button type="submit" className="primary-btn">저장 완료</button>
                    </div>
                 </form>
               </div>
             )}

             <div className="data-table-container card shadow-sm p-0 overflow-hidden">
                <div className="search-bar p-4 border-b flex items-center gap-3 bg-gray-50">
                   <span className="search-icon">🔍</span>
                   <input 
                     className="ghost-input"
                     type="text" 
                     placeholder="에러 코드 또는 검색어 입력..." 
                     value={errorSearchTerm}
                     onChange={(e) => { setErrorSearchTerm(e.target.value); setErrorCurrentPage(1); }}
                   />
                </div>
                <div className="overflow-x-auto">
                  <table className="enterprise-table">
                    <thead>
                      <tr><th>ERROR CODE</th><th>DESCRIPTION</th><th>USER MESSAGE</th><th className="center">ACTIONS</th></tr>
                    </thead>
                    <tbody>
                      {paginatedErrorDefs.length > 0 ? paginatedErrorDefs.map(d => (
                        <tr key={d.id}>
                          <td><span className="code-badge">{d.code}</span></td>
                          <td className="desc-cell"><FormattedCell text={d.description} /></td>
                          <td className="msg-cell"><FormattedCell text={d.message} /></td>
                          <td className="center">
                            <div className="action-cell-flex">
                              <button className="table-action-btn edit" onClick={() => { setEditingDef(d); setShowErrorForm(true); }}>편집</button>
                              <button className="table-action-btn delete" onClick={() => deleteErrorDef(d.id)}>삭제</button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4} className="center py-16 text-muted">일치하는 정보가 없습니다.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'issue-manager' && (
          <div className="view-container animate-fade">
             <div className="page-header flex-between mb-6">
                <div>
                  <h2>장애 해결 지식 베이스</h2>
                  <p>현장에서 발생한 이슈와 조치 과정을 자산화하여 팀의 역량을 높입니다.</p>
                </div>
                <button className="primary-btn" onClick={() => { setEditingIssue({ inquiry: '', answer: '', status: 'pending' }); setShowIssueForm(true); }}>지식 등록</button>
             </div>

             {showIssueForm && (
                <div className="modal-form-overlay card shadow-2xl mb-8 animate-slide-up">
                  <form onSubmit={handleSaveIssue}>
                    <h3 className="mb-5">대응 사례 {editingIssue?.id ? '편집' : '작성'}</h3>
                    <div className="form-stack">
                      <div className="field mb-5">
                        <label>상황 및 문의 요약</label>
                        <textarea 
                          className="expert-textarea small"
                          required 
                          value={editingIssue?.inquiry} 
                          onChange={e => setEditingIssue({...editingIssue!, inquiry: e.target.value})} 
                          placeholder="발생한 상황이나 사용자 문의를 기록하세요."
                        />
                      </div>
                      <div className="field mb-5">
                        <label>해결책 및 가이드 (Markdown)</label>
                        <textarea 
                          className="expert-textarea"
                          required 
                          value={editingIssue?.answer} 
                          onChange={e => setEditingIssue({...editingIssue!, answer: e.target.value})} 
                          placeholder="구체적인 원인과 해결 방법을 기술하세요."
                          style={{height: '220px'}}
                        />
                      </div>
                      <div className="field mb-5">
                        <label className="mb-2 block font-bold text-xs">처리 상태</label>
                        <div className="segmented-control">
                          <label className={`segment ${editingIssue?.status === 'pending' ? 'active warning' : ''}`}>
                            <input type="radio" name="status" value="pending" checked={editingIssue?.status === 'pending'} onChange={() => setEditingIssue({...editingIssue!, status: 'pending'})} />
                            진행중 / 미완료
                          </label>
                          <label className={`segment ${editingIssue?.status === 'resolved' ? 'active success' : ''}`}>
                            <input type="radio" name="status" value="resolved" checked={editingIssue?.status === 'resolved'} onChange={() => setEditingIssue({...editingIssue!, status: 'resolved'})} />
                            해결 완료
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6 border-t pt-5">
                      <button type="button" className="secondary-btn" onClick={() => setShowIssueForm(false)}>취소</button>
                      <button type="submit" className="primary-btn">저장 완료</button>
                    </div>
                  </form>
                </div>
             )}

             <div className="issue-layout-grid">
                {issueDefs.length > 0 ? issueDefs.map(i => (
                  <div key={i.id} className={`kb-card shadow-md ${i.status}`}>
                    <div className="kb-card-header flex-between mb-4">
                      <div className="kb-meta">
                        <span className={`status-dot ${i.status}`}></span>
                        <span className="kb-status-text">{i.status === 'resolved' ? 'Resolved' : 'Pending'}</span>
                        <span className="kb-date">{new Date(i.timestamp).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-2">
                         <button className="icon-action-btn" onClick={() => { setEditingIssue(i); setShowIssueForm(true); }}>✏️</button>
                         <button className="icon-action-btn delete" onClick={() => deleteIssue(i.id)}>🗑️</button>
                      </div>
                    </div>
                    <div className="kb-body">
                      <div className="kb-section">
                        <label className="kb-label">SITUATION</label>
                        <div className="kb-text-content">
                          <FormattedCell text={i.inquiry} />
                        </div>
                      </div>
                      <div className="kb-section mt-4 border-t pt-4">
                        <label className="kb-label">RESOLUTION</label>
                        <div className="kb-markdown-view markdown-content">
                          <ReactMarkdown>{sanitizeContent(i.answer)}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="empty-state-card col-span-full">
                    <div className="empty-icon-lg">📂</div>
                    <h3>등록된 사례가 없습니다.</h3>
                    <p>팀을 위한 첫 장애 조치 가이드를 작성하세요.</p>
                  </div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'mobile-guide' && (
          <div className="view-container animate-fade">
             <div className="guide-hero-banner shadow-lg mb-10">
                <div className="hero-text">
                  <h2 className="hero-title">Mobile-OK<br/>Dev Support</h2>
                  <p className="hero-subtitle">표준 인터페이스 연동 및 시스템 구축을 위한 가이드 포털입니다.</p>
                  <div className="hero-tags mt-5">
                    <span className="hero-tag">Spec v4.2</span>
                    <span className="hero-tag">Enterprise Safe</span>
                  </div>
                </div>
                <div className="hero-image-wrap">
                  <div className="hero-blob"></div>
                  <span className="hero-icon">🛠️</span>
                </div>
             </div>

             <div className="guide-cards-layout">
                <a href="https://manager.mobile-ok.com/guide/mok_std_guide/" target="_blank" rel="noopener noreferrer" className="action-card-modern shadow-md">
                   <div className="action-icon">📘</div>
                   <div className="action-body">
                     <h3>표준 연동 가이드</h3>
                     <p>전체 프로세스 및 플로우에 대한 상세 문서입니다.</p>
                   </div>
                   <div className="action-footer">Open Document →</div>
                </a>

                <a href="https://manager.mobile-ok.com/guide/mok_api_guide/" target="_blank" rel="noopener noreferrer" className="action-card-modern shadow-md">
                   <div className="action-icon">⚡</div>
                   <div className="action-body">
                     <h3>API 레퍼런스</h3>
                     <p>상세 파라미터 및 응답 규격 정의서입니다.</p>
                   </div>
                   <div className="action-footer">View Reference →</div>
                </a>
             </div>

             <div className="additional-resources mt-12">
                <h3 className="overline-title-lg mb-5">보안 및 기술 지원</h3>
                <div className="resource-grid-modern">
                   <div className="res-card-flat">
                      <div className="res-icon">🛡️</div>
                      <div className="res-content">
                        <h4>연동 보안 가이드</h4>
                        <p>암복호화 필수 권고안 및 보안 프로토콜 규격입니다.</p>
                      </div>
                   </div>
                   <div className="res-card-flat">
                      <div className="res-icon">🎧</div>
                      <div className="res-content">
                        <h4>운영 지원 채널</h4>
                        <p>기술적 문의는 1:1 지원 포털을 통해 가능합니다.</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}
      </main>

      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        
        :root { 
          --primary: #0052CC; 
          --primary-hover: #0747A6;
          --primary-soft: #DEEBFF;
          --bg: #F8FAFC; 
          --surface: #FFFFFF;
          --text-main: #172B4D; 
          --text-muted: #6B778C;
          --text-deep: #091E42;
          --border: #DFE1E6; 
          --success: #36B37E;
          --danger: #D73A49; /* More visible red */
          --warning: #FFAB00;
          --shadow-sm: 0 1px 2px rgba(9, 30, 66, 0.08);
          --shadow-md: 0 4px 12px rgba(9, 30, 66, 0.1);
          --shadow-lg: 0 10px 20px rgba(9, 30, 66, 0.12);
          --radius-md: 8px;
          --radius-lg: 12px;
        }
        
        * { box-sizing: border-box; }
        body { margin: 0; background: var(--bg); color: var(--text-main); font-family: 'Pretendard', sans-serif; -webkit-font-smoothing: antialiased; line-height: 1.5; font-size: 0.875rem; }
        .enterprise-shell { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        
        /* Header - Compact */
        .enterprise-header { height: 60px; background: var(--surface); display: flex; justify-content: space-between; align-items: center; padding: 0 32px; border-bottom: 1px solid var(--border); z-index: 1000; flex-shrink: 0; box-shadow: var(--shadow-sm); }
        .brand-logo { display: flex; align-items: center; gap: 10px; cursor: pointer; }
        .logo-icon { width: 34px; height: 34px; background: var(--primary); border-radius: 8px; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.1rem; }
        .logo-text h1 { margin: 0; font-size: 1rem; font-weight: 800; color: var(--text-deep); letter-spacing: -0.01em; }
        .version-tag { font-size: 0.65rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; }
        
        .header-nav { display: flex; gap: 4px; }
        .header-nav button { border: none; background: none; padding: 8px 14px; font-weight: 700; color: var(--text-muted); cursor: pointer; border-radius: 6px; transition: 0.2s; font-size: 0.85rem; }
        .header-nav button:hover { background: var(--bg); color: var(--primary); }
        .header-nav button.active { background: var(--primary-soft); color: var(--primary); }

        /* Viewport */
        .main-viewport { flex: 1; overflow-y: auto; padding: 24px 32px; }
        .view-container { max-width: 1300px; margin: 0 auto; width: 100%; }
        
        /* Layout Grid */
        .layout-grid { display: grid; grid-template-columns: 340px 1fr; gap: 32px; align-items: start; }
        .sticky-aside { position: sticky; top: 0; }

        /* Typography */
        h2 { font-size: 1.5rem; font-weight: 800; color: var(--text-deep); margin-bottom: 4px; letter-spacing: -0.02em; }
        h3 { font-size: 1.15rem; font-weight: 800; color: var(--text-deep); margin: 0; }
        p { color: var(--text-muted); font-size: 0.875rem; margin-top: 4px; }
        .overline-title { font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

        /* Cards */
        .card { background: var(--surface); border-radius: var(--radius-md); padding: 24px; border: 1px solid var(--border); }
        .shadow-md { box-shadow: var(--shadow-md); }
        .shadow-lg { box-shadow: var(--shadow-lg); }

        /* Buttons */
        .primary-btn { background: var(--primary); color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.2s; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; }
        .primary-btn:hover:not(:disabled) { background: var(--primary-hover); transform: translateY(-1px); }
        .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .secondary-btn { background: #EBECF0; color: var(--text-main); border: none; padding: 8px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.2s; font-size: 0.85rem; }
        .secondary-btn:hover { background: #DFE1E6; }
        .action-text-btn { background: none; border: none; color: var(--primary); font-weight: 800; font-size: 0.75rem; cursor: pointer; padding: 4px 8px; border-radius: 4px; }

        /* Form Controls */
        textarea, input[type="text"] { 
          width: 100%; border: 1.5px solid var(--border); border-radius: 8px; padding: 12px; 
          background: #FAFBFC; color: var(--text-deep); font-family: inherit; font-size: 0.9rem;
          box-sizing: border-box; outline: none; transition: 0.2s;
        }
        textarea:focus, input[type="text"]:focus { border-color: var(--primary); background: var(--surface); box-shadow: 0 0 0 3px rgba(0, 82, 204, 0.08); }
        .expert-textarea { min-height: 280px; resize: none; font-size: 0.875rem; }
        .expert-textarea.small { min-height: 100px; }
        .monotype-textarea { font-family: 'Consolas', 'Monaco', monospace; background: #1C2025 !important; color: #E1E4E8 !important; border: none; height: 200px; font-size: 0.85rem; }
        .ghost-input { border: none !important; background: transparent !important; font-size: 0.95rem !important; font-weight: 600 !important; }

        /* History */
        .history-scroll { max-height: 320px; overflow-y: auto; }
        .history-card { padding: 12px; margin-bottom: 8px; border-radius: 8px; border: 1px solid #F3F4F6; background: #F9FAFB; cursor: pointer; transition: 0.2s; }
        .history-card:hover { border-color: var(--primary); background: var(--surface); }
        .h-time { font-size: 0.75rem; color: var(--text-muted); font-weight: 700; }
        .h-snippet { font-size: 0.85rem; color: var(--text-main); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* Report */
        .report-card { border-top: 6px solid var(--primary); padding: 24px; }
        .report-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; border-bottom: 1px solid var(--border); }
        .tag-solid-primary { background: var(--primary); color: #fff; padding: 3px 10px; border-radius: 4px; font-size: 0.7rem; font-weight: 800; }
        .tag-outline-muted { border: 1px solid var(--border); color: var(--text-muted); padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; margin-left: 6px; }
        .report-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 12px; }
        .summary-pannel { background: #F8F9FA; padding: 18px; border-radius: 10px; border-left: 4px solid var(--primary); font-size: 1rem; font-weight: 500; color: var(--text-deep); }
        .rich-content-box { font-size: 0.9rem; line-height: 1.7; color: #344563; }

        /* Insight */
        .insight-hero { background: var(--primary-soft); border-radius: 12px; padding: 24px; display: flex; gap: 16px; border: 1px dashed var(--primary); }
        .insight-icon { font-size: 2rem; }
        .insight-title { font-size: 0.9rem; font-weight: 800; color: var(--primary-hover); margin-bottom: 4px; }
        .insight-text { font-size: 0.875rem; color: var(--text-deep); font-weight: 500; }

        /* Markdown Text Optimization */
        .markdown-content strong {
            font-weight: 900;
            color: var(--text-deep);
            background-color: rgba(0, 82, 204, 0.05);
            padding: 0 2px;
            border-radius: 2px;
        }

        /* Tables & Action Buttons - Visibility Improved */
        .enterprise-table { width: 100%; border-collapse: collapse; min-width: 900px; }
        .enterprise-table th { background: #F8F9FA; text-align: left; padding: 14px 20px; border-bottom: 2px solid var(--border); font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; }
        .enterprise-table td { padding: 14px 20px; border-bottom: 1px solid var(--border); vertical-align: middle; font-size: 0.875rem; }
        .code-badge { font-family: 'Consolas', monospace; background: var(--primary-soft); color: var(--primary); padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 0.85rem; }
        
        .table-action-btn { 
          background: #fff; border: 1.5px solid var(--border); border-radius: 4px; padding: 6px 14px; 
          font-weight: 800; cursor: pointer; font-size: 0.8rem; transition: 0.2s; margin: 0 4px;
        }
        .table-action-btn.edit { 
          color: #0052CC; /* Vivid Primary Blue */
          border-color: #0052CC;
        }
        .table-action-btn.edit:hover { 
          background: #0052CC; color: #fff;
        }
        .table-action-btn.delete { 
          color: #D73A49; /* Vivid Red */
          border-color: #D73A49;
        }
        .table-action-btn.delete:hover { 
          background: #D73A49; color: #fff;
        }

        /* KB Cards */
        .issue-layout-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(480px, 1fr)); gap: 20px; }
        .kb-card { background: var(--surface); border-radius: var(--radius-md); padding: 20px; border: 1px solid var(--border); border-top: 5px solid #EBECF0; transition: 0.2s ease; }
        .kb-status-text { font-weight: 800; font-size: 0.7rem; text-transform: uppercase; color: var(--text-deep); }
        .kb-label { font-size: 0.65rem; font-weight: 800; color: var(--text-muted); margin-bottom: 6px; display: block; letter-spacing: 0.05em; }
        .kb-text-content { font-size: 0.95rem; font-weight: 700; color: var(--text-deep); line-height: 1.5; white-space: pre-wrap; word-break: break-all; }
        
        .kb-markdown-view { font-size: 0.875rem; line-height: 1.6; color: #344563; }

        /* Segmented Control */
        .segmented-control { display: flex; gap: 6px; }
        .segment { flex: 1; border: 1.5px solid var(--border); padding: 10px; border-radius: 8px; font-weight: 800; text-align: center; cursor: pointer; font-size: 0.8rem; background: #FAFBFC; }
        .segment input { display: none; }
        .segment.active.warning { border-color: var(--warning); background: #FFF9E6; color: #7A5900; }
        .segment.active.success { border-color: var(--success); background: #E3FCEF; color: #006644; }

        /* Guide Hero */
        .guide-hero-banner { background: linear-gradient(135deg, #091E42 0%, #0052CC 100%); border-radius: 16px; padding: 40px 48px; display: flex; justify-content: space-between; align-items: center; color: #fff; position: relative; overflow: hidden; }
        .hero-title { font-size: 2.25rem; font-weight: 900; line-height: 1.1; margin: 0; }
        .hero-subtitle { font-size: 1rem; opacity: 0.9; margin-top: 12px; max-width: 480px; }
        .hero-icon { font-size: 5rem; z-index: 2; }

        .guide-cards-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: -32px; padding: 0 32px; position: relative; z-index: 10; }
        .action-card-modern { background: var(--surface); padding: 32px; border-radius: 16px; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 12px; transition: 0.3s; border: 1px solid var(--border); }
        .action-card-modern:hover { transform: translateY(-8px); border-color: var(--primary); box-shadow: var(--shadow-md); }
        .action-icon { font-size: 2.5rem; }
        .action-footer { margin-top: auto; font-weight: 800; color: var(--primary); font-size: 0.85rem; }

        /* Loader */
        .loader-ring { width: 44px; height: 44px; border: 4px solid var(--primary-soft); border-top: 4px solid var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 24px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* Animations */
        .animate-fade { animation: fadeIn 0.4s ease-out; }
        .animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        @media (max-width: 1100px) {
          .layout-grid { grid-template-columns: 1fr; }
          .guide-cards-layout { grid-template-columns: 1fr; }
          .issue-layout-grid { grid-template-columns: 1fr; }
        }

        /* Utils */
        .flex-between { display: flex; justify-content: space-between; align-items: center; }
        .mt-3 { margin-top: 0.75rem; }
        .mt-4 { margin-top: 1rem; }
        .mt-5 { margin-top: 1.25rem; }
        .mt-6 { margin-top: 1.5rem; }
        .mt-8 { margin-top: 2rem; }
        .mt-10 { margin-top: 2.5rem; }
        .mt-12 { margin-top: 3rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-3 { margin-bottom: 0.75rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-5 { margin-bottom: 1.25rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mb-8 { margin-bottom: 2rem; }
        .mb-10 { margin-bottom: 2.5rem; }
        .fluid { width: 100%; }
        .gap-2 { gap: 0.5rem; }
        .gap-3 { gap: 0.75rem; }
        .center { text-align: center; }
        .border-t { border-top: 1px solid var(--border); }
        .pt-4 { padding-top: 1rem; }
        .pt-5 { padding-top: 1.25rem; }
        .pt-6 { padding-top: 1.5rem; }
        .bg-gray-50 { background-color: #FAFBFC; }
      `}</style>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
