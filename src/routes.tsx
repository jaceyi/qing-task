import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router'
import { AppLayout } from './components/layout/AppLayout'
import {
  parseIds,
  parseTagTimeScope,
  pathForRoute,
  routeDefinitions,
  withDevelopmentFlags,
  type TagBoardRoute,
} from './lib/routes'
import { BoardPage } from './pages/BoardPage'
import { NewTaskPage } from './pages/NewTaskPage'
import { SettingsPage } from './pages/SettingsPage'
import { TagBoardPage } from './pages/TagBoardPage'
import { TaskDetailPage } from './pages/TaskDetailPage'

/** 根路径与未知路径统一回到任务看板，并保留开发态 ?demo 参数。 */
function RedirectToTasks() {
  const location = useLocation()
  return <Navigate to={withDevelopmentFlags(routeDefinitions.all, location.search)} replace />
}

/** 旧版标签看板地址 /tasks/tags?id=… 重定向到单标签看板路由。 */
function LegacyTagBoardRedirect() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const tagId = searchParams.get('id') || parseIds(searchParams.get('ids'))[0]
  if (!tagId) return <RedirectToTasks />
  const route: TagBoardRoute = { name: 'tag-board', tagId, ...parseTagTimeScope(searchParams) }
  return <Navigate to={withDevelopmentFlags(pathForRoute(route), location.search)} replace />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<RedirectToTasks />} />
        <Route path={routeDefinitions.all} element={<BoardPage scope="all" />} />
        <Route path={routeDefinitions.today} element={<BoardPage scope="today" />} />
        <Route path={routeDefinitions.week} element={<BoardPage scope="week" />} />
        {/* 新建任务：移动端下钻页面；桌面端直接访问时在来源看板上打开抽屉 */}
        <Route path={routeDefinitions.taskNew} element={<NewTaskPage />} />
        <Route path={routeDefinitions.legacyTags} element={<LegacyTagBoardRedirect />} />
        <Route path={routeDefinitions.tagBoard} element={<TagBoardPage />} />
        <Route path={routeDefinitions.taskDetail} element={<TaskDetailPage />} />
        <Route path={routeDefinitions.settings} element={<SettingsPage />} />
        <Route path="*" element={<RedirectToTasks />} />
      </Route>
    </Routes>
  )
}
