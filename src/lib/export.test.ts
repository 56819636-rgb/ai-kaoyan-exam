import { describe, expect, it } from 'vitest'
import { makeDailyReportExport, makeExport } from './export'
import { scoreExam } from './scoring'
import type { ExamPaper } from '../types/exam'
import type { DailyReport, ExamProgress } from '../types/result'

const exam: ExamPaper = { examId: 'export-test', title: '导出测试卷', subject: '逻辑推理', description: '', durationMinutes: 10, totalScore: 6, version: '1.0', sections: [{ sectionId: 's', title: '模块', questions: [
  { id: 'q1', type: 'single_choice', category: '模块', knowledgePoint: '知识点A', difficulty: '基础', score: 3, question: '第一题', options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }], correctAnswer: 'A' },
  { id: 'q2', type: 'single_choice', category: '模块', knowledgePoint: '知识点B', difficulty: '中等', score: 3, question: '第二题', options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }], correctAnswer: 'B' },
] }] }
const progress: ExamProgress = { examId: 'export-test', sessionId: 's', currentIndex: 1, answers: { q1: 'B' }, marked: [], timeByQuestion: { q1: 9 }, elapsedSeconds: 22, startedAt: '2026-07-17T00:00:00Z', updatedAt: '2026-07-17T00:00:22Z' }

describe('makeExport', () => {
  it('TXT 清楚包含汇总、知识点与未答状态', () => {
    const result = scoreExam(exam, progress, '2026-07-17T00:00:22Z')
    const txt = makeExport(result, { [`${result.resultId}:q1`]: '蒙题' }, 'txt')
    expect(txt).toContain('【AI 考研答题结果】')
    expect(txt).toContain('【知识点统计】')
    expect(txt).toContain('未答')
    expect(txt).toContain('错误原因：蒙题')
  })
})

const dailyReport: DailyReport = {
  date: '2026-07-21', dayLabel: 'Day 4', totalMinutes: '120', commuteMinutes: '30', quietMinutes: '90',
  english: '背单词并完成阅读', math: '应用题', logic: '无', writing: '', questionCount: '20', correctCount: '15',
  keyErrorTopic: '长难句', keyErrorReason: '题意误读', unresolvedQuestion: '无', stateScore: '4',
  tomorrowTask: '复盘阅读错题', updatedAt: '2026-07-21T12:00:00Z',
}

describe('makeDailyReportExport', () => {
  it('TXT 适合直接交给 ChatGPT 复盘', () => {
    const txt = makeDailyReportExport([dailyReport], 'txt')
    expect(txt).toContain('【Day 4 学习汇报】')
    expect(txt).toContain('正确率 75%')
    expect(txt).toContain('分析学习时间分配')
  })

  it('CSV 正确转义多行和逗号内容', () => {
    const csv = makeDailyReportExport([{ ...dailyReport, english: '阅读,\n词汇' }], 'csv')
    expect(csv).toContain('"阅读,\n词汇"')
    expect(csv).toContain('"75%"')
  })

  it('JSON 保留完整日报字段', () => {
    const json = JSON.parse(makeDailyReportExport([dailyReport], 'json'))
    expect(json.日报数量).toBe(1)
    expect(json.日报[0].tomorrowTask).toBe('复盘阅读错题')
  })
})
