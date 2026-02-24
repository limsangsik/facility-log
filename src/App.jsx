import { useState, useEffect } from "react";

const WRITERS = ["임상식", "김병삼", "한승조", "김동철"];
const JOBS = ["전기", "소방", "기계/공조", "냉난방", "급배수", "승강기", "통신", "보안/경비", "기타"];

function today() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(d) {
  return d ? d.replace(/-/g, ".") : "";
}
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function nowTimeParts() {
  const d = new Date();
  const h = d.getHours();
  const rawMin = d.getMinutes();
  const min = String(Math.floor(rawMin / 10) * 10).padStart(2, "0");
  const ampm = h < 12 ? "오전" : "오후";
  let hour = h % 12; if (hour === 0) hour = 12;
  return { ampm, hour: String(hour).padStart(2, "0"), min };
}
function buildTime(ampm, hour, min) {
  let h = parseInt(hour, 10);
  if (ampm === "오전") { if (h === 12) h = 0; }
  else { if (h !== 12) h += 12; }
  return `${String(h).padStart(2, "0")}:${min}`;
}
function fmtTimeDisplay(item) {
  if (item.ampm) return `${item.ampm} ${parseInt(item.hour, 10)}:${item.min}`;
  if (item.time) {
    const [h, m] = item.time.split(":");
    const hNum = parseInt(h, 10);
    const ap = hNum < 12 ? "오전" : "오후";
    let hr = hNum % 12; if (hr === 0) hr = 12;
    return `${ap} ${hr}:${m}`;
  }
  return "";
}

const URGENCY_META = {
  일반: { color: "#3b82f6", bg: "#eff6ff" },
  주의: { color: "#f59e0b", bg: "#fffbeb" },
  긴급: { color: "#ef4444", bg: "#fef2f2" },
};

const STATUS_META = {
  완료: { color: "#10b981", bg: "#ecfdf5" },
  진행중: { color: "#3b82f6", bg: "#eff6ff" },
  미결: { color: "#ef4444", bg: "#fef2f2" },
};

const defaultWorkItem = () => { const { ampm, hour, min } = nowTimeParts(); return { id: genId(), ampm, hour, min, content: "" }; };

const defaultForm = () => ({
  date: today(),
  job: "",
  writer: "",
  workItems: [defaultWorkItem()],
  hasIssue: false,
  issue: "",
  action: "",
  status: "완료",
  urgency: "일반",
  needReport: false,
});

export default function App() {
  const [tab, setTab] = useState("write");
  const [logs, setLogs] = useState([]);
  const [storageReady, setStorageReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | saving | saved | error
  const [form, setForm] = useState(defaultForm());
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [filterDate, setFilterDate] = useState(today());
  const [filterJob, setFilterJob] = useState("전체");
  const [filterWriter, setFilterWriter] = useState("전체");
  const [modal, setModal] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editSaved, setEditSaved] = useState(false);

  // 최초 로딩: window.storage에서 공유 데이터 읽기
  useEffect(() => {
    async function loadLogs() {
      try {
        const result = await window.storage.get("facility_logs", true);
        const data = result ? JSON.parse(result.value) : [];
        setLogs(data);
      } catch {
        setLogs([]);
      } finally {
        setStorageReady(true);
      }
    }
    loadLogs();
  }, []);

  // 주기적 polling: 10초마다 다른 사용자 변경사항 반영
  useEffect(() => {
    if (!storageReady) return;
    const interval = setInterval(async () => {
      try {
        const result = await window.storage.get("facility_logs", true);
        const remote = result ? JSON.parse(result.value) : [];
        setLogs(remote);
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [storageReady]);

  // logs 변경 시 window.storage에 공유 저장
  useEffect(() => {
    if (!storageReady) return;
    async function saveLogs() {
      setSyncStatus("saving");
      try {
        await window.storage.set("facility_logs", JSON.stringify(logs), true);
        setSyncStatus("saved");
        setTimeout(() => setSyncStatus("idle"), 1500);
      } catch {
        setSyncStatus("error");
      }
    }
    saveLogs();
  }, [logs, storageReady]);

  function validate() {
    const e = {};
    if (!form.date) e.date = true;
    if (!form.job) e.job = true;
    if (!form.writer) e.writer = true;
    if (!form.workItems.some(w => w.content.trim())) e.work = true;
    if (form.hasIssue && !form.issue.trim()) e.issue = true;
    return e;
  }

  function handleSubmit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const cleanedItems = form.workItems.filter(w => w.content.trim());
    const newLog = { id: genId(), createdAt: new Date().toISOString(), ...form, workItems: cleanedItems };
    setLogs(prev => [newLog, ...prev]);
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setForm(defaultForm()); setErrors({}); }, 2500);
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  // 수정 모달 열기
  function openModal(log) {
    setModal(log);
    setEditMode(false);
    setEditForm(JSON.parse(JSON.stringify(log)));
    setEditSaved(false);
  }
  function closeModal() {
    setModal(null);
    setEditMode(false);
    setEditForm(null);
    setEditSaved(false);
  }
  function setE(k, v) { setEditForm(f => ({ ...f, [k]: v })); }
  function updateEditWorkItem(id, field, value) {
    setEditForm(f => ({ ...f, workItems: f.workItems.map(w => w.id === id ? { ...w, [field]: value } : w) }));
  }
  function addEditWorkItem() {
    setEditForm(f => ({ ...f, workItems: [...f.workItems, defaultWorkItem()] }));
  }
  function removeEditWorkItem(id) {
    setEditForm(f => ({ ...f, workItems: f.workItems.length > 1 ? f.workItems.filter(w => w.id !== id) : f.workItems }));
  }
  function handleSaveEdit() {
    if (!editForm.job || !editForm.writer || !editForm.workItems.some(w => w.content.trim())) return;
    const cleaned = { ...editForm, workItems: editForm.workItems.filter(w => w.content.trim()), updatedAt: new Date().toISOString() };
    setLogs(prev => prev.map(l => l.id === cleaned.id ? cleaned : l));
    setModal(cleaned);
    setEditMode(false);
    setEditSaved(true);
    setTimeout(() => setEditSaved(false), 2000);
  }
  function handleDeleteLog(id) {
    if (!window.confirm("이 일지를 삭제하시겠습니까?")) return;
    setLogs(prev => prev.filter(l => l.id !== id));
    closeModal();
  }

  function updateWorkItem(id, field, value) {
    setForm(f => ({ ...f, workItems: f.workItems.map(w => w.id === id ? { ...w, [field]: value } : w) }));
  }
  function addWorkItem() {
    setForm(f => ({ ...f, workItems: [...f.workItems, defaultWorkItem()] }));
  }
  function removeWorkItem(id) {
    setForm(f => ({ ...f, workItems: f.workItems.length > 1 ? f.workItems.filter(w => w.id !== id) : f.workItems }));
  }

  const filtered = logs.filter(l => {
    const dateOk = !filterDate || l.date === filterDate;
    const jobOk = filterJob === "전체" || l.job === filterJob;
    const writerOk = filterWriter === "전체" || l.writer === filterWriter;
    return dateOk && jobOk && writerOk;
  });

  const todayLogs = logs.filter(l => l.date === today());
  const submittedWriters = new Set(todayLogs.map(l => l.writer));
  const pendingCount = logs.filter(l => l.hasIssue && l.status === "미결").length;
  const urgentCount = logs.filter(l => l.hasIssue && l.urgency === "긴급").length;
  const recentIssues = logs.filter(l => l.hasIssue).slice(0, 5);
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekIssues = logs.filter(l => l.hasIssue && new Date(l.date) >= weekAgo).length;

  const tabStyle = (t) => ({
    padding: "10px 18px",
    background: tab === t ? "#1e293b" : "transparent",
    color: tab === t ? "#f8fafc" : "#64748b",
    border: "none", borderRadius: "8px", cursor: "pointer",
    fontFamily: "inherit", fontSize: "13px",
    fontWeight: tab === t ? "700" : "500",
    transition: "all .2s", letterSpacing: "0.02em", whiteSpace: "nowrap",
  });

  const inputStyle = (err) => ({
    width: "100%", padding: "10px 12px", borderRadius: "8px",
    border: `1.5px solid ${err ? "#ef4444" : "#e2e8f0"}`,
    fontFamily: "inherit", fontSize: "14px", color: "#1e293b",
    background: "#f8fafc", outline: "none", boxSizing: "border-box",
  });

  const selectStyle = (err) => ({
    ...inputStyle(err), cursor: "pointer", appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: "36px",
  });

  const labelStyle = { fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "6px", display: "block", letterSpacing: "0.03em" };
  const fieldStyle = { marginBottom: "18px" };

  if (!storageReady) return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "16px" }}>⏳</div>
        <div style={{ fontSize: "15px", fontWeight: "700", color: "#475569" }}>데이터 불러오는 중...</div>
        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px" }}>공유 저장소에서 일지를 가져오고 있습니다</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#0f172a", color: "#f8fafc", padding: "0 20px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 0 14px" }}>
          <div>
            <div style={{ fontSize: "10px", letterSpacing: "0.18em", color: "#94a3b8", fontWeight: "700", marginBottom: "4px" }}>FACILITY MANAGEMENT</div>
            <div style={{ fontSize: "20px", fontWeight: "800", letterSpacing: "-0.02em" }}>일일 근무일지</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>{fmtDate(today())}</div>
            <div style={{ marginTop: "4px", display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
              {syncStatus === "saving" && <span style={{ fontSize: "11px", color: "#94a3b8" }}>⏳ 저장 중...</span>}
              {syncStatus === "saved" && <span style={{ fontSize: "11px", color: "#10b981", fontWeight:"700" }}>✓ 저장됨</span>}
              {syncStatus === "error" && <span style={{ fontSize: "11px", color: "#ef4444", fontWeight:"700" }}>⚠ 저장 실패</span>}
              {pendingCount > 0 && (
                <div style={{ background: "#ef4444", color: "#fff", borderRadius: "20px", padding: "2px 10px", fontSize: "11px", fontWeight: "700" }}>미결 {pendingCount}건</div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "4px", overflowX: "auto" }}>
          {[["write","✏️ 일지 작성"],["list","📋 일지 목록"],["summary","📊 현황 요약"]].map(([t, l]) => (
            <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "28px 16px" }}>

        {/* ── 작성 탭 ── */}
        {tab === "write" && (
          <div style={{ background: "#fff", borderRadius: "16px", padding: "28px", boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
            <div style={{ fontSize: "17px", fontWeight: "800", color: "#0f172a", marginBottom: "24px" }}>근무일지 작성</div>

            {submitted && (
              <div style={{ background: "#ecfdf5", border: "1.5px solid #10b981", borderRadius: "10px", padding: "14px 18px", color: "#065f46", fontWeight: "700", marginBottom: "20px", fontSize: "14px" }}>
                ✅ 일지가 정상적으로 제출되었습니다.
              </div>
            )}

            {/* 작성일자 + 작성자 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>작성일자</label>
                <input type="date" value={form.date} onChange={e => set("date", e.target.value)} style={inputStyle(errors.date)} />
                {errors.date && <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>날짜를 선택해주세요</div>}
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>작성자</label>
                <select value={form.writer} onChange={e => set("writer", e.target.value)} style={selectStyle(errors.writer)}>
                  <option value="">선택하세요</option>
                  {WRITERS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
                {errors.writer && <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>작성자를 선택해주세요</div>}
              </div>
            </div>

            {/* 직무 선택 드롭다운 */}
            <div style={fieldStyle}>
              <label style={labelStyle}>직무 선택</label>
              <select value={form.job} onChange={e => set("job", e.target.value)} style={selectStyle(errors.job)}>
                <option value="">직무를 선택하세요</option>
                {JOBS.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
              {errors.job && <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>직무를 선택해주세요</div>}
            </div>

            {/* 주요 업무 내용 - 시간 지정 */}
            <div style={fieldStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>주요 업무 내용</label>
                <button onClick={addWorkItem} style={{
                  padding: "5px 12px", background: "#f1f5f9", border: "1.5px solid #e2e8f0",
                  borderRadius: "6px", fontSize: "12px", fontWeight: "700", color: "#475569", cursor: "pointer",
                }}>+ 항목 추가</button>
              </div>
              {errors.work && <div style={{ color: "#ef4444", fontSize: "12px", marginBottom: "8px" }}>업무 내용을 최소 1건 입력해주세요</div>}

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {form.workItems.map((item, idx) => (
                  <div key={item.id} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <div style={{ minWidth: "20px", fontSize: "11px", fontWeight: "700", color: "#cbd5e1", textAlign: "center" }}>{idx + 1}</div>
                    {/* 오전/오후 */}
                    <select value={item.ampm || "오전"} onChange={e => updateWorkItem(item.id, "ampm", e.target.value)}
                      style={{ ...selectStyle(), width: "72px", minWidth: "72px", flexShrink: 0, padding: "10px 6px", paddingRight: "22px", backgroundPosition: "right 4px center" }}>
                      <option>오전</option><option>오후</option>
                    </select>
                    {/* 시 */}
                    <select value={item.hour || "09"} onChange={e => updateWorkItem(item.id, "hour", e.target.value)}
                      style={{ ...selectStyle(), width: "60px", minWidth: "60px", flexShrink: 0, padding: "10px 6px", paddingRight: "22px", backgroundPosition: "right 4px center" }}>
                      {Array.from({length:12},(_,i)=>String(i+1).padStart(2,"0")).map(h=><option key={h}>{h}</option>)}
                    </select>
                    {/* 분 */}
                    <select value={item.min || "00"} onChange={e => updateWorkItem(item.id, "min", e.target.value)}
                      style={{ ...selectStyle(), width: "60px", minWidth: "60px", flexShrink: 0, padding: "10px 6px", paddingRight: "22px", backgroundPosition: "right 4px center" }}>
                      {["00","10","20","30","40","50"].map(m=><option key={m}>{m}</option>)}
                    </select>
                    <input
                      placeholder={`업무 내용 ${idx + 1}`}
                      value={item.content}
                      onChange={e => updateWorkItem(item.id, "content", e.target.value)}
                      style={{ ...inputStyle(), flex: 1 }}
                    />
                    <button onClick={() => removeWorkItem(item.id)} disabled={form.workItems.length === 1} style={{
                      width: "36px", height: "40px", flexShrink: 0,
                      background: form.workItems.length === 1 ? "#f8fafc" : "#fef2f2",
                      border: `1.5px solid ${form.workItems.length === 1 ? "#e2e8f0" : "#fca5a5"}`,
                      borderRadius: "8px", cursor: form.workItems.length === 1 ? "not-allowed" : "pointer",
                      color: form.workItems.length === 1 ? "#cbd5e1" : "#ef4444",
                      fontSize: "18px", fontWeight: "700", lineHeight: 1,
                    }}>×</button>
                  </div>
                ))}
              </div>
            </div>

            {/* 특이사항 */}
            <div style={{ marginBottom: "18px", background: "#f8fafc", borderRadius: "12px", padding: "16px 18px", border: "1.5px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#475569" }}>특이사항 발생 여부</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {["없음","있음"].map(v => (
                    <button key={v} onClick={() => set("hasIssue", v === "있음")} style={{
                      padding: "6px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
                      border: `1.5px solid ${(form.hasIssue ? "있음" : "없음") === v ? "#0f172a" : "#e2e8f0"}`,
                      background: (form.hasIssue ? "있음" : "없음") === v ? "#0f172a" : "#fff",
                      color: (form.hasIssue ? "있음" : "없음") === v ? "#fff" : "#94a3b8",
                    }}>{v}</button>
                  ))}
                </div>
              </div>

              {form.hasIssue && (
                <div style={{ marginTop: "16px", borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>특이사항 내용</label>
                    <textarea rows={2} placeholder="발생한 특이사항을 상세히 입력하세요" value={form.issue}
                      onChange={e => set("issue", e.target.value)}
                      style={{ ...inputStyle(errors.issue), resize: "vertical", lineHeight: "1.6" }} />
                    {errors.issue && <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>특이사항 내용을 입력해주세요</div>}
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>조치 내용</label>
                    <textarea rows={2} placeholder="취한 조치 사항을 입력하세요" value={form.action}
                      onChange={e => set("action", e.target.value)}
                      style={{ ...inputStyle(), resize: "vertical", lineHeight: "1.6" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={labelStyle}>처리 상태</label>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {["완료","진행중","미결"].map(s => (
                          <button key={s} onClick={() => set("status", s)} style={{
                            flex: 1, padding: "7px 4px", borderRadius: "7px", fontSize: "12px", fontWeight: "700", cursor: "pointer",
                            border: `1.5px solid ${form.status === s ? STATUS_META[s].color : "#e2e8f0"}`,
                            background: form.status === s ? STATUS_META[s].bg : "#fff",
                            color: form.status === s ? STATUS_META[s].color : "#94a3b8",
                          }}>{s}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>긴급도</label>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {["일반","주의","긴급"].map(u => (
                          <button key={u} onClick={() => set("urgency", u)} style={{
                            flex: 1, padding: "7px 4px", borderRadius: "7px", fontSize: "12px", fontWeight: "700", cursor: "pointer",
                            border: `1.5px solid ${form.urgency === u ? URGENCY_META[u].color : "#e2e8f0"}`,
                            background: form.urgency === u ? URGENCY_META[u].bg : "#fff",
                            color: form.urgency === u ? URGENCY_META[u].color : "#94a3b8",
                          }}>{u}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 상위 보고 */}
            <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px" }}>
              <input type="checkbox" id="needReport" checked={form.needReport} onChange={e => set("needReport", e.target.checked)} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
              <label htmlFor="needReport" style={{ fontSize: "13px", fontWeight: "600", color: "#475569", cursor: "pointer" }}>상위 보고 필요</label>
            </div>

            <button onClick={handleSubmit} style={{
              width: "100%", padding: "14px", background: "#0f172a", color: "#fff", border: "none",
              borderRadius: "10px", fontSize: "15px", fontWeight: "800", cursor: "pointer", letterSpacing: "0.02em",
            }}>일지 제출</button>
          </div>
        )}

        {/* ── 목록 탭 ── */}
        {tab === "list" && (
          <div>
            <div style={{ background: "#fff", borderRadius: "16px", padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,.07)", marginBottom: "16px" }}>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
                <div>
                  <label style={{ ...labelStyle, marginBottom: "4px" }}>날짜</label>
                  <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ ...inputStyle(), width: "auto" }} />
                </div>
                <div>
                  <label style={{ ...labelStyle, marginBottom: "4px" }}>직무</label>
                  <select value={filterJob} onChange={e => setFilterJob(e.target.value)} style={{ ...selectStyle(), width: "auto", minWidth: "110px" }}>
                    <option>전체</option>
                    {JOBS.map(j => <option key={j}>{j}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ ...labelStyle, marginBottom: "4px" }}>작성자</label>
                  <select value={filterWriter} onChange={e => setFilterWriter(e.target.value)} style={{ ...selectStyle(), width: "auto", minWidth: "100px" }}>
                    <option>전체</option>
                    {WRITERS.map(w => <option key={w}>{w}</option>)}
                  </select>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <span style={{ fontSize: "13px", color: "#64748b" }}>총 <strong style={{ color: "#0f172a" }}>{filtered.length}</strong>건</span>
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8", fontSize: "14px" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>📄</div>해당 조건의 일지가 없습니다
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {filtered.map(log => (
                  <div key={log.id} onClick={() => openModal(log)} style={{
                    background: log.hasIssue ? URGENCY_META[log.urgency]?.bg || "#fff" : "#fff",
                    borderRadius: "12px", padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,.06)",
                    cursor: "pointer", border: `1.5px solid ${log.hasIssue ? URGENCY_META[log.urgency]?.color + "44" : "#e2e8f0"}`,
                    transition: "transform .15s, box-shadow .15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,.1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.06)"; }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", background: "#0f172a", color: "#fff", borderRadius: "6px", padding: "3px 8px" }}>{log.job}</span>
                        <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>{log.writer}</span>
                        <span style={{ fontSize: "12px", color: "#94a3b8" }}>{fmtDate(log.date)}</span>
                      </div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0, marginLeft: "8px" }}>
                        {log.hasIssue && (
                          <>
                            <span style={{ fontSize: "11px", fontWeight: "700", color: URGENCY_META[log.urgency].color, background: URGENCY_META[log.urgency].bg, border: `1px solid ${URGENCY_META[log.urgency].color}`, borderRadius: "4px", padding: "2px 7px" }}>{log.urgency}</span>
                            <span style={{ fontSize: "11px", fontWeight: "700", color: STATUS_META[log.status].color, background: STATUS_META[log.status].bg, border: `1px solid ${STATUS_META[log.status].color}`, borderRadius: "4px", padding: "2px 7px" }}>{log.status}</span>
                          </>
                        )}
                        {log.needReport && <span style={{ fontSize: "11px", fontWeight: "700", color: "#7c3aed", background: "#f5f3ff", border: "1px solid #7c3aed", borderRadius: "4px", padding: "2px 7px" }}>보고필요</span>}
                      </div>
                    </div>
                    <div style={{ marginTop: "10px" }}>
                      {log.workItems && log.workItems.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          {log.workItems.slice(0, 2).map((w, i) => (
                            <div key={w.id || i} style={{ display: "flex", gap: "8px", fontSize: "13px", color: "#475569" }}>
                              <span style={{ fontSize: "12px", fontWeight: "700", color: "#3b82f6", minWidth: "60px" }}>{fmtTimeDisplay(w)}</span>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.content}</span>
                            </div>
                          ))}
                          {log.workItems.length > 2 && <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>외 {log.workItems.length - 2}건 →</div>}
                        </div>
                      ) : null}
                    </div>
                    {log.hasIssue && <div style={{ marginTop: "6px", fontSize: "12px", color: "#ef4444", fontWeight: "600" }}>⚠️ {log.issue}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 현황 요약 탭 ── */}
        {tab === "summary" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
              {[
                { label: "이번 주 특이사항", value: weekIssues, color: "#3b82f6", icon: "📋" },
                { label: "미결 건수", value: pendingCount, color: "#ef4444", icon: "🔴" },
                { label: "긴급 건수", value: urgentCount, color: "#f59e0b", icon: "⚡" },
              ].map(card => (
                <div key={card.label} style={{ background: "#fff", borderRadius: "14px", padding: "18px 16px", boxShadow: "0 1px 4px rgba(0,0,0,.07)", textAlign: "center" }}>
                  <div style={{ fontSize: "24px", marginBottom: "6px" }}>{card.icon}</div>
                  <div style={{ fontSize: "28px", fontWeight: "800", color: card.color }}>{card.value}</div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600", marginTop: "4px" }}>{card.label}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,.07)", marginBottom: "16px" }}>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginBottom: "16px" }}>오늘 담당자별 제출 현황</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {WRITERS.map(w => {
                  const done = submittedWriters.has(w);
                  return (
                    <div key={w} style={{
                      padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: "600",
                      background: done ? "#ecfdf5" : "#f8fafc",
                      color: done ? "#065f46" : "#94a3b8",
                      border: `1.5px solid ${done ? "#10b981" : "#e2e8f0"}`,
                    }}>
                      {done ? "✓ " : ""}{w}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginBottom: "16px" }}>최근 특이사항 (5건)</div>
              {recentIssues.length === 0 ? (
                <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "13px", padding: "20px 0" }}>특이사항 없음</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {recentIssues.map(log => (
                    <div key={log.id} onClick={() => openModal(log)} style={{ padding: "12px 14px", borderRadius: "10px", background: URGENCY_META[log.urgency].bg, border: `1px solid ${URGENCY_META[log.urgency].color}33`, cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a" }}>{log.job} · {log.writer}</span>
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>{fmtDate(log.date)}</span>
                      </div>
                      <div style={{ fontSize: "13px", color: "#475569" }}>{log.issue}</div>
                      <div style={{ marginTop: "6px", display: "flex", gap: "6px" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: URGENCY_META[log.urgency].color }}>{log.urgency}</span>
                        <span style={{ fontSize: "11px", color: STATUS_META[log.status].color, fontWeight: "700" }}>· {log.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 상세/수정 모달 ── */}
      {modal && editForm && (
        <div onClick={closeModal} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px", padding: "28px", maxWidth: "560px", width: "100%", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>

            {/* 모달 헤더 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "17px", fontWeight: "800", color: "#0f172a", letterSpacing: "-0.01em" }}>
                {editMode ? "✏️ 일지 수정" : "근무일지 상세"}
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {!editMode && (
                  <>
                    <button onClick={() => setEditMode(true)} style={{ padding: "7px 14px", background: "#f1f5f9", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "13px", fontWeight: "700", color: "#475569", cursor: "pointer" }}>✏️ 수정</button>
                    <button onClick={() => handleDeleteLog(modal.id)} style={{ padding: "7px 14px", background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: "8px", fontSize: "13px", fontWeight: "700", color: "#ef4444", cursor: "pointer" }}>🗑 삭제</button>
                  </>
                )}
                <button onClick={closeModal} style={{ background: "#f1f5f9", border: "none", borderRadius: "8px", width: "32px", height: "32px", cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
            </div>

            {editSaved && (
              <div style={{ background: "#ecfdf5", border: "1.5px solid #10b981", borderRadius: "10px", padding: "12px 16px", color: "#065f46", fontWeight: "700", marginBottom: "16px", fontSize: "13px" }}>
                ✅ 수정사항이 저장되었습니다.
              </div>
            )}

            {/* ── 조회 모드 ── */}
            {!editMode && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  {[["작성일자", fmtDate(modal.date)], ["작성자", modal.writer], ["직무", modal.job]].map(([k, v]) => (
                    <div key={k} style={{ background: "#f8fafc", borderRadius: "8px", padding: "10px 12px" }}>
                      <div style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", marginBottom: "3px" }}>{k}</div>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "#1e293b" }}>{v}</div>
                    </div>
                  ))}
                  {modal.needReport && (
                    <div style={{ background: "#f5f3ff", borderRadius: "8px", padding: "10px 12px", border: "1px solid #7c3aed" }}>
                      <div style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", marginBottom: "3px" }}>보고</div>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "#7c3aed" }}>📌 상위 보고 필요</div>
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", letterSpacing: "0.08em", marginBottom: "8px" }}>주요 업무 내용</div>
                  {modal.workItems && modal.workItems.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {modal.workItems.map((w, i) => (
                        <div key={w.id || i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "9px 12px", background: "#f8fafc", borderRadius: "8px" }}>
                          <span style={{ fontSize: "13px", fontWeight: "700", color: "#3b82f6", minWidth: "64px", marginTop: "1px" }}>{fmtTimeDisplay(w)}</span>
                          <span style={{ fontSize: "14px", color: "#1e293b", lineHeight: "1.5" }}>{w.content}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: "14px", color: "#1e293b", lineHeight: "1.6" }}>{modal.work}</div>
                  )}
                </div>
                {modal.hasIssue && (
                  <div style={{ background: URGENCY_META[modal.urgency].bg, borderRadius: "12px", padding: "16px", border: `1.5px solid ${URGENCY_META[modal.urgency].color}44` }}>
                    <div style={{ fontSize: "12px", fontWeight: "800", color: URGENCY_META[modal.urgency].color, marginBottom: "10px" }}>⚠️ 특이사항</div>
                    <div style={{ fontSize: "13px", color: "#1e293b", lineHeight: "1.6", marginBottom: "10px" }}>{modal.issue}</div>
                    {modal.action && <>
                      <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", marginBottom: "4px" }}>조치 내용</div>
                      <div style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6", marginBottom: "10px" }}>{modal.action}</div>
                    </>}
                    <div style={{ display: "flex", gap: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: URGENCY_META[modal.urgency].color, background: "#fff", borderRadius: "6px", padding: "3px 10px", border: `1px solid ${URGENCY_META[modal.urgency].color}` }}>{modal.urgency}</span>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: STATUS_META[modal.status].color, background: "#fff", borderRadius: "6px", padding: "3px 10px", border: `1px solid ${STATUS_META[modal.status].color}` }}>{modal.status}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── 수정 모드 ── */}
            {editMode && (
              <>
                {/* 작성일자 + 작성자 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px", marginBottom: "16px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "5px", display: "block" }}>작성일자</label>
                    <input type="date" value={editForm.date} onChange={e => setE("date", e.target.value)}
                      style={{ width: "100%", padding: "9px 11px", borderRadius: "8px", border: "1.5px solid #e2e8f0", fontFamily: "inherit", fontSize: "13px", color: "#1e293b", background: "#f8fafc", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "5px", display: "block" }}>작성자</label>
                    <select value={editForm.writer} onChange={e => setE("writer", e.target.value)}
                      style={{ width: "100%", padding: "9px 11px", borderRadius: "8px", border: "1.5px solid #e2e8f0", fontFamily: "inherit", fontSize: "13px", color: "#1e293b", background: "#f8fafc", outline: "none", boxSizing: "border-box", cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: "30px" }}>
                      {WRITERS.map(w => <option key={w}>{w}</option>)}
                    </select>
                  </div>
                </div>

                {/* 직무 */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "5px", display: "block" }}>직무</label>
                  <select value={editForm.job} onChange={e => setE("job", e.target.value)}
                    style={{ width: "100%", padding: "9px 11px", borderRadius: "8px", border: "1.5px solid #e2e8f0", fontFamily: "inherit", fontSize: "13px", color: "#1e293b", background: "#f8fafc", outline: "none", boxSizing: "border-box", cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: "30px" }}>
                    {JOBS.map(j => <option key={j}>{j}</option>)}
                  </select>
                </div>

                {/* 업무 내용 */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>주요 업무 내용</label>
                    <button onClick={addEditWorkItem} style={{ padding: "4px 10px", background: "#f1f5f9", border: "1.5px solid #e2e8f0", borderRadius: "6px", fontSize: "12px", fontWeight: "700", color: "#475569", cursor: "pointer" }}>+ 추가</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                    {editForm.workItems.map((item, idx) => (
                      <div key={item.id} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <div style={{ minWidth: "18px", fontSize: "11px", fontWeight: "700", color: "#cbd5e1", textAlign: "center" }}>{idx + 1}</div>
                        <select value={item.ampm || "오전"} onChange={e => updateEditWorkItem(item.id, "ampm", e.target.value)}
                          style={{ width: "68px", minWidth: "68px", padding: "8px 4px", paddingRight: "18px", borderRadius: "7px", border: "1.5px solid #e2e8f0", fontFamily: "inherit", fontSize: "13px", color: "#1e293b", background: "#f8fafc", outline: "none", cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 3px center" }}>
                          <option>오전</option><option>오후</option>
                        </select>
                        <select value={item.hour || "09"} onChange={e => updateEditWorkItem(item.id, "hour", e.target.value)}
                          style={{ width: "56px", minWidth: "56px", padding: "8px 4px", paddingRight: "18px", borderRadius: "7px", border: "1.5px solid #e2e8f0", fontFamily: "inherit", fontSize: "13px", color: "#1e293b", background: "#f8fafc", outline: "none", cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 3px center" }}>
                          {Array.from({length:12},(_,i)=>String(i+1).padStart(2,"0")).map(h=><option key={h}>{h}</option>)}
                        </select>
                        <select value={item.min || "00"} onChange={e => updateEditWorkItem(item.id, "min", e.target.value)}
                          style={{ width: "56px", minWidth: "56px", padding: "8px 4px", paddingRight: "18px", borderRadius: "7px", border: "1.5px solid #e2e8f0", fontFamily: "inherit", fontSize: "13px", color: "#1e293b", background: "#f8fafc", outline: "none", cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 3px center" }}>
                          {["00","10","20","30","40","50"].map(m=><option key={m}>{m}</option>)}
                        </select>
                        <input placeholder={`업무 내용 ${idx+1}`} value={item.content} onChange={e => updateEditWorkItem(item.id, "content", e.target.value)}
                          style={{ flex: 1, padding: "8px 10px", borderRadius: "7px", border: "1.5px solid #e2e8f0", fontFamily: "inherit", fontSize: "13px", color: "#1e293b", background: "#f8fafc", outline: "none" }} />
                        <button onClick={() => removeEditWorkItem(item.id)} disabled={editForm.workItems.length === 1}
                          style={{ width: "32px", height: "36px", flexShrink: 0, background: editForm.workItems.length === 1 ? "#f8fafc" : "#fef2f2", border: `1.5px solid ${editForm.workItems.length === 1 ? "#e2e8f0" : "#fca5a5"}`, borderRadius: "7px", cursor: editForm.workItems.length === 1 ? "not-allowed" : "pointer", color: editForm.workItems.length === 1 ? "#cbd5e1" : "#ef4444", fontSize: "16px", fontWeight: "700" }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 특이사항 */}
                <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "14px 16px", border: "1.5px solid #e2e8f0", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editForm.hasIssue ? "14px" : "0" }}>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#475569" }}>특이사항 발생 여부</span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {["없음","있음"].map(v => (
                        <button key={v} onClick={() => setE("hasIssue", v === "있음")} style={{ padding: "5px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer", border: `1.5px solid ${(editForm.hasIssue ? "있음" : "없음") === v ? "#0f172a" : "#e2e8f0"}`, background: (editForm.hasIssue ? "있음" : "없음") === v ? "#0f172a" : "#fff", color: (editForm.hasIssue ? "있음" : "없음") === v ? "#fff" : "#94a3b8" }}>{v}</button>
                      ))}
                    </div>
                  </div>
                  {editForm.hasIssue && (
                    <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "14px" }}>
                      <div style={{ marginBottom: "10px" }}>
                        <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "5px", display: "block" }}>특이사항 내용</label>
                        <textarea rows={2} value={editForm.issue} onChange={e => setE("issue", e.target.value)}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1.5px solid #e2e8f0", fontFamily: "inherit", fontSize: "13px", color: "#1e293b", background: "#fff", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: "1.6" }} />
                      </div>
                      <div style={{ marginBottom: "12px" }}>
                        <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "5px", display: "block" }}>조치 내용</label>
                        <textarea rows={2} value={editForm.action} onChange={e => setE("action", e.target.value)}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1.5px solid #e2e8f0", fontFamily: "inherit", fontSize: "13px", color: "#1e293b", background: "#fff", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: "1.6" }} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div>
                          <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "5px", display: "block" }}>처리 상태</label>
                          <div style={{ display: "flex", gap: "5px" }}>
                            {["완료","진행중","미결"].map(s => (
                              <button key={s} onClick={() => setE("status", s)} style={{ flex: 1, padding: "6px 4px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", cursor: "pointer", border: `1.5px solid ${editForm.status === s ? STATUS_META[s].color : "#e2e8f0"}`, background: editForm.status === s ? STATUS_META[s].bg : "#fff", color: editForm.status === s ? STATUS_META[s].color : "#94a3b8" }}>{s}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "5px", display: "block" }}>긴급도</label>
                          <div style={{ display: "flex", gap: "5px" }}>
                            {["일반","주의","긴급"].map(u => (
                              <button key={u} onClick={() => setE("urgency", u)} style={{ flex: 1, padding: "6px 4px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", cursor: "pointer", border: `1.5px solid ${editForm.urgency === u ? URGENCY_META[u].color : "#e2e8f0"}`, background: editForm.urgency === u ? URGENCY_META[u].bg : "#fff", color: editForm.urgency === u ? URGENCY_META[u].color : "#94a3b8" }}>{u}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 상위 보고 */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
                  <input type="checkbox" id="editNeedReport" checked={editForm.needReport} onChange={e => setE("needReport", e.target.checked)} style={{ width: "15px", height: "15px", cursor: "pointer" }} />
                  <label htmlFor="editNeedReport" style={{ fontSize: "13px", fontWeight: "600", color: "#475569", cursor: "pointer" }}>상위 보고 필요</label>
                </div>

                {/* 저장/취소 버튼 */}
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => { setEditMode(false); setEditForm(JSON.parse(JSON.stringify(modal))); }} style={{ flex: 1, padding: "12px", background: "#f1f5f9", border: "1.5px solid #e2e8f0", borderRadius: "10px", fontSize: "14px", fontWeight: "700", color: "#475569", cursor: "pointer" }}>취소</button>
                  <button onClick={handleSaveEdit} style={{ flex: 2, padding: "12px", background: "#0f172a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "800", color: "#fff", cursor: "pointer" }}>저장</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
