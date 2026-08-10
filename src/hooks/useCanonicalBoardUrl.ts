import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { pathForRoute, withDevelopmentFlags, type BoardRoute } from '../lib/routes'

/**
 * 看板页地址规范化：把冗余/非法的查询参数（重复标签、非法自定义日期等）
 * 原地替换为解析后的标准地址，保证 URL 可分享、可刷新。
 */
export function useCanonicalBoardUrl(route: BoardRoute) {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const canonical = withDevelopmentFlags(pathForRoute(route), location.search)
    if (`${location.pathname}${location.search}` === canonical) return
    navigate(canonical, { replace: true, state: location.state })
  }, [route, location.pathname, location.search, location.state, navigate])
}
