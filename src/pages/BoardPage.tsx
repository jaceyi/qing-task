import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useCanonicalBoardUrl } from '../hooks/useCanonicalBoardUrl'
import { parseTimeBoard } from '../lib/routes'
import type { BoardScope } from '../types'
import { BoardContent } from '../components/BoardContent'

interface BoardPageProps {
  scope: BoardScope
}

/** 时间看板页：/tasks、/tasks/today、/tasks/week，?tags 与 ?match 承载标签子筛选。 */
export function BoardPage({ scope }: BoardPageProps) {
  const [searchParams] = useSearchParams()
  const boardRoute = useMemo(() => parseTimeBoard(scope, searchParams), [scope, searchParams])
  useCanonicalBoardUrl(boardRoute)
  return <BoardContent boardRoute={boardRoute} />
}
