# 轻任务

轻任务是一款以“完成”和“推进”为核心的轻量任务管理 PWA。界面采用清新的淡紫配色，同时针对桌面端和移动端分别设计了紧凑布局与手势操作。

## 已实现

- Google 账号登录，数据按用户隔离存储在 Firebase Firestore
- 完成型任务与进度型任务，可随时切换类型
- 桌面端悬停快捷操作，移动端左右滑动完成或调整进度
- 新建、编辑、复制、删除、完成/取消完成、进度增减
- 今日任务、全部任务、已完成任务视图
- 操作历史记录与实时云同步
- PWA 安装、离线应用外壳和新版本提示
- 响应式桌面/移动布局、键盘焦点状态与减少动效偏好

## 本地运行

需要 Node.js 22 或更新版本。

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

如需改用另一个 Firebase 项目，可复制 `.env.example` 为 `.env.local` 并填写对应配置。

部署 Firestore 规则、索引和 Hosting：

```bash
npm run deploy
```

## 数据结构

```text
users/{uid}/tasks/{taskId}
users/{uid}/tasks/{taskId}/logs/{logId}
users/{uid}/settings/preferences
```

任务与历史记录只允许当前登录用户读写，并在规则层验证关键字段和计数边界。
