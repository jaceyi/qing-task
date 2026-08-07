# 轻任务

轻任务是一款以“完成”和“推进”为核心的轻量任务管理 PWA。界面采用清新的淡紫配色，同时针对桌面端和移动端分别设计了紧凑布局与手势操作。

## 已实现

- Google 账号登录，数据按用户隔离存储在 Firebase Firestore
- 完成型任务与进度型任务，可随时切换类型
- 普通任务和进度任务都可设置日/周/月/年重复；完成当前实例后自动安排下一次，并支持 10 秒撤销
- 重复规则支持常用预设、自定间隔、多星期、截止日期和未来三次预览
- 每个任务可添加多个标签，支持标签看板、全部/任一组合筛选、标签搜索与行内展示
- 设置页支持标签创建、重命名、改色、排序、合并和删除
- 桌面端悬停快捷操作，移动端左右滑动完成或调整进度
- 新建、编辑、复制、删除、完成/取消完成、进度增减，支持多行任务描述
- 新建任务在桌面端以抽屉打开、在移动端进入独立新建页；未保存的草稿会自动留在本机，中途退出可选择保留或放弃
- 可选的任务起止时间，填写时精确到分钟；无时间任务会集中显示在“全部”看板
- 全部、今天、本周任务看板，默认进入“全部”，并可控制是否显示已完成任务
- 操作历史记录与本地优先的实时云同步
- 设置页 PWA 安装入口、离线应用外壳和新版本提示
- 响应式桌面/移动布局、iPhone 安全区、键盘焦点状态与减少动效偏好

## 本地运行

需要 Node.js 22.22.0 或更新版本（React Router 8 的最低要求；项目已提供 `.nvmrc`）。

```bash
npm install
npm run dev
```

开发环境可在地址后添加 `?demo=1` 进入仅保存在当前浏览器内存中的演示模式：

```text
http://localhost:5173/?demo=1
```

## 验证与构建

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Firebase

项目已连接到 Firebase 项目 `task-914de`。前端 Firebase 配置是 Firebase Web SDK 的公开客户端标识，不是服务端密钥；真正的数据访问权限由 `firestore.rules` 控制。

生产地址为 `https://task.jaceyi.com`。Firebase Authentication 已授权该域名，应用在此地址会使用同域的 Google OAuth 回调。

如需改用另一个 Firebase 项目，可复制 `.env.example` 为 `.env.local` 并填写对应配置。

部署 Firestore 规则、索引和 Hosting：

```bash
npm run deploy
```

GitHub Actions 会先执行类型检查、代码检查、测试和构建；只有 `main` 分支全部通过后，才会自动发布到 Firebase Hosting。

## 数据结构

```text
users/{uid}/tasks/{taskId}
users/{uid}/tasks/{taskId}/logs/{logId}
users/{uid}/tasks/{taskId}/occurrences/{occurrenceKey}
users/{uid}/tags/{tagId}
users/{uid}/tagNameClaims/{normalizedName}
users/{uid}/settings/preferences
```

任务与历史记录只允许当前登录用户读写，并在规则层验证关键字段和计数边界。

## 本地优先同步

应用会先在当前设备即时更新界面，再由 Firestore 在后台同步，因此弱网或暂时离线时，完成任务、调整进度和编辑信息都不需要等待网络响应。同步中的更改会在界面上明确提示；网络恢复后会自动继续发送。

- 浏览器使用持久化、多标签页共享的本地缓存，刷新页面或短时离线不会丢失待同步操作。
- 新建任务、状态切换、类型切换和信息编辑使用原子批量写入，任务与操作记录会一起成功或一起失败。
- 进度加减使用服务端原子增量，多台设备同时推进时会合并每一次有效操作。
- 标题、描述、时间和目标次数只写入实际变更的字段，减少不同设备编辑不同字段时的相互覆盖。
- 同一字段在多端同时修改时遵循 Firestore 的最后写入生效；绝对状态操作（完成、类型、删除）同样以最后同步的操作为准。
- 如果云端安全规则拒绝写入，实时监听会撤销本地待定状态并恢复云端数据，同时向用户显示同步错误。
