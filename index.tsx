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
  flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' }
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

type Tab = 'analyzer' | 'error-manager' | 'issue-manager' | 'guide';

// --- 유틸리티 ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const sanitizeContent = (text: string) => {
  if (!text) return '';
  // <br> 태그 및 변형들을 실제 개행 문자로 치환
  return text.replace(/<br\s*\/?>/gi, '\n').replace(/\\n/g, '\n');
};

const SYSTEM_INSTRUCTION_BASE = `
# Role: 수석 기술 아키텍트 및 프로덕트 전략가
당신은 Java, Spring Boot 3.x 기반의 엔터프라이즈 시스템 수석 아키텍트입니다.

# 분석 지침 (CRITICAL)
1. **지식 베이스 우선 참조**: "에러 지식 베이스" 및 "문제 해결 지식 베이스"에 등록된 정보를 절대적 기준으로 진단하십시오.
2. **사례 기반 답변**: 유사한 문의 내용이 있다면 해당 해결답변을 참고하십시오.
3. **가정적 표현 금지**: 사실 위주로 명확하게 답변하십시오.
4. **Markdown 활용**: 모든 텍스트 응답은 Markdown 형식을 사용하되, HTML 태그(특히 <br>)는 절대 사용하지 말고 개행(\\n)을 사용하십시오.
5. **금지 문구**: "External Interface (Telecom Carrier) Identity Verification & OTP Validation"라는 제목이나 문구를 결과에 포함하지 마십시오.
6. **Mermaid 문법 준수 (매우 중요)**: 
   - 반드시 'flowchart TD' 형식을 사용하십시오.
   - 모든 노드의 라벨은 반드시 큰따옴표로 감싸십시오. (예: A["사용자(Client)"])
   - **화살표 라벨(예: |텍스트|) 내부에 중복 따옴표 ""텍스트"" 를 만들지 마십시오.** 단일 세트의 큰따옴표만 허용됩니다. (예: A -->|"결과 확인"| B)
   - 화살표 라벨 내부에 대괄호 [ ] 나 중괄호 { } 를 사용하지 마십시오.
7. **JSON 응답 보장**: 모든 응답은 반드시 지정된 JSON 포맷을 지켜야 합니다.
`;

// --- 컴포넌트 ---

function MermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && chart) {
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      
      // AI가 생성한 문자열에서 코드 블록 마크업 제거 및 기본 정제
      let cleanChart = String(chart).trim()
        .replace(/^```mermaid\n?/, '')
        .replace(/\n?```$/, '')
        .replace(/@startuml/g, 'sequenceDiagram')
        .replace(/@enduml/g, '');

      // [방어 코드] Mermaid 문법 자동 보정
      let processed = cleanChart;
      
      // 1. 화살표 라벨 |...| 중복 따옴표 방지 및 특수문자 처리
      processed = processed.replace(/\|([^|]*)\|/g, (match, p1) => {
        let content = p1.trim();
        // 앞뒤의 모든 중복 따옴표 제거 후 단일 따옴표로 재포장
        content = content.replace(/^"+/, '').replace(/"+$/, '');
        // 내부 특수문자 보정
        content = content.replace(/\[/g, '(').replace(/\]/g, ')').replace(/\{/g, '(').replace(/\}/g, ')');
        return `|"${content}"|`;
      });

      // 2. 노드 라벨 ID[...] 또는 ID{...} 따옴표 누락 보정
      // 괄호 안의 내용이 따옴표로 시작하지 않는 경우 따옴표 추가
      processed = processed.replace(/(\w+)\[([^"\]][^\]]*)\]/g, '$1["$2"]');
      processed = processed.replace(/(\w+)\{([^"\}][^\}]*)\}/g, '$1{"$2"}');

      // flowchart TD가 누락된 경우 보정
      if (!processed.startsWith('flowchart') && !processed.startsWith('graph') && !processed.startsWith('sequenceDiagram')) {
        processed = `flowchart TD\n${processed}`;
      }
      
      mermaid.render(id, processed).then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg;
      }).catch(err => {
        console.error("Mermaid 렌더링 오류:", err);
        if (ref.current) ref.current.innerHTML = `<div style="color:#D12420; font-size:12px; padding:10px; border:1px solid #FFEBE6; border-radius:4px;">다이어그램 구성 중 문법 오류가 발생했습니다. (AI 응답 재시도 권장)</div>`;
      });
    }
  }, [chart]);
  return <div ref={ref} className="mermaid" style={{ background: '#fff', padding: '15px', borderRadius: '8px', overflow: 'auto', border: '1px solid #EBECF0' }} />;
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

  // 로컬 스토리지 초기화
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('error_guide_history');
      if (savedHistory) setHistory(JSON.parse(savedHistory));

      const savedDefs = localStorage.getItem('error_definitions');
      if (savedDefs) {
        const parsed: any[] = JSON.parse(savedDefs);
        setErrorDefs(parsed.map(d => ({ 
          id: String(d.id || generateId()), 
          code: String(d.code || ''), 
          description: sanitizeContent(String(d.description || '')), 
          message: String(d.message || '') 
        })));
      }

      const savedIssues = localStorage.getItem('issue_definitions');
      if (savedIssues) {
        const parsedIssues: any[] = JSON.parse(savedIssues);
        setIssueDefs(parsedIssues.map(i => ({
          ...i,
          inquiry: String(i.inquiry || ''),
          answer: sanitizeContent(String(i.answer || ''))
        })));
      }
    } catch (e) {
      console.error("데이터 로딩 중 오류:", e);
    }
  }, []);

  const saveHistory = (newInput: string, newResult: any) => {
    const newItem = { id: generateId(), timestamp: Date.now(), input: String(newInput), result: newResult };
    const updated = [newItem, ...history].slice(0, 20);
    setHistory(updated);
    localStorage.setItem('error_guide_history', JSON.stringify(updated));
  };

  // 에러 코드 CRUD
  const handleSaveErrorDef = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDef) return;
    const itemToSave = {
      ...editingDef,
      id: editingDef.id || generateId(),
      code: String(editingDef.code || ''),
      description: sanitizeContent(String(editingDef.description || '')),
      message: String(editingDef.message || '')
    };
    
    setErrorDefs(prev => {
      const updated = editingDef.id 
        ? prev.map(d => d.id === editingDef.id ? itemToSave : d)
        : [...prev, itemToSave];
      localStorage.setItem('error_definitions', JSON.stringify(updated));
      return updated;
    });
    
    setShowErrorForm(false);
    setEditingDef(null);
  };

  const deleteErrorDef = (id: string) => {
    if (window.confirm("항목을 삭제하시겠습니까?")) {
      setErrorDefs(prev => {
        const updated = prev.filter(d => String(d.id) !== String(id));
        localStorage.setItem('error_definitions', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const handleBulkImport = () => {
    try {
      const parsed = JSON.parse(bulkInput);
      if (!Array.isArray(parsed)) throw new Error("JSON 배열 형식이어야 합니다.");
      const newItems = parsed.map(p => ({ 
        id: generateId(),
        code: String(p.code || ''),
        description: sanitizeContent(String(p.description || '')),
        message: String(p.message || '')
      }));
      
      setErrorDefs(prev => {
        const updated = [...prev, ...newItems];
        localStorage.setItem('error_definitions', JSON.stringify(updated));
        return updated;
      });
      
      setShowBulkImport(false);
      setBulkInput('');
    } catch (e: any) { alert(e.message); }
  };

  // 이슈 매니저 CRUD
  const handleSaveIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIssue?.inquiry || !editingIssue?.answer) return;
    const issueToSave: IssueDefinition = {
      id: editingIssue.id || generateId(),
      inquiry: String(editingIssue.inquiry || ''),
      answer: sanitizeContent(String(editingIssue.answer || '')),
      status: (editingIssue.status as 'resolved' | 'pending') || 'resolved',
      timestamp: Date.now()
    };
    
    setIssueDefs(prev => {
      const updated = editingIssue.id 
        ? prev.map(i => i.id === editingIssue.id ? issueToSave : i)
        : [issueToSave, ...prev];
      localStorage.setItem('issue_definitions', JSON.stringify(updated));
      return updated;
    });
    
    setShowIssueForm(false);
    setEditingIssue(null);
  };

  const deleteIssue = (id: string) => {
    if (window.confirm("이 사례를 삭제하시겠습니까?")) {
      setIssueDefs(prev => {
        const updated = prev.filter(i => i.id !== id);
        localStorage.setItem('issue_definitions', JSON.stringify(updated));
        return updated;
      });
    }
  };

  // 필터링 및 페이징
  const filteredErrorDefs = useMemo(() => 
    errorDefs.filter(d => 
      String(d.code).toLowerCase().includes(errorSearchTerm.toLowerCase()) || 
      String(d.description).toLowerCase().includes(errorSearchTerm.toLowerCase()) ||
      (d.message && String(d.message).toLowerCase().includes(errorSearchTerm.toLowerCase()))
    ), [errorDefs, errorSearchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredErrorDefs.length / itemsPerPage));

  useEffect(() => {
    if (errorCurrentPage > totalPages && totalPages > 0) {
      setErrorCurrentPage(totalPages);
    }
  }, [totalPages, errorCurrentPage]);

  const paginatedErrorDefs = useMemo(() => {
    const start = (errorCurrentPage - 1) * itemsPerPage;
    return filteredErrorDefs.slice(start, start + itemsPerPage);
  }, [filteredErrorDefs, errorCurrentPage]);

  // 분석 실행
  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const errorContext = errorDefs.map(d => `[코드:${d.code}] ${d.description}`).join('\n');
      const issueContext = issueDefs.filter(i => i.status === 'resolved').map(i => `[사례] 문:${i.inquiry}/답:${i.answer}`).join('\n');
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `분석 요청: "${input}"`,
        config: {
          systemInstruction: `${SYSTEM_INSTRUCTION_BASE}\n\n# 참조 지식:\n${errorContext}\n\n# 사례 히스토리:\n${issueContext}`,
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
              insight: { type: Type.STRING },
              mermaidGraph: { type: Type.STRING }
            },
            required: ["diagnosis", "solutionDescription", "preCheck", "insight", "mermaidGraph"]
          }
        }
      });
      const parsed = JSON.parse(response.text || '{}');
      setResult(parsed);
      saveHistory(input, parsed);
    } catch (e: any) { 
      setError(String(e.message || e)); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="app-container">
      <header className="main-header">
        <div className="logo">
          <h1>에러 가이드 <span className="v-tag">v3.5 Enterprise</span></h1>
          <p className="sub-logo-text">수석 아키텍트 지능형 통합 진단 플랫폼</p>
        </div>
        <nav className="main-nav">
          <button className={activeTab === 'analyzer' ? 'active' : ''} onClick={() => setActiveTab('analyzer')}>진단 센터</button>
          <button className={activeTab === 'error-manager' ? 'active' : ''} onClick={() => setActiveTab('error-manager')}>에러 코드 관리</button>
          <button className={activeTab === 'issue-manager' ? 'active' : ''} onClick={() => setActiveTab('issue-manager')}>문제 해결 지식 베이스</button>
          <button className={activeTab === 'guide' ? 'active' : ''} onClick={() => setActiveTab('guide')}>아키텍처 가이드</button>
        </nav>
      </header>

      <main className="main-content">
        {activeTab === 'analyzer' && (
          <div className="analyzer-layout">
            <div className="side-panel">
              <div className="card shadow-sm">
                <h3 className="section-title">분석 요청</h3>
                <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="문의 내용이나 에러 코드를 입력하세요..." />
                <button className="primary-btn mt-2" onClick={handleAnalyze} disabled={loading || !input.trim()}>
                  {loading ? '분석 중...' : '해결책 도출'}
                </button>
                {error && <div className="error-box mt-2">{String(error)}</div>}
              </div>
              <div className="card shadow-sm history-card mt-4">
                <h3 className="section-title">최근 분석 이력</h3>
                <ul className="history-list">
                  {history.map(h => (
                    <li key={h.id} onClick={() => { setInput(String(h.input)); setResult(h.result); }}>
                      <span className="h-input">{String(h.input || '').substring(0, 35)}...</span>
                      <span className="h-date">{new Date(h.timestamp).toLocaleTimeString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="result-panel">
              {loading ? (
                <div className="loading-state"><div className="spinner"></div><p>지식 베이스를 대조하여 해결책을 도출 중입니다...</p></div>
              ) : result ? (
                <div className="analysis-result animate-fade">
                  <div className="header-meta">
                    <span className="badge layer">{String(result?.diagnosis?.layer || '')}</span>
                    <span className="badge step">{String(result?.diagnosis?.step || '')}</span>
                  </div>
                  <section className="res-section">
                    <h2 className="res-title">진단 요약</h2>
                    <p className="summary-text">{String(result?.diagnosis?.summary || '')}</p>
                  </section>
                  <section className="res-section pre-check-section highlight">
                    <div className="section-header">🛡️ <h2 className="res-title">Pre-check 최적화 제안</h2></div>
                    <div className="precheck-box markdown-body">
                      <ReactMarkdown>{sanitizeContent(String(result?.preCheck || ''))}</ReactMarkdown>
                    </div>
                  </section>
                  <section className="res-section">
                    <h2 className="res-title">장애 지점 시퀀스</h2>
                    <MermaidDiagram chart={String(result?.mermaidGraph || '')} />
                  </section>
                  <section className="res-section solution-section">
                    <h2 className="res-title">상세 해결 가이드</h2>
                    <div className="solution-description-box markdown-body">
                      <ReactMarkdown>{sanitizeContent(String(result?.solutionDescription || ''))}</ReactMarkdown>
                    </div>
                  </section>
                </div>
              ) : (
                <div className="welcome-state">🔍 왼쪽 패널에 에러 정보를 입력하여 분석을 시작하세요.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'error-manager' && (
          <div className="manager-view card shadow-sm animate-fade">
            <div className="card-header flex justify-between items-center">
              <h2 className="section-title-lg mb-0">에러 코드 지식 관리</h2>
              <div className="action-group">
                <button className="secondary-btn" onClick={() => { setShowBulkImport(!showBulkImport); setShowErrorForm(false); }}>대량 임포트</button>
                <button className="add-btn" onClick={() => { setEditingDef({id:'', code:'', description:'', message:''}); setShowErrorForm(true); setShowBulkImport(false); }}>개별 추가</button>
              </div>
            </div>
            
            <div className="table-controls mt-6">
              <input type="text" placeholder="코드, 설명 또는 메시지로 검색..." value={errorSearchTerm} onChange={(e) => { setErrorSearchTerm(e.target.value); setErrorCurrentPage(1); }} className="search-input" />
            </div>

            {showErrorForm && (
              <form className="edit-form card mt-4 border-2 border-accent" onSubmit={handleSaveErrorDef}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="input-group">
                    <label>에러 코드</label>
                    <input required value={editingDef?.code || ''} onChange={e => setEditingDef({...editingDef!, code: e.target.value})} placeholder="예: 2910" />
                  </div>
                  <div className="input-group">
                    <label>에러 설명 (관리용)</label>
                    <textarea required value={editingDef?.description || ''} onChange={e => setEditingDef({...editingDef!, description: e.target.value})} placeholder="상세 기술적 오류 원인" style={{height: '60px'}} />
                  </div>
                  <div className="input-group md:col-span-2">
                    <label>고객 노출 메시지</label>
                    <textarea required value={editingDef?.message || ''} onChange={e => setEditingDef({...editingDef!, message: e.target.value})} placeholder="사용자에게 보여질 안내 문구" style={{height: '60px'}} />
                  </div>
                </div>
                <div className="form-actions mt-4 flex justify-end gap-2">
                  <button type="submit" className="primary-btn w-auto px-10">데이터 저장</button>
                  <button type="button" className="cancel-btn" onClick={() => { setShowErrorForm(false); setEditingDef(null); }}>취소</button>
                </div>
              </form>
            )}

            {showBulkImport && (
              <div className="bulk-box card mt-4 bg-gray-50 border-dashed border-2">
                <label className="font-bold">JSON 대량 임포트 (기존 데이터 유지)</label>
                <textarea className="mt-2" value={bulkInput} onChange={e => setBulkInput(e.target.value)} placeholder='[{"code":"5033", "description":"...", "message":"..."}]' />
                <div className="flex justify-end mt-2">
                   <button className="primary-btn" onClick={handleBulkImport}>데이터 실행</button>
                </div>
              </div>
            )}

            <div className="table-responsive mt-6">
              <table className="def-table">
                <thead>
                  <tr>
                    <th style={{width: '12%'}}>에러코드</th>
                    <th style={{width: '33%'}}>설명</th>
                    <th style={{width: '40%'}}>고객메세지</th>
                    <th style={{width: '15%', textAlign: 'center'}}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedErrorDefs.map(d => (
                    <tr key={d.id}>
                      <td className="code-cell">{String(d.code || '')}</td>
                      <td className="data-text" style={{ whiteSpace: 'pre-wrap' }}>{String(d.description || '')}</td>
                      <td className="data-text msg-text" dangerouslySetInnerHTML={{ __html: String(d.message || '-') }}></td>
                      <td style={{textAlign: 'center'}}>
                        <div className="flex justify-center gap-2">
                          <button className="edit-btn-small" onClick={() => { setEditingDef(d); setShowErrorForm(true); setShowBulkImport(false); }}>수정</button>
                          <button className="del-btn-small" onClick={() => deleteErrorDef(d.id)}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedErrorDefs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-gray-400">등록된 데이터가 없거나 검색 결과가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination mt-6">
                <button disabled={errorCurrentPage === 1} onClick={() => setErrorCurrentPage(p => p - 1)} className="page-btn">이전</button>
                <div className="page-numbers flex gap-2">
                  {[...Array(totalPages)].map((_, i) => (
                    <button 
                      key={i} 
                      onClick={() => setErrorCurrentPage(i + 1)} 
                      className={`page-num-btn ${errorCurrentPage === i + 1 ? 'active' : ''}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button disabled={errorCurrentPage === totalPages} onClick={() => setErrorCurrentPage(p => p + 1)} className="page-btn">다음</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'issue-manager' && (
          <div className="issue-manager card shadow-sm animate-fade">
            <div className="card-header flex justify-between items-center">
              <h2 className="section-title-lg mb-0">문제 해결 지식 베이스 (사례 관리)</h2>
              <button className="add-btn" onClick={() => { setEditingIssue({ inquiry: '', answer: '', status: 'resolved' }); setShowIssueForm(true); }}>새 사례 추가</button>
            </div>
            {showIssueForm && (
              <form className="edit-form card mt-4 border-2 border-accent" onSubmit={handleSaveIssue}>
                <div className="input-group">
                  <label>사용자 문의 내용</label>
                  <textarea required value={editingIssue?.inquiry || ''} onChange={e => setEditingIssue({ ...editingIssue!, inquiry: e.target.value })} placeholder="예: 인증번호가 오지 않아요" />
                </div>
                <div className="input-group mt-3">
                  <label>해결 답변/가이드</label>
                  <textarea required value={editingIssue?.answer || ''} onChange={e => setEditingIssue({ ...editingIssue!, answer: e.target.value })} placeholder="예: 스팸 문자함을 확인하고, 대역폭 차단 여부를..." />
                </div>
                <div className="form-actions mt-4 flex justify-end gap-2">
                  <button type="submit" className="primary-btn w-auto px-10">사례 저장</button>
                  <button type="button" className="cancel-btn" onClick={() => setShowIssueForm(false)}>취소</button>
                </div>
              </form>
            )}
            <div className="issue-list mt-6 grid gap-4">
              {issueDefs.length > 0 ? issueDefs.map(issue => (
                <div key={issue.id} className="issue-card border p-4 rounded-lg bg-gray-50">
                  <div className="flex justify-between items-start">
                    <h4 className="issue-inquiry font-bold text-lg">Q: {String(issue.inquiry || '')}</h4>
                    <div className="actions flex gap-2">
                      <button className="small-edit-btn" onClick={() => { setEditingIssue(issue); setShowIssueForm(true); }}>수정</button>
                      <button className="small-del-btn" onClick={() => deleteIssue(issue.id)}>삭제</button>
                    </div>
                  </div>
                  <div className="issue-answer mt-2 p-3 bg-white rounded border text-gray-700" style={{ whiteSpace: 'pre-wrap' }}>
                    <strong>A:</strong> {String(issue.answer || '')}
                  </div>
                  <div className="meta mt-2 text-xs text-gray-400">등록일: {new Date(issue.timestamp).toLocaleString()}</div>
                </div>
              )) : <div className="text-center py-10 text-gray-400">등록된 해결 사례가 없습니다.</div>}
            </div>
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="guide-view animate-fade">
            <div className="card shadow-sm mb-6 bg-blue-50 border-blue-200">
              <h2 className="section-title-lg">휴대폰 본인확인 통합 매뉴얼</h2>
              <p className="text-gray-700 leading-relaxed">
                시스템 설계 및 연동 시 다음의 공식 가이드를 참조하십시오. 
                각 버튼 클릭 시 상세 매뉴얼이 새 창으로 열립니다.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <a 
                href="https://manager.mobile-ok.com/guide/mok_std_guide/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="guide-link-card card shadow-sm hover-effect"
              >
                <div className="guide-icon">📋</div>
                <div className="guide-content">
                  <h3 className="res-title">표준창 가이드</h3>
                  <p className="text-sm text-gray-600 mt-2">
                    웹/모바일 표준창 연동 방식의 상세 인터페이스 및 화면 구성 가이드입니다.
                  </p>
                  <span className="link-badge mt-4">바로가기 →</span>
                </div>
              </a>

              <a 
                href="https://manager.mobile-ok.com/guide/mok_api_guide/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="guide-link-card card shadow-sm hover-effect"
              >
                <div className="guide-icon">⚙️</div>
                <div className="guide-content">
                  <h3 className="res-title">API 가이드</h3>
                  <p className="text-sm text-gray-600 mt-2">
                    서버 간 통신(API)을 통한 본인확인 요청 및 결과 수신을 위한 기술 규격서입니다.
                  </p>
                  <span className="link-badge mt-4">바로가기 →</span>
                </div>
              </a>
            </div>
          </div>
        )}
      </main>

      <style>{`
        :root { --p-text: #172B4D; --s-text: #42526E; --accent: #0052CC; --bg: #F4F5F7; }
        .app-container { max-width: 1400px; margin: 0 auto; padding: 20px; color: var(--p-text); background: var(--bg); min-height: 100vh; font-family: 'Pretendard', -apple-system, sans-serif; }
        
        .main-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #EBECF0; padding-bottom: 15px; margin-bottom: 30px; }
        .logo h1 { margin: 0; color: var(--accent); font-size: 1.8rem; font-weight: 800; }
        .sub-logo-text { margin: 5px 0 0 0; font-size: 0.9rem; color: var(--s-text); }
        .v-tag { font-size: 0.7rem; background: var(--accent); color: #fff; padding: 2px 10px; border-radius: 20px; margin-left: 8px; vertical-align: middle; }
        
        .main-nav button { background: none; border: none; padding: 10px 15px; font-weight: 700; cursor: pointer; color: var(--s-text); border-bottom: 3px solid transparent; font-size: 0.95rem; }
        .main-nav button.active { color: var(--accent); border-bottom-color: var(--accent); }

        .card { background: #fff; padding: 25px; border-radius: 12px; border: 1px solid #EBECF0; color: var(--p-text); }
        .shadow-sm { box-shadow: 0 4px 12px rgba(9, 30, 66, 0.08); }
        .section-title-lg { font-size: 1.3rem; font-weight: 800; color: var(--p-text); margin-bottom: 15px; }
        .mb-0 { margin-bottom: 0 !important; }

        textarea, input { 
          width: 100%; border: 2px solid #DFE1E6; border-radius: 6px; padding: 10px; margin-top: 5px; 
          background: #fff; color: var(--p-text) !important; font-size: 0.9rem; box-sizing: border-box; 
        }
        textarea { height: 100px; resize: vertical; }
        label { font-weight: 700; color: var(--s-text); font-size: 0.85rem; }

        .primary-btn { background: var(--accent); color: #fff; border: none; padding: 10px 18px; border-radius: 6px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: 0.2s; }
        .primary-btn:hover { background: #0047B3; }
        .secondary-btn { background: #EBECF0; color: var(--s-text); border: none; padding: 10px 18px; border-radius: 6px; font-weight: 700; cursor: pointer; }
        .add-btn { background: var(--accent); color: #fff; border: none; padding: 10px 18px; border-radius: 6px; font-weight: 700; cursor: pointer; }
        .cancel-btn { background: #F4F5F7; color: var(--s-text); border: none; padding: 10px 18px; border-radius: 6px; font-weight: 700; cursor: pointer; }

        .action-group { display: flex; gap: 12px; margin-left: auto; }

        .analyzer-layout { display: grid; grid-template-columns: 360px 1fr; gap: 30px; }
        .loading-state { text-align: center; padding: 100px 0; color: var(--s-text); }
        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid var(--accent); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .res-title { font-size: 1.1rem; font-weight: 800; color: var(--p-text); border-left: 5px solid var(--accent); padding-left: 15px; margin-bottom: 15px; }
        .summary-text { font-size: 1rem; line-height: 1.6; background: #FBFBFC; padding: 20px; border-radius: 8px; border: 1px solid #EBECF0; color: var(--p-text); }
        
        .def-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .def-table th { text-align: left; padding: 12px 15px; background: #FBFBFC; border-bottom: 2px solid #EBECF0; font-weight: 800; font-size: 0.85rem; color: var(--s-text); }
        .def-table td { padding: 12px 15px; border-bottom: 1px solid #EBECF0; vertical-align: middle; word-break: break-all; }
        
        .code-cell { color: var(--accent); font-weight: 800; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; }
        .data-text { color: var(--p-text) !important; font-size: 0.85rem; line-height: 1.5; }
        .msg-text { color: #006644 !important; font-weight: 500; }

        .edit-btn-small { background: #EAE6FF; color: #403294; border: none; padding: 5px 12px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; cursor: pointer; }
        .del-btn-small { background: #FFEBE6; color: #BF2600; border: none; padding: 5px 12px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; cursor: pointer; }
        .small-edit-btn, .small-del-btn { background: #fff; border: 1px solid #DFE1E6; padding: 4px 10px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; cursor: pointer; }

        .pagination { display: flex; justify-content: center; align-items: center; gap: 10px; }
        .page-btn { background: #fff; border: 1px solid #DFE1E6; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: var(--s-text); }
        .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .page-num-btn { background: #fff; border: 1px solid #DFE1E6; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-size: 0.8rem; font-weight: 700; color: var(--s-text); cursor: pointer; }
        .page-num-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }

        .animate-fade { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        
        .history-list li { padding: 10px; border-bottom: 1px solid #EBECF0; cursor: pointer; }
        .h-input { font-weight: 600; color: var(--p-text); font-size: 0.85rem; display: block; }
        .h-date { font-size: 0.7rem; color: var(--s-text); }

        .guide-link-card { display: flex; align-items: center; gap: 20px; text-decoration: none; transition: 0.2s; cursor: pointer; }
        .guide-link-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(9, 30, 66, 0.12); border-color: var(--accent); }
        .guide-icon { font-size: 2rem; background: #F4F5F7; padding: 15px; border-radius: 12px; }
        .link-badge { display: inline-block; padding: 4px 12px; background: #EAE6FF; color: #403294; border-radius: 4px; font-size: 0.75rem; font-weight: 700; }
        
        .border-accent { border-color: var(--accent) !important; }
        .grid { display: grid; }
        .flex { display: flex; }
        .justify-end { justify-content: flex-end; }
        .justify-center { justify-content: center; }
        .items-center { align-items: center; }
        .gap-2 { gap: 0.5rem; }
        .w-auto { width: auto; }
        .px-10 { padding-left: 2.5rem; padding-right: 2.5rem; }

        .markdown-body ul { padding-left: 1.2rem; margin: 0.5rem 0; }
        .markdown-body li { margin-bottom: 0.2rem; }
      `}</style>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
