import { flattenExam } from '../types/exam'
import type { ErrorReason, ExamResult } from '../types/result'
import { formatDate, formatDuration, percent } from './format'
import { isAnswerEmpty } from './scoring'

export type ExportFormat = 'json' | 'txt' | 'csv'

const rowsFor = (result: ExamResult, reasons: Record<string, ErrorReason>) => {
  const byId = new Map(flattenExam(result.examSnapshot).map((item) => [item.question.id, item.question]))
  return result.questionResults.map((item, index) => {
    const question = byId.get(item.questionId)
    return {
      题号: index + 1,
      题目ID: item.questionId,
      题目: question?.question ?? '',
      用户答案: Array.isArray(item.userAnswer) ? item.userAnswer.join('、') : item.userAnswer ?? '未答',
      正确答案: Array.isArray(item.correctAnswer) ? item.correctAnswer.join('、') : item.correctAnswer ?? '不自动评分',
      是否正确: item.isCorrect === null ? '不评分' : isAnswerEmpty(item.userAnswer) ? '未答' : item.isCorrect ? '正确' : '错误',
      得分: item.earnedScore,
      满分: item.maxScore,
      用时秒: item.timeSeconds,
      模块: item.category,
      知识点: item.knowledgePoint,
      难度: item.difficulty,
      错误原因: reasons[`${result.resultId}:${item.questionId}`] ?? '',
    }
  })
}

const csvEscape = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`

export const makeExport = (result: ExamResult, reasons: Record<string, ErrorReason>, format: ExportFormat) => {
  const rows = rowsFor(result, reasons)
  const summary = { 名称: result.title, 科目: result.subject, 日期: formatDate(result.submittedAt), 得分: result.score, 满分: result.maxScore, 正确题数: result.correctCount, 错误题数: result.wrongCount, 未答题数: result.unansweredCount, 正确率: percent(result.accuracy), 总用时: formatDuration(result.elapsedSeconds) }
  if (format === 'json') return JSON.stringify({
    试卷: summary,
    模块统计: result.bySection,
    知识点统计: result.byKnowledgePoint,
    难度统计: result.byDifficulty,
    答题明细: rows,
  }, null, 2)
  if (format === 'csv') {
    const headers = Object.keys(rows[0] ?? {})
    return [headers.map(csvEscape).join(','), ...rows.map((row) => headers.map((key) => csvEscape(row[key as keyof typeof row])).join(','))].join('\n')
  }
  return [
    `【AI 考研答题结果】`,
    `试卷：${summary.名称}`,
    `科目：${summary.科目}`,
    `完成时间：${summary.日期}`,
    `成绩：${summary.得分}/${summary.满分}（${summary.正确率}）`,
    `正确：${summary.正确题数}｜错误：${summary.错误题数}｜未答：${summary.未答题数}｜总用时：${summary.总用时}`,
    '',
    '【知识点统计】',
    ...result.byKnowledgePoint.map((group) => `${group.label}：${group.correct}/${group.total} 题正确，${percent(group.accuracy)}`),
    '',
    '【逐题明细】',
    ...rows.flatMap((row) => [
      `【第${row.题号}题】${row.题目}`,
      `作答：${row.用户答案}｜正确答案：${row.正确答案}｜${row.是否正确}｜得分：${row.得分}/${row.满分}｜用时：${row.用时秒}秒`,
      `模块：${row.模块}｜知识点：${row.知识点}｜难度：${row.难度}${row.错误原因 ? `｜错误原因：${row.错误原因}` : ''}`,
      '',
    ]),
  ].join('\n')
}

export const downloadText = (content: string, filename: string, mime: string) => {
  const blob = new Blob(['\uFEFF', content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
