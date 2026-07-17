import { createContext, useContext, useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { HashRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { AnswerValue, ExamPaper, ExamQuestion, FlatQuestion } from './types/exam'
import { examQuestionCount, flattenExam } from './types/exam'
import type { ErrorReason, ExamProgress, ExamResult } from './types/result'
import { parseExamJson, validateExam } from './lib/validation'
import { examStorage, STORAGE_VERSION } from './lib/storage'
import { isAnswerEmpty, scoreExam } from './lib/scoring'
import { formatDate, formatDuration, percent } from './lib/format'
import { downloadText, makeExport, type ExportFormat } from './lib/export'

type ExamContextValue = {
  exams: ExamPaper[]
  importedIds: Set<string>
  loading: boolean
  error: string
  importExam: (exam: ExamPaper) => { ok: true; replaced: boolean } | { ok: false; message: string }
  removeImported: (examId: string) => void
}

const ExamContext = createContext<ExamContextValue | null>(null)
const useExams = () => {
  const value = useContext(ExamContext)
  if (!value) throw new Error('ExamContext 未初始化')
  return value
}

const uniqueById = (exams: ExamPaper[]) => [...new Map(exams.map((exam) => [exam.examId, exam])).values()]

function ExamProvider({ children }: { children: ReactNode }) {
  const [builtIn, setBuiltIn] = useState<ExamPaper[]>([])
  const [imported, setImported] = useState(examStorage.getImported())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const indexResponse = await fetch(`${import.meta.env.BASE_URL}exams/index.json`)
        if (!indexResponse.ok) throw new Error('无法读取内置试卷索引')
        const files = await indexResponse.json() as string[]
        const papers = await Promise.all(files.map(async (file) => {
          const response = await fetch(`${import.meta.env.BASE_URL}exams/${file}`)
          if (!response.ok) throw new Error(`无法读取 ${file}`)
          const value: unknown = await response.json()
          const checked = validateExam(value)
          if (!checked.ok) throw new Error(`${file}：${checked.errors[0]}`)
          return checked.exam
        }))
        if (!cancelled) setBuiltIn(papers)
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : '内置试卷加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const importExam = (exam: ExamPaper) => {
    if (builtIn.some((item) => item.examId === exam.examId)) {
      return { ok: false as const, message: `试卷 ID“${exam.examId}”已被内置试卷使用，请修改 JSON 中的 examId 后再导入。` }
    }
    const replaced = imported.some((item) => item.examId === exam.examId)
    const next = [exam, ...imported.filter((item) => item.examId !== exam.examId)]
    if (!examStorage.saveImported(next)) {
      return { ok: false as const, message: '无法保存试卷到浏览器本地。请清理部分浏览器存储空间后重试。' }
    }
    setImported(next)
    return { ok: true as const, replaced }
  }
  const removeImported = (examId: string) => {
    const next = imported.filter((exam) => exam.examId !== examId)
    setImported(next)
    examStorage.saveImported(next)
  }
  const value = { exams: uniqueById([...imported, ...builtIn]), importedIds: new Set(imported.map((exam) => exam.examId)), loading, error, importExam, removeImported }
  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>
}

const findExam = (exams: ExamPaper[], id?: string) => exams.find((exam) => exam.examId === id)
const newProgress = (exam: ExamPaper, questionIds?: string[]): ExamProgress => ({
  examId: exam.examId,
  sessionId: `${exam.examId}-${Date.now()}`,
  currentIndex: 0,
  answers: {},
  marked: [],
  timeByQuestion: {},
  elapsedSeconds: 0,
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  questionIds,
})

function Shell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const inExam = location.pathname.startsWith('/exam/')
  if (inExam) return <>{children}</>
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link to="/" className="brand" aria-label="返回首页">
          <span className="brand-mark">研</span>
          <span><strong>AI考研</strong><small>轻量答题</small></span>
        </Link>
        <nav aria-label="主导航">
          <NavLink to="/">试卷</NavLink>
          <NavLink to="/import">导入</NavLink>
          <NavLink to="/history">成绩</NavLink>
          <NavLink to="/settings">设置</NavLink>
        </nav>
      </header>
      <main className="page">{children}</main>
      <footer className="footer">数据仅保存在当前浏览器 · 存储版本 v{STORAGE_VERSION}</footer>
    </div>
  )
}

function HomePage() {
  const { exams, loading, error } = useExams()
  const progresses = examStorage.getProgresses()
  const history = examStorage.getHistory()
  return (
    <>
      <section className="hero">
        <p className="eyebrow">155 天 · 湖南大学 MBA 备考实验</p>
        <h1>每一次作答，<br /><em>都留下可复盘的证据。</em></h1>
        <p>专注管理类联考与英语二。无账号、无云端，打开即可开始。</p>
      </section>
      <div className="section-heading">
        <div><p className="eyebrow">今日试卷</p><h2>选择一套开始</h2></div>
        <Link className="text-link" to="/import">＋ 导入 JSON</Link>
      </div>
      {loading && <EmptyState title="正在装订试卷…" text="首次加载只需要片刻。" />}
      {error && <div className="notice error">{error}。你仍可从“导入”页面添加本地试卷。</div>}
      <div className="exam-grid">
        {exams.map((exam, index) => {
          const progress = progresses[exam.examId]
          const attempts = history.filter((item) => item.examId === exam.examId)
          const count = examQuestionCount(exam)
          const answered = progress ? Object.values(progress.answers).filter((answer) => !isAnswerEmpty(answer)).length : 0
          return (
            <article className="exam-card" key={exam.examId} style={{ '--order': index } as React.CSSProperties}>
              <div className="card-topline"><span className="subject-tag">{exam.subject}</span><span>V{exam.version}</span></div>
              <h3>{exam.title}</h3>
              <p className="card-description">{exam.description}</p>
              <dl className="exam-meta">
                <div><dt>题目</dt><dd>{count} 题</dd></div>
                <div><dt>满分</dt><dd>{exam.totalScore} 分</dd></div>
                <div><dt>建议</dt><dd>{exam.durationMinutes} 分钟</dd></div>
              </dl>
              <div className="status-line">
                {progress ? <><span className="status-dot active" />已答 {answered}/{count}，可继续</> : attempts.length ? <><span className="status-dot done" />已完成 {attempts.length} 次</> : <><span className="status-dot" />尚未作答</>}
              </div>
              <Link className="button primary full" to={`/intro/${encodeURIComponent(exam.examId)}`}>{progress ? '继续考试' : '查看并开始'} <span>→</span></Link>
            </article>
          )
        })}
      </div>
      {!loading && !exams.length && <EmptyState title="还没有试卷" text="前往导入页选择一份符合格式的 JSON 试卷。" />}
    </>
  )
}

function ImportPage() {
  const { importExam, exams, importedIds, removeImported } = useExams()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.json')) {
      setMessage({ type: 'error', text: '请选择扩展名为 .json 的试卷文件。' })
      return
    }
    try {
      const result = parseExamJson(await file.text())
      if (!result.ok) setMessage({ type: 'error', text: result.errors.slice(0, 5).join('；') })
      else {
        const imported = importExam(result.exam)
        if (!imported.ok) setMessage({ type: 'error', text: imported.message })
        else setMessage({ type: 'success', text: `${imported.replaced ? '已更新' : '已导入'}《${result.exam.title}》，共 ${examQuestionCount(result.exam)} 题，满分 ${result.exam.totalScore} 分。` })
      }
    } catch {
      setMessage({ type: 'error', text: '读取文件失败，请确认文件未损坏且允许浏览器访问。' })
    } finally {
      event.target.value = ''
    }
  }
  return (
    <>
      <PageTitle eyebrow="试卷管理" title="导入新试卷" text="文件只在浏览器本地读取，不会上传到任何服务器。" />
      <label className="upload-zone">
        <span className="upload-icon">⇧</span>
        <strong>选择本地 JSON 文件</strong>
        <span>支持 ChatGPT 按项目格式生成的试卷</span>
        <input type="file" accept="application/json,.json" onChange={handleFile} />
      </label>
      {message && <div className={`notice ${message.type}`}>{message.text}</div>}
      <section className="info-panel">
        <h2>从 public/exams 读取</h2>
        <p>开发者可将试卷放入 <code>public/exams</code>，并把文件名加入该目录的 <code>index.json</code>。重新构建后会自动显示在首页。</p>
      </section>
      <section className="list-section">
        <div className="section-heading compact"><h2>浏览器本地试卷</h2><span>{importedIds.size} 份</span></div>
        {exams.filter((exam) => importedIds.has(exam.examId)).map((exam) => (
          <div className="row-card" key={exam.examId}>
            <div><strong>{exam.title}</strong><small>{exam.subject} · {examQuestionCount(exam)} 题 · {exam.totalScore} 分</small></div>
            <button className="button danger ghost" onClick={() => { if (confirm(`删除《${exam.title}》？历史成绩不会受影响。`)) removeImported(exam.examId) }}>删除</button>
          </div>
        ))}
        {!importedIds.size && <p className="muted">尚未导入本地试卷。</p>}
      </section>
    </>
  )
}

function IntroPage() {
  const { examId } = useParams()
  const { exams } = useExams()
  const navigate = useNavigate()
  const exam = findExam(exams, examId ? decodeURIComponent(examId) : undefined)
  if (!exam) return <EmptyState title="未找到试卷" text="试卷可能尚未加载或已经删除。" />
  const saved = examStorage.getProgress(exam.examId)
  const begin = (fresh: boolean) => {
    if (fresh || !saved) examStorage.saveProgress(newProgress(exam))
    navigate(`/exam/${encodeURIComponent(exam.examId)}`)
  }
  return (
    <div className="intro-sheet">
      <span className="subject-tag">{exam.subject}</span>
      <h1>{exam.title}</h1>
      <p className="lead">{exam.description}</p>
      <dl className="exam-meta large">
        <div><dt>总题数</dt><dd>{examQuestionCount(exam)} 题</dd></div>
        <div><dt>总分</dt><dd>{exam.totalScore} 分</dd></div>
        <div><dt>建议用时</dt><dd>{exam.durationMinutes} 分钟</dd></div>
      </dl>
      <div className="instructions">
        <h2>考试说明</h2>
        <ol>
          <li>单项选择题选中后自动保存，可随时返回修改。</li>
          <li>倒计时结束将自动交卷；退出或刷新后可继续。</li>
          <li>不确定的题目可先标记，在答题卡中集中查看。</li>
          <li>交卷后立即评分，并可记录错题原因、导出结果。</li>
        </ol>
      </div>
      {saved && <div className="notice success">发现未完成记录：已答 {Object.values(saved.answers).filter((answer) => !isAnswerEmpty(answer)).length} 题，已用 {formatDuration(saved.elapsedSeconds)}。</div>}
      <div className="button-stack">
        <button className="button primary large" onClick={() => begin(false)}>{saved ? '继续上次考试' : '开始考试'}</button>
        {saved && <button className="button ghost" onClick={() => { if (confirm('重新开始会覆盖当前进度，确定吗？')) begin(true) }}>放弃进度，重新开始</button>}
      </div>
    </div>
  )
}

function AnswerInput({ item, value, onChange }: { item: FlatQuestion; value?: AnswerValue; onChange: (value: AnswerValue) => void }) {
  const q = item.question
  if (q.type === 'single_choice') return (
    <div className="options" role="radiogroup" aria-label="答案选项">
      {q.options?.map((option) => {
        const selected = value === option.key
        return <button key={option.key} className={`option ${selected ? 'selected' : ''}`} role="radio" aria-checked={selected} onClick={() => onChange(option.key)}><span>{option.key}</span><p>{option.text}</p></button>
      })}
    </div>
  )
  if (q.type === 'multiple_choice') {
    const selected = Array.isArray(value) ? value : []
    return <div className="options">{q.options?.map((option) => <button key={option.key} className={`option ${selected.includes(option.key) ? 'selected' : ''}`} onClick={() => onChange(selected.includes(option.key) ? selected.filter((key) => key !== option.key) : [...selected, option.key])}><span>{option.key}</span><p>{option.text}</p></button>)}</div>
  }
  return <textarea className="answer-text" value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} placeholder={q.type === 'essay' ? '在此输入作文（第一版仅保存，不自动评分）' : '在此输入答案（第一版仅保存，不自动评分）'} />
}

function ExamPage() {
  const { examId } = useParams()
  const { exams } = useExams()
  const navigate = useNavigate()
  const exam = findExam(exams, examId ? decodeURIComponent(examId) : undefined)
  const [progress, setProgress] = useState<ExamProgress | null>(() => examId ? examStorage.getProgress(decodeURIComponent(examId)) ?? null : null)
  const [cardOpen, setCardOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const settings = examStorage.getSettings()

  useEffect(() => {
    if (exam && !progress) {
      const fresh = newProgress(exam)
      examStorage.saveProgress(fresh)
      setProgress(fresh)
    }
  }, [exam, progress])

  const allQuestions = useMemo(() => exam ? flattenExam(exam) : [], [exam])
  const questions = useMemo(() => progress?.questionIds ? allQuestions.filter((item) => progress.questionIds?.includes(item.question.id)) : allQuestions, [allQuestions, progress?.questionIds])
  const save = (next: ExamProgress) => { setProgress(next); examStorage.saveProgress(next) }
  const submit = () => {
    if (!exam || !progress) return
    const result = scoreExam(exam, progress)
    examStorage.saveResult(result)
    examStorage.removeProgress(exam.examId)
    navigate(`/result/${encodeURIComponent(result.resultId)}`, { replace: true })
  }

  useEffect(() => {
    if (!exam || !progress || submitOpen) return
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (!current) return current
        const currentQuestion = questions[current.currentIndex]?.question.id
        const next = { ...current, elapsedSeconds: current.elapsedSeconds + 1, updatedAt: new Date().toISOString(), timeByQuestion: currentQuestion ? { ...current.timeByQuestion, [currentQuestion]: (current.timeByQuestion[currentQuestion] ?? 0) + 1 } : current.timeByQuestion }
        examStorage.saveProgress(next)
        return next
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [exam, questions, progress?.sessionId, submitOpen])

  useEffect(() => {
    if (exam && progress && progress.elapsedSeconds >= exam.durationMinutes * 60) submit()
  // submit deliberately depends on current progress; guard prevents early submission
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress?.elapsedSeconds])

  if (!exam || !progress || !questions.length) return <div className="exam-loading">正在恢复试卷…</div>
  const currentIndex = Math.min(progress.currentIndex, questions.length - 1)
  const item = questions[currentIndex]
  const q = item.question
  const remaining = Math.max(0, exam.durationMinutes * 60 - progress.elapsedSeconds)
  const unanswered = questions.filter(({ question }) => isAnswerEmpty(progress.answers[question.id])).length
  const marked = questions.filter(({ question }) => progress.marked.includes(question.id)).length
  const move = (index: number) => { save({ ...progress, currentIndex: Math.max(0, Math.min(questions.length - 1, index)), updatedAt: new Date().toISOString() }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const toggleMark = () => save({ ...progress, marked: progress.marked.includes(q.id) ? progress.marked.filter((id) => id !== q.id) : [...progress.marked, q.id], updatedAt: new Date().toISOString() })
  return (
    <div className="exam-screen">
      <header className="exam-header">
        <button className="icon-button" onClick={() => navigate('/')} aria-label="退出考试">×</button>
        <div className="exam-position"><strong>{currentIndex + 1}</strong><span>/ {questions.length}</span></div>
        <div className={`timer ${remaining < 300 ? 'urgent' : ''}`}><small>剩余</small><strong>{formatDuration(remaining)}</strong></div>
        <button className="card-button" onClick={() => setCardOpen(true)}>答题卡</button>
      </header>
      <main className="question-page">
        {item.passage && <Passage passage={item.passage} title={item.sectionTitle} defaultExpanded={settings.passageExpanded} />}
        <article className="question-block">
          <div className="question-meta"><span>{item.sectionTitle}</span><span>{q.difficulty} · {q.score} 分</span></div>
          <h1><span className="question-number">{currentIndex + 1}.</span>{q.question}</h1>
          <AnswerInput item={item} value={progress.answers[q.id]} onChange={(answer) => save({ ...progress, answers: { ...progress.answers, [q.id]: answer }, updatedAt: new Date().toISOString() })} />
          <button className={`mark-button ${progress.marked.includes(q.id) ? 'marked' : ''}`} onClick={toggleMark}><span>?</span>{progress.marked.includes(q.id) ? '已标记不确定' : '标记为不确定'}</button>
        </article>
      </main>
      <footer className="exam-footer">
        <button className="button ghost" disabled={currentIndex === 0} onClick={() => move(currentIndex - 1)}>← 上一题</button>
        {currentIndex < questions.length - 1 ? <button className="button primary" onClick={() => move(currentIndex + 1)}>下一题 →</button> : <button className="button submit" onClick={() => settings.confirmBeforeSubmit ? setSubmitOpen(true) : submit()}>交卷</button>}
      </footer>
      {cardOpen && <AnswerCard questions={questions} progress={progress} onJump={(index) => { move(index); setCardOpen(false) }} onClose={() => setCardOpen(false)} onSubmit={() => { setCardOpen(false); setSubmitOpen(true) }} />}
      {submitOpen && <Modal title="确认交卷" onClose={() => setSubmitOpen(false)}>
        <div className="submit-summary"><div><strong>{unanswered}</strong><span>题未回答</span></div><div><strong>{marked}</strong><span>题已标记</span></div><div><strong>{formatDuration(progress.elapsedSeconds)}</strong><span>已用时间</span></div></div>
        <p className="muted center">交卷后本次答案将不能修改，是否确认？</p>
        <div className="modal-actions"><button className="button ghost" onClick={() => setSubmitOpen(false)}>继续检查</button><button className="button submit" onClick={submit}>确认交卷</button></div>
      </Modal>}
    </div>
  )
}

function Passage({ passage, title, defaultExpanded }: { passage: string; title: string; defaultExpanded: boolean }) {
  const [open, setOpen] = useState(defaultExpanded)
  return <section className={`passage ${open ? 'open' : ''}`}><button className="passage-toggle" onClick={() => setOpen(!open)}><span><small>READING PASSAGE</small><strong>{title}</strong></span><span>{open ? '收起原文 ↑' : '展开原文 ↓'}</span></button>{open && <div className="passage-text">{passage.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>}</section>
}

function AnswerCard({ questions, progress, onJump, onClose, onSubmit }: { questions: FlatQuestion[]; progress: ExamProgress; onJump: (index: number) => void; onClose: () => void; onSubmit: () => void }) {
  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="answer-card-sheet"><div className="sheet-handle" /><div className="sheet-title"><div><p className="eyebrow">NAVIGATION</p><h2>答题卡</h2></div><button className="icon-button" onClick={onClose}>×</button></div><div className="legend"><span><i className="answered" />已答</span><span><i />未答</span><span><i className="marked" />标记</span><span><i className="current" />当前</span></div><div className="number-grid">{questions.map(({ question }, index) => { const answered = !isAnswerEmpty(progress.answers[question.id]); const marked = progress.marked.includes(question.id); return <button key={question.id} className={`${answered ? 'answered' : ''} ${marked ? 'marked' : ''} ${index === progress.currentIndex ? 'current' : ''}`} onClick={() => onJump(index)}>{index + 1}{marked && <sup>•</sup>}</button> })}</div><button className="button submit full" onClick={onSubmit}>检查并交卷</button></section></div>
}

function ResultPage() {
  const { resultId } = useParams()
  const navigate = useNavigate()
  const [history, setHistory] = useState(examStorage.getHistory())
  const [filter, setFilter] = useState<'all' | 'wrong' | 'marked'>('all')
  const [reasons, setReasons] = useState(examStorage.getReasons())
  const result = history.find((item) => item.resultId === (resultId ? decodeURIComponent(resultId) : ''))
  if (!result) return <EmptyState title="未找到成绩" text="这条成绩可能已被删除。" />
  const flat = flattenExam(result.examSnapshot)
  const byId = new Map(flat.map((item) => [item.question.id, item]))
  const visible = result.questionResults.filter((item) => filter === 'all' || (filter === 'wrong' ? item.isCorrect === false && !isAnswerEmpty(item.userAnswer) : item.marked))
  const saveReason = (questionId: string, reason: ErrorReason) => { examStorage.saveReason(result.resultId, questionId, reason); setReasons(examStorage.getReasons()) }
  const startAgain = (questionIds?: string[]) => { examStorage.saveProgress(newProgress(result.examSnapshot, questionIds)); navigate(`/exam/${encodeURIComponent(result.examId)}`) }
  const exportResult = (format: ExportFormat) => { const content = makeExport(result, reasons, format); downloadText(content, `${result.examId}-${result.submittedAt.slice(0, 10)}.${format}`, format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/plain') }
  return (
    <>
      <section className="result-hero">
        <p className="eyebrow">考试完成 · {formatDate(result.submittedAt)}</p>
        <h1>{result.title}</h1>
        <div className="score-lockup"><strong>{result.score}</strong><span>/ {result.maxScore} 分</span><em>{percent(result.accuracy)} 正确率</em></div>
        <div className="result-facts"><span>正确 <b>{result.correctCount}</b></span><span>错误 <b>{result.wrongCount}</b></span><span>未答 <b>{result.unansweredCount}</b></span><span>用时 <b>{formatDuration(result.elapsedSeconds)}</b></span></div>
      </section>
      <section className="analytics-grid">
        <AnalysisBlock title="各模块" groups={result.bySection} />
        <AnalysisBlock title="知识点" groups={result.byKnowledgePoint} />
        <AnalysisBlock title="难度" groups={result.byDifficulty} />
      </section>
      <section className="result-actions">
        <button className="button primary" onClick={() => startAgain()}>重做整套试卷</button>
        <button className="button ghost" disabled={!result.questionResults.some((item) => item.isCorrect === false && !isAnswerEmpty(item.userAnswer))} onClick={() => startAgain(result.questionResults.filter((item) => item.isCorrect === false && !isAnswerEmpty(item.userAnswer)).map((item) => item.questionId))}>重新测试错题</button>
      </section>
      <section className="export-panel"><div><h2>导出结果</h2><p>含答案、评分、用时、知识点和已记录的错因，便于交给 ChatGPT 分析。</p></div><div>{(['json', 'txt', 'csv'] as ExportFormat[]).map((format) => <button className="button ghost" key={format} onClick={() => exportResult(format)}>{format.toUpperCase()}</button>)}</div></section>
      <section className="review-section">
        <div className="section-heading compact"><div><p className="eyebrow">REVIEW</p><h2>题目复盘</h2></div><div className="segmented"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部</button><button className={filter === 'wrong' ? 'active' : ''} onClick={() => setFilter('wrong')}>错题</button><button className={filter === 'marked' ? 'active' : ''} onClick={() => setFilter('marked')}>标记</button></div></div>
        <div className="review-list">{visible.map((questionResult) => { const item = byId.get(questionResult.questionId); if (!item) return null; return <ReviewQuestion key={questionResult.questionId} item={item} result={questionResult} reason={reasons[`${result.resultId}:${questionResult.questionId}`]} onReason={(reason) => saveReason(questionResult.questionId, reason)} /> })}{!visible.length && <p className="muted">此筛选下没有题目。</p>}</div>
      </section>
    </>
  )
}

function AnalysisBlock({ title, groups }: { title: string; groups: ExamResult['bySection'] }) {
  return <div className="analysis-card"><h3>{title}</h3>{groups.map((group) => <div className="analysis-row" key={group.label}><div><span>{group.label}</span><small>{group.correct}/{group.total} 题 · {group.earnedScore}/{group.maxScore} 分</small></div><strong>{percent(group.accuracy)}</strong><div className="bar"><i style={{ width: percent(group.accuracy) }} /></div></div>)}{!groups.length && <p className="muted">暂无可评分题目</p>}</div>
}

const errorReasons: ErrorReason[] = ['完全不会', '知识点遗忘', '方法选择错误', '计算粗心', '题意误读', '时间不足', '蒙题', '其他']
function ReviewQuestion({ item, result, reason, onReason }: { item: FlatQuestion; result: ExamResult['questionResults'][number]; reason?: ErrorReason; onReason: (reason: ErrorReason) => void }) {
  const q = item.question
  const unanswered = isAnswerEmpty(result.userAnswer)
  const state = result.isCorrect ? 'correct' : result.isCorrect === null ? 'ungraded' : unanswered ? 'unanswered' : 'wrong'
  return <details className={`review-card ${state}`}><summary><span className="result-icon">{result.isCorrect ? '✓' : result.isCorrect === null || unanswered ? '—' : '×'}</span><div><strong>{q.question}</strong><small>{q.category} · {q.knowledgePoint} · 用时 {formatDuration(result.timeSeconds)}</small></div><span className="chevron">⌄</span></summary><div className="review-content">{item.passage && <div className="review-passage">{item.passage}</div>}<div className="review-options">{q.options?.map((option) => { const userPicked = Array.isArray(result.userAnswer) ? result.userAnswer.includes(option.key) : result.userAnswer === option.key; const correct = Array.isArray(result.correctAnswer) ? result.correctAnswer.includes(option.key) : result.correctAnswer === option.key; return <div key={option.key} className={`${correct ? 'correct-answer' : ''} ${userPicked && !correct ? 'wrong-answer' : ''}`}><span>{option.key}</span><p>{option.text}</p>{correct && <b>正确答案</b>}{userPicked && <em>你的选择</em>}</div> })}</div><div className="answer-summary">你的答案：<strong>{Array.isArray(result.userAnswer) ? result.userAnswer.join('、') : result.userAnswer || '未答'}</strong>　正确答案：<strong>{Array.isArray(result.correctAnswer) ? result.correctAnswer.join('、') : result.correctAnswer || '不自动评分'}</strong>　得分：<strong>{result.earnedScore}/{result.maxScore}</strong></div><div className="explanation"><span>解析</span><p>{q.explanation || '本题暂未提供解析。'}</p></div>{result.isCorrect === false && !unanswered && <label className="reason-select"><span>错误原因</span><select value={reason ?? ''} onChange={(event) => onReason(event.target.value as ErrorReason)}><option value="" disabled>请选择，便于后续复盘</option>{errorReasons.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}</div></details>
}

function HistoryPage() {
  const [history, setHistory] = useState(examStorage.getHistory())
  return <><PageTitle eyebrow="学习轨迹" title="历史成绩" text={`已保存 ${history.length} 次作答记录，全部留在当前设备。`} />{history.length ? <div className="history-list">{history.map((result) => <div className="history-card" key={result.resultId}><div className="history-date"><strong>{new Date(result.submittedAt).getDate()}</strong><span>{new Intl.DateTimeFormat('zh-CN', { month: 'short' }).format(new Date(result.submittedAt))}</span></div><div className="history-main"><span className="subject-tag">{result.subject}</span><h3>{result.title}</h3><small>{formatDate(result.submittedAt)} · 用时 {formatDuration(result.elapsedSeconds)}</small></div><div className="history-score"><strong>{result.score}</strong><span>/{result.maxScore}</span><em>{percent(result.accuracy)}</em></div><div className="history-actions"><Link className="button ghost" to={`/result/${encodeURIComponent(result.resultId)}`}>详情</Link><button className="button danger ghost" onClick={() => { if (confirm('删除这次成绩记录？此操作不能撤销。')) { examStorage.deleteResult(result.resultId); setHistory(examStorage.getHistory()) } }}>删除</button></div></div>)}</div> : <EmptyState title="还没有成绩" text="完成并提交一套试卷后，记录会出现在这里。" />}</>
}

function SettingsPage() {
  const [settings, setSettings] = useState(examStorage.getSettings())
  const update = (key: keyof typeof settings, value: boolean) => { const next = { ...settings, [key]: value }; setSettings(next); examStorage.saveSettings(next) }
  return <><PageTitle eyebrow="偏好" title="设置" text="设置会自动保存在当前浏览器。" /><div className="settings-card"><Toggle label="交卷前二次确认" description="显示未答题和标记题数量后再确认交卷。" checked={settings.confirmBeforeSubmit} onChange={(value) => update('confirmBeforeSubmit', value)} /><Toggle label="默认展开英语原文" description="进入阅读题时直接显示文章，也可以随时收起。" checked={settings.passageExpanded} onChange={(value) => update('passageExpanded', value)} /></div><div className="info-panel"><h2>本地数据说明</h2><p>试卷进度、历史成绩和错因均保存在 localStorage。清除浏览器网站数据会一并删除，请定期导出重要成绩。</p></div></>
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="toggle-row"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-title"><h2>{title}</h2><button className="icon-button" onClick={onClose}>×</button></div>{children}</section></div>
}
function PageTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) { return <header className="page-title"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{text}</p></header> }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="empty"><span>◇</span><h2>{title}</h2><p>{text}</p></div> }

export default function App() {
  return <HashRouter><ExamProvider><Shell><Routes><Route path="/" element={<HomePage />} /><Route path="/import" element={<ImportPage />} /><Route path="/intro/:examId" element={<IntroPage />} /><Route path="/exam/:examId" element={<ExamPage />} /><Route path="/result/:resultId" element={<ResultPage />} /><Route path="/history" element={<HistoryPage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="*" element={<EmptyState title="页面不存在" text="请从顶部导航返回试卷列表。" />} /></Routes></Shell></ExamProvider></HashRouter>
}
