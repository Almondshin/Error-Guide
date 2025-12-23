import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import mermaid from 'mermaid';
import ReactMarkdown from 'react-markdown';

// Mermaid 초기화
mermaid.initialize({ 
  startOnLoad: false, 
  theme: 'default',
  securityLevel: 'loose',
  flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
  sequence: { useMaxWidth: true, showSequenceNumbers: true, height: 350 }
});

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
  return text.replace(/<br\s*\/?>/gi, '\n').replace(/\\n/g, '\n').replace(/&nbsp;/g, ' ');
};

const SYSTEM_INSTRUCTION_BASE = `
# Role: Senior Technical Architect & Enterprise Consultant
당신은 Java, Spring Boot 3.x, PostgreSQL 기반 엔터프라이즈 시스템의 수석 아키텍트입니다.

# 핵심 언어 지침 (CRITICAL)
**모든 분석 결과, 요약, 해결책, 단계별 가이드 및 인사이트는 반드시 한국어로 작성하십시오.** 
Markdown을 사용하여 가독성을 높이되, 중요한 용어는 **볼드체(**텍스트**)**를 사용하여 강조하십시오.

# 핵심 제약 사항
1. **절대 금지 문구**: "External Interface Layer Identity Data Verification / OTP Validation" 문구 사용 금지.
2. **레이어 명칭**: 한글 우선 (API 컨트롤러, 비즈니스 서비스, JPA 영속성 등).
3. **Markdown 준수**: 볼드 처리가 필요한 중요한 용어는 반드시 **용어** 형태로 작성하여 강조하십시오.
4. **다이어그램**: Mermaid 문법을 사용하십시오.
`;

// --- 컴포넌트 ---

function MermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && chart) {
      const renderId = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      let processed = String(chart).trim().replace(/^```mermaid\n?/, '').replace(/\n?```$/, '');

      const supportedTypes = ['flowchart', 'graph', 'sequenceDiagram', 'stateDiagram', 'erDiagram', 'classDiagram'];
      const hasType = supportedTypes.some(type => processed.toLowerCase().startsWith(type.toLowerCase()));
      
      if (!hasType) {
        processed = `flowchart TD\n${processed}`;
      }

      mermaid.render(renderId, processed).then(({ svg }) => {
        if (ref.current) {
          ref.current.innerHTML = svg;
          const svgEl = ref.current.querySelector('svg');
          if (svgEl) {
            svgEl.style.maxWidth = '100%';
            svgEl.style.height = 'auto';
            svgEl.style.maxHeight = '350px';
          }
        }
      }).catch(err => {
        console.error("Mermaid Render Error:", err);
        if (ref.current) {
          ref.current.innerHTML = `<div class="diag-err">다이어그램 렌더링 오류</div>`;
        }
      });
    }
  }, [chart]);
  return <div className="mermaid-outer"><div ref={ref} className="mermaid-container" /></div>;
}

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
  const itemsPerPage = 8;

  const [issueDefs, setIssueDefs] = useState<IssueDefinition[]>([]);
  const [editingIssue, setEditingIssue] = useState<Partial<IssueDefinition> | null>(null);
  const [showIssueForm, setShowIssueForm] = useState(false);

  useEffect(() => {
    const savedHistory = localStorage.getItem('eg_v43_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    const savedDefs = localStorage.getItem('eg_v43_error_defs');
    if (savedDefs) setErrorDefs(JSON.parse(savedDefs));
    const savedIssues = localStorage.getItem('eg_v43_issues');
    if (savedIssues) setIssueDefs(JSON.parse(savedIssues));
  }, []);

  const persist = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

  const handleHistoryClick = (item: HistoryItem) => {
    setInput(item.input);
    setResult(item.result);
    const resultSide = document.querySelector('.result-side');
    if (resultSide) resultSide.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const errorCtx = errorDefs.map(d => `[에러코드:${d.code}] ${d.description}`).join('\n');
      const issueCtx = issueDefs.map(i => `[해결사례] Q:${i.inquiry}/A:${i.answer}`).join('\n');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `장애 분석 요청:\n"${input}"`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_BASE + `\n\n# 참조 데이터:\n${errorCtx}\n\n# 사례 데이터:\n${issueCtx}`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              diagnosis: { 
                type: Type.OBJECT, 
                properties: { 
                  layer: { type: Type.STRING, description: "장애 발생 레이어" }, 
                  step: { type: Type.STRING, description: "장애 단계" }, 
                  summary: { type: Type.STRING, description: "진단 결과 요약 (Markdown)" } 
                }, 
                required: ["layer", "step", "summary"] 
              },
              solutionDescription: { type: Type.STRING, description: "상세 해결 방안 (Markdown)" },
              preCheck: { type: Type.STRING, description: "선행 점검 사항" },
              insight: { type: Type.STRING, description: "전문가 조언 (Markdown)" },
              mermaidGraph: { type: Type.STRING, description: "Mermaid 다이어그램" }
            },
            required: ["diagnosis", "solutionDescription", "preCheck", "insight", "mermaidGraph"]
          }
        }
      });
      const parsed = JSON.parse(response.text || '{}');
      setResult(parsed);
      const newHist = [{ id: generateId(), timestamp: Date.now(), input, result: parsed }, ...history].slice(0, 15);
      setHistory(newHist);
      persist('eg_v43_history', newHist);
    } catch (e: any) { 
      setError("분석 중 통신 장애가 발생했습니다: " + e.message); 
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
    persist('eg_v43_error_defs', updated);
    setShowErrorForm(false);
    setEditingDef(null);
  };

  const handleBulkImport = () => {
    if (!bulkInput.trim()) return;
    try {
      const parsed = JSON.parse(bulkInput);
      if (!Array.isArray(parsed)) throw new Error("배열 형식의 JSON이어야 합니다.");
      const newItems = parsed.map(p => ({ 
        id: generateId(),
        code: String(p.code || ''),
        description: String(p.description || ''),
        message: String(p.message || '')
      }));
      const updated = [...newItems, ...errorDefs];
      setErrorDefs(updated);
      persist('eg_v43_error_defs', updated);
      setShowBulkImport(false);
      setBulkInput('');
      alert(`${newItems.length}건의 데이터가 성공적으로 임포트되었습니다.`);
    } catch (e: any) { alert("Import 실패: " + e.message); }
  };

  const deleteErrorDef = (id: string) => {
    if (window.confirm("항목을 삭제하시겠습니까?")) {
      const updated = errorDefs.filter(d => String(d.id) !== String(id));
      setErrorDefs(updated);
      persist('eg_v43_error_defs', updated);
    }
  };

  const handleSaveIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIssue?.inquiry || !editingIssue?.answer) return;
    const item: IssueDefinition = {
      id: editingIssue.id || generateId(),
      inquiry: String(editingIssue.inquiry),
      answer: String(editingIssue.answer),
      status: 'resolved',
      timestamp: Date.now()
    };
    const updated = editingIssue.id ? issueDefs.map(i => i.id === editingIssue.id ? item : i) : [item, ...issueDefs];
    setIssueDefs(updated);
    persist('eg_v43_issues', updated);
    setShowIssueForm(false);
    setEditingIssue(null);
  };

  const deleteIssue = (id: string) => {
    if (window.confirm("항목을 삭제하시겠습니까?")) {
      const updated = issueDefs.filter(i => String(i.id) !== String(id));
      setIssueDefs(updated);
      persist('eg_v43_issues', updated);
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
      <header className="enterprise-header shadow-sm">
        <div className="brand-logo" onClick={() => setActiveTab('analyzer')}>
          <div className="logo-icon">E</div>
          <div className="logo-text">
            <h1>Error Guide</h1>
            <span>Professional Enterprise v4.3</span>
          </div>
        </div>
        <nav className="header-nav">
          <button className={activeTab === 'analyzer' ? 'active' : ''} onClick={() => setActiveTab('analyzer')}>아키텍처 진단</button>
          <button className={activeTab === 'error-manager' ? 'active' : ''} onClick={() => setActiveTab('error-manager')}>에러 코드 관리</button>
          <button className={activeTab === 'issue-manager' ? 'active' : ''} onClick={() => setActiveTab('issue-manager')}>지식 베이스</button>
          <button className={activeTab === 'mobile-guide' ? 'active' : ''} onClick={() => setActiveTab('mobile-guide')}>휴대폰본인확인 가이드</button>
        </nav>
      </header>

      <main className="main-viewport">
        {activeTab === 'analyzer' && (
          <div className="view-container animate-fade">
            <div className="layout-split">
              <aside className="input-side card">
                <div className="panel-header">
                   <h3>장애 진단 요청</h3>
                   <p>로그, 스택 트레이스 또는 현상을 입력하세요.</p>
                </div>
                <div className="field-group mt-4">
                  <textarea 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)} 
                    placeholder="분석할 에러 로그를 입력하세요..."
                  />
                </div>
                <button className="primary-btn fluid mt-4" onClick={handleAnalyze} disabled={loading || !input.trim()}>
                  {loading ? '전문가 AI 분석 중...' : '엔터프라이즈 진단 실행'}
                </button>
                {error && <div className="alert-error mt-4">{error}</div>}
                
                <div className="history-section mt-6">
                  <div className="flex-between mb-2">
                    <label className="section-title">최근 분석 히스토리</label>
                    <button className="text-btn" onClick={() => { setHistory([]); persist('eg_v43_history', []); }}>초기화</button>
                  </div>
                  <ul className="history-list">
                    {history.length > 0 ? history.map(h => (
                      <li key={h.id} className="history-item" onClick={() => handleHistoryClick(h)}>
                        <div className="hist-meta">
                          <span className="dot"></span>
                          <span className="hist-time">{new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="hist-preview">{h.input.substring(0, 45)}...</div>
                      </li>
                    )) : <li className="empty-hist">최근 히스토리가 없습니다.</li>}
                  </ul>
                </div>
              </aside>

              <section className="result-side">
                {loading ? (
                  <div className="loading-state">
                    <div className="spinner-orbit"></div>
                    <p>시스템 지식과 아키텍처를 대조하여 원인을 추론 중입니다...</p>
                  </div>
                ) : result ? (
                  <div className="result-frame animate-slide-up">
                    <div className="card shadow-md result-card">
                      <div className="result-meta">
                        <span className="badge-primary">{result.diagnosis.layer}</span>
                        <span className="badge-secondary">{result.diagnosis.step}</span>
                      </div>
                      
                      <div className="res-group mt-6">
                        <h4 className="res-label">진단 요약</h4>
                        <div className="summary-box markdown-content">
                          <ReactMarkdown>{sanitizeContent(result.diagnosis.summary)}</ReactMarkdown>
                        </div>
                      </div>

                      <div className="res-group mt-8">
                        <h4 className="res-label">장애 시퀀스 분석</h4>
                        <MermaidDiagram chart={result.mermaidGraph} />
                      </div>

                      <div className="res-group mt-8">
                        <h4 className="res-label">상세 해결 가이드</h4>
                        <div className="markdown-content">
                          <ReactMarkdown>{sanitizeContent(result.solutionDescription)}</ReactMarkdown>
                        </div>
                      </div>

                      <div className="res-group mt-8 border-t pt-6">
                         <h4 className="res-label">전문가 제언 (Insight)</h4>
                         <div className="insight-card markdown-content">
                           <ReactMarkdown>{`💡 ${sanitizeContent(result.insight)}`}</ReactMarkdown>
                         </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📂</div>
                    <h3>분석 데이터 대기 중</h3>
                    <p>로그를 붙여넣거나 히스토리를 클릭하여 진단 리포트를 생성하세요.</p>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {activeTab === 'error-manager' && (
          <div className="view-container animate-fade">
             <div className="view-header flex-between mb-6 error-manager-header">
                <div className="title-block">
                  <h2>에러 코드 지식 관리</h2>
                  <p>시스템 에러 코드와 대응 메시지를 통합 관리합니다.</p>
                </div>
                <div className="action-block">
                  <button className="secondary-btn" onClick={() => setShowBulkImport(!showBulkImport)}>
                    {showBulkImport ? '임포트창 닫기' : '대량 임포트'}
                  </button>
                  <button className="primary-btn" onClick={() => { setEditingDef({id:'', code:'', description:'', message:''}); setShowErrorForm(true); }}>
                    개별 등록
                  </button>
                </div>
             </div>

             {showBulkImport && (
                <div className="bulk-editor card shadow-md mb-6 animate-slide-up bulk-import-card">
                   <div className="flex-between mb-4">
                      <label className="font-bold">JSON 대량 임포트</label>
                      <span className="text-muted text-xs">형식: [{"code":"9999", "description":"...", "message":"..."}]</span>
                   </div>
                   <textarea 
                     className="bulk-textarea"
                     value={bulkInput} 
                     onChange={e => setBulkInput(e.target.value)} 
                     placeholder='이곳에 JSON 배열을 붙여넣으세요...' 
                   />
                   <div className="flex justify-end mt-4 gap-2">
                      <button className="secondary-btn" onClick={() => setShowBulkImport(false)}>취소</button>
                      <button className="primary-btn" onClick={handleBulkImport}>데이터 실행</button>
                   </div>
                </div>
             )}

             {showErrorForm && (
               <div className="form-overlay-card shadow-lg animate-slide-up mb-6">
                 <form className="card" onSubmit={handleSaveErrorDef}>
                    <h3 className="mb-4">에러 정의 {editingDef?.id ? '수정' : '등록'}</h3>
                    <div className="form-grid">
                      <div className="field">
                        <label>에러 코드 (ID)</label>
                        <input type="text" required value={editingDef?.code} onChange={e => setEditingDef({...editingDef!, code: e.target.value})} placeholder="예: 9999" />
                      </div>
                      <div className="field">
                        <label>관리용 설명</label>
                        <input type="text" required value={editingDef?.description} onChange={e => setEditingDef({...editingDef!, description: e.target.value})} placeholder="장애 상황 요약" />
                      </div>
                      <div className="field full">
                        <label>사용자 노출 메시지</label>
                        <input type="text" required value={editingDef?.message} onChange={e => setEditingDef({...editingDef!, message: e.target.value})} placeholder="공식 안내 문구" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                      <button type="button" className="secondary-btn" onClick={() => setShowErrorForm(false)}>취소</button>
                      <button type="submit" className="primary-btn">저장하기</button>
                    </div>
                 </form>
               </div>
             )}

             <div className="card shadow-sm p-0 overflow-hidden table-card">
                <div className="table-search-box p-4 border-b">
                   <input 
                     type="text" 
                     placeholder="에러 코드 또는 설명 검색..." 
                     value={errorSearchTerm}
                     onChange={(e) => { setErrorSearchTerm(e.target.value); setErrorCurrentPage(1); }}
                   />
                </div>
                <table className="data-table">
                   <thead>
                     <tr><th>CODE</th><th>DESCRIPTION</th><th>USER MESSAGE</th><th className="center">ACTION</th></tr>
                   </thead>
                   <tbody>
                     {paginatedErrorDefs.length > 0 ? paginatedErrorDefs.map(d => (
                       <tr key={d.id}>
                         <td className="font-mono font-bold text-primary">{d.code}</td>
                         <td>{d.description}</td>
                         <td className="text-success">{d.message}</td>
                         <td className="center">
                           <div className="flex gap-2 justify-center">
                             <button className="btn-icon" onClick={() => { setEditingDef(d); setShowErrorForm(true); }}>✏️</button>
                             <button className="btn-icon danger" onClick={() => deleteErrorDef(d.id)}>🗑️</button>
                           </div>
                         </td>
                       </tr>
                     )) : (
                       <tr><td colSpan={4} className="center p-10 text-muted">데이터가 없습니다.</td></tr>
                     )}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {activeTab === 'issue-manager' && (
          <div className="view-container animate-fade">
             <div className="view-header flex-between mb-6">
                <div className="title-block">
                  <h2>장애 해결 지식 베이스</h2>
                  <p>실제 장애 대응 노하우를 기록합니다.</p>
                </div>
                <button className="primary-btn" onClick={() => { setEditingIssue({ inquiry: '', answer: '' }); setShowIssueForm(true); }}>새 사례 등록</button>
             </div>

             {showIssueForm && (
                <div className="form-overlay-card shadow-lg mb-6">
                  <form className="card" onSubmit={handleSaveIssue}>
                    <h3 className="mb-4">해결 사례 등록</h3>
                    <div className="field mb-4">
                      <label>제목</label>
                      <input type="text" required value={editingIssue?.inquiry} onChange={e => setEditingIssue({...editingIssue!, inquiry: e.target.value})} />
                    </div>
                    <div className="field">
                      <label>내용 (Markdown 지원)</label>
                      <textarea required value={editingIssue?.answer} onChange={e => setEditingIssue({...editingIssue!, answer: e.target.value})} style={{height: '200px'}} />
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                      <button type="button" className="secondary-btn" onClick={() => setShowIssueForm(false)}>취소</button>
                      <button type="submit" className="primary-btn">지식 저장</button>
                    </div>
                  </form>
                </div>
             )}

             <div className="issue-grid">
                {issueDefs.map(i => (
                  <div key={i.id} className="issue-card card shadow-sm">
                    <div className="flex-between">
                      <h4 className="issue-title">Q: {i.inquiry}</h4>
                      <div className="flex gap-2">
                         <button className="btn-icon" onClick={() => { setEditingIssue(i); setShowIssueForm(true); }}>✏️</button>
                         <button className="btn-icon danger" onClick={() => deleteIssue(i.id)}>🗑️</button>
                      </div>
                    </div>
                    <div className="issue-body markdown-content mt-4">
                      <ReactMarkdown>{sanitizeContent(i.answer)}</ReactMarkdown>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'mobile-guide' && (
          <div className="view-container animate-fade">
             <div className="guide-hero card shadow-md mb-8">
                <div className="hero-content">
                  <h2>휴대폰본인확인 기술 가이드</h2>
                  <p>Mobile-OK 표준 연동 규격 및 API 상세 명세를 확인하여 빠르고 안정적인 시스템을 구축하세요.</p>
                  <div className="hero-tags mt-4">
                    <span className="tag">REST API</span>
                    <span className="tag">Standard Spec</span>
                    <span className="tag">Security</span>
                  </div>
                </div>
                <div className="hero-illustration">📘</div>
             </div>

             <div className="guide-grid">
                <a href="https://manager.mobile-ok.com/guide/mok_std_guide/" target="_blank" rel="noopener noreferrer" className="guide-card-v2 shadow-sm">
                   <div className="card-top">
                     <div className="icon-wrap">📜</div>
                     <div className="link-badge">Official Document</div>
                   </div>
                   <div className="card-body">
                     <h3>표준 연동 가이드</h3>
                     <p>웹/앱 본인확인 표준 인터페이스 정의 및 사용자 흐름도(User Flow) 안내</p>
                   </div>
                   <div className="card-footer">
                     <span>가이드 바로가기</span>
                     <span className="arrow">→</span>
                   </div>
                </a>

                <a href="https://manager.mobile-ok.com/guide/mok_api_guide/" target="_blank" rel="noopener noreferrer" className="guide-card-v2 shadow-sm">
                   <div className="card-top">
                     <div className="icon-wrap">🔧</div>
                     <div className="link-badge">Developer Reference</div>
                   </div>
                   <div className="card-body">
                     <h3>REST API 상세 규격</h3>
                     <p>서버 간 통신을 위한 요청/응답 전문 규격, 파라미터 상세 정의 및 에러 코드 명세</p>
                   </div>
                   <div className="card-footer">
                     <span>규격서 바로가기</span>
                     <span className="arrow">→</span>
                   </div>
                </a>
             </div>

             <div className="guide-resources mt-10">
                <h3 className="section-subtitle">추가 리소스</h3>
                <div className="resource-list card mt-4">
                   <div className="resource-item">
                      <span className="res-icon">💡</span>
                      <div className="res-info">
                        <h4>연동 시 유의사항</h4>
                        <p>본인확인 서비스 연동 시 보안 인증 및 암호화 알고리즘 적용 가이드를 준수해야 합니다.</p>
                      </div>
                   </div>
                   <div className="resource-item border-t">
                      <span className="res-icon">⚙️</span>
                      <div className="res-info">
                        <h4>운영 지원 채널</h4>
                        <p>기술적 문의사항은 Mobile-OK 운영 지원 포털을 통해 문의해 주시기 바랍니다.</p>
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
          --primary-dark: #0747A6;
          --bg: #F4F5F7; 
          --text: #172B4D; 
          --text-muted: #6B778C;
          --border: #DFE1E6; 
          --success: #00875A;
          --danger: #DE350B;
          --indigo: #403294;
        }
        
        body { margin: 0; background: var(--bg); color: var(--text); font-family: 'Pretendard', sans-serif; -webkit-font-smoothing: antialiased; }
        .enterprise-shell { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        
        /* Header */
        .enterprise-header { height: 72px; background: #fff; display: flex; justify-content: space-between; align-items: center; padding: 0 40px; border-bottom: 1px solid var(--border); z-index: 100; }
        .brand-logo { display: flex; align-items: center; gap: 14px; cursor: pointer; }
        .logo-icon { width: 38px; height: 38px; background: var(--primary); border-radius: 10px; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.4rem; }
        .logo-text h1 { margin: 0; font-size: 1.25rem; font-weight: 800; letter-spacing: -0.5px; }
        .logo-text span { font-size: 0.75rem; color: var(--text-muted); }
        .header-nav { display: flex; gap: 8px; }
        .header-nav button { border: none; background: none; padding: 10px 18px; font-weight: 700; color: #42526E; cursor: pointer; border-radius: 6px; transition: 0.2s; font-size: 0.95rem; }
        .header-nav button:hover { background: #F4F5F7; color: var(--primary); }
        .header-nav button.active { background: #E9F2FF; color: var(--primary); }

        .main-viewport { flex: 1; overflow-y: auto; padding: 30px 40px; }
        .view-container { max-width: 1300px; margin: 0 auto; }
        
        /* Layout */
        .layout-split { display: grid; grid-template-columns: 380px 1fr; gap: 30px; align-items: start; }
        .card { background: #fff; border-radius: 12px; padding: 24px; border: 1px solid var(--border); }
        .shadow-sm { box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .shadow-md { box-shadow: 0 4px 12px rgba(9, 30, 66, 0.08); }

        /* History List */
        .history-section { border-top: 1px solid var(--border); padding-top: 20px; }
        .section-title { font-weight: 800; font-size: 0.85rem; color: var(--text); }
        .text-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.75rem; font-weight: 600; padding: 4px; }
        .text-btn:hover { color: var(--danger); text-decoration: underline; }
        .history-list { list-style: none; padding: 0; margin: 10px 0; max-height: 350px; overflow-y: auto; }
        .history-item { 
          padding: 12px; margin-bottom: 8px; border-radius: 8px; border: 1px solid var(--border); 
          background: #FBFBFC; cursor: pointer; transition: 0.2s;
        }
        .history-item:hover { border-color: var(--primary); background: #fff; transform: translateX(5px); box-shadow: 0 2px 6px rgba(0,0,0,0.05); }
        .hist-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .dot { width: 6px; height: 6px; background: var(--primary); border-radius: 50%; }
        .hist-time { font-size: 0.7rem; font-weight: 700; color: var(--text-muted); }
        .hist-preview { font-size: 0.85rem; color: var(--text); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .empty-hist { text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px; }

        /* Forms */
        textarea, input[type="text"] { 
          width: 100%; border: 2px solid var(--border); border-radius: 8px; padding: 12px; 
          background: #fff !important; color: var(--text) !important; font-family: inherit; font-size: 1rem;
          box-sizing: border-box; outline: none; transition: 0.2s;
        }
        textarea:focus, input[type="text"]:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(0,82,204,0.1); }
        textarea { height: 180px; resize: none; line-height: 1.5; }
        .primary-btn { background: var(--primary); color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-weight: 700; cursor: pointer; transition: 0.2s; font-size: 0.95rem; }
        .primary-btn:hover { background: var(--primary-dark); transform: translateY(-1px); }
        .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .primary-btn.fluid { width: 100%; padding: 14px; }
        .secondary-btn { background: #EBECF0; color: #44546F; border: none; padding: 10px 24px; border-radius: 6px; font-weight: 700; cursor: pointer; transition: 0.2s; font-size: 0.95rem; }
        .secondary-btn:hover { background: #DFE1E6; }

        /* Result Visualization */
        .result-card { border-top: 4px solid var(--primary); }
        .badge-primary { background: #EAE6FF; color: var(--indigo); font-weight: 800; padding: 4px 12px; border-radius: 4px; font-size: 0.75rem; }
        .badge-secondary { background: #E3FCEF; color: #006644; font-weight: 800; padding: 4px 12px; border-radius: 4px; font-size: 0.75rem; margin-left: 8px; }
        .res-label { font-size: 1.1rem; border-left: 5px solid var(--primary); padding-left: 15px; margin-bottom: 16px; font-weight: 800; }
        
        .markdown-content { font-size: 1.05rem; line-height: 1.7; color: var(--text); }
        .markdown-content strong { font-weight: 800 !important; color: #000 !important; }
        .markdown-content p { margin: 10px 0; }
        .markdown-content ul { padding-left: 20px; margin: 10px 0; }
        .markdown-content li { margin-bottom: 6px; }

        .summary-box { background: #F4F5F7; padding: 20px; border-radius: 10px; border: 1px solid var(--border); }
        
        /* Mermaid Diagram Control */
        .mermaid-outer { 
          background: #fff; border: 1px solid var(--border); border-radius: 12px; 
          margin: 16px 0; overflow: hidden; max-height: 400px;
        }
        .mermaid-container { display: flex; justify-content: center; padding: 15px; overflow: auto; }
        
        .insight-card { 
          background: #EAE6FF; padding: 20px; border-radius: 12px; border: 1px solid #D1C6FF; 
          color: #2D1E7A; font-weight: 500;
        }
        .insight-card strong { color: var(--indigo); font-weight: 900 !important; }

        /* Guide Tab v2 */
        .guide-hero { background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); color: #fff; padding: 50px; border: none; display: flex; justify-content: space-between; align-items: center; border-radius: 16px; position: relative; overflow: hidden; }
        .hero-content { z-index: 2; max-width: 60%; }
        .hero-content h2 { font-size: 2.2rem; margin: 0 0 15px; font-weight: 800; }
        .hero-content p { font-size: 1.1rem; opacity: 0.9; line-height: 1.6; margin: 0; }
        .hero-tags { display: flex; gap: 8px; }
        .tag { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }
        .hero-illustration { font-size: 6rem; opacity: 0.2; transform: rotate(15deg); user-select: none; }

        .guide-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .guide-card-v2 { background: #fff; border-radius: 16px; padding: 30px; text-decoration: none; color: inherit; display: flex; flex-direction: column; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); border: 1px solid var(--border); }
        .guide-card-v2:hover { transform: translateY(-8px); border-color: var(--primary); box-shadow: 0 15px 35px rgba(0,82,204,0.1); }
        .card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .icon-wrap { font-size: 3rem; background: #F4F5F7; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; border-radius: 20px; transition: 0.3s; }
        .guide-card-v2:hover .icon-wrap { background: #E9F2FF; transform: scale(1.05); }
        .link-badge { font-size: 0.7rem; font-weight: 800; color: var(--primary); background: #E9F2FF; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; }
        .card-body h3 { font-size: 1.4rem; margin: 0 0 12px; color: var(--text); }
        .card-body p { font-size: 1rem; color: var(--text-muted); line-height: 1.6; margin: 0; }
        .card-footer { margin-top: auto; padding-top: 25px; display: flex; justify-content: space-between; align-items: center; font-weight: 700; color: var(--primary); font-size: 0.95rem; }
        .arrow { font-size: 1.2rem; transition: 0.2s; }
        .guide-card-v2:hover .arrow { transform: translateX(5px); }

        .section-subtitle { font-size: 1.2rem; font-weight: 800; color: var(--text); }
        .resource-list { padding: 0; }
        .resource-item { display: flex; gap: 20px; padding: 25px; }
        .res-icon { font-size: 1.8rem; }
        .res-info h4 { margin: 0 0 5px; font-size: 1.05rem; }
        .res-info p { margin: 0; color: var(--text-muted); font-size: 0.9rem; line-height: 1.5; }

        /* Generic Utils */
        .flex-between { display: flex; justify-content: space-between; align-items: center; }
        .mt-10 { margin-top: 40px; }
        .loading-state { text-align: center; padding: 100px 0; color: var(--text-muted); }
        .spinner-orbit { border: 4px solid rgba(0,0,0,0.05); border-top: 4px solid var(--primary); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .animate-fade { animation: fadeIn 0.4s; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-slide-up { animation: slideUp 0.4s ease-out; }
        @keyframes slideUp { from { transform: translateY(15px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .diag-err { color: var(--danger); padding: 15px; font-weight: 700; text-align: center; }
        .empty-state { text-align: center; padding: 100px 40px; color: var(--text-muted); border: 2px dashed var(--border); border-radius: 16px; }
        .empty-icon { font-size: 4rem; opacity: 0.2; margin-bottom: 20px; }
      `}</style>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
