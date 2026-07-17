import { flattenExam } from '../types/exam'
import type { ErrorReason, ExamResult } from '../types/result'
import { formatDuration, percent } from './format'

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
      是否正确: item.isCorrect === null ? '不评分' : item.isCorrect ? '正确' : '错误',
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
  if (format === 'json') return JSON.stringify({
    试卷: { 名称: result.title, 科目: result.subject, 日期: result.submittedAt, 得分: result.score, 满分: result.maxScore, 正确率: percent(result.accuracy), 总用时: formatDuration(result.elapsedSeconds) },
    答题明细: rows,
  }, null, 2)
  if (format === 'csv') {
    const headers = Object.keys(rows[0] ?? {})
    return [headers.map(csvEscape).join(','), ...rows.map((row) => headers.map((key) => csvEscape(row[key as keyof typeof row])).join(','))].join('\n')
  }
  return [
    `试卷：${result.title}`,
    `科目：${result.subject}`,
    `成绩：${result.score}/${result.maxScore}（${percent(result.accuracy)}）`,
    `总用时：${formatDuration(result.elapsedSeconds)}`,
    '',
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
