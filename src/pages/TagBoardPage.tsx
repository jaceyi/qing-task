import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useCanonicalBoardUrl } from '../hooks/useCanonicalBoardUrl'
import { parseTagTimeScope, type TagBoardRoute } from '../lib/routes'
import { BoardContent } from '../components/BoardContent'

/** 标签看板页：/tasks/tags/:tagId，?scope/?from/?to 承载可分享的时间范围。 */
export function TagBoardPage() {
  const { tagId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const boardRoute = useMemo<TagBoardRoute>(
    () => ({ name: 'tag-board', tagId, ...parseTagTimeScope(searchParams) }),
    [tagId, searchParams],
  )
  useCanonicalBoardUrl(boardRoute)
  return <BoardContent boardRoute={boardRoute} />
}
