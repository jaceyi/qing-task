import { useState } from 'react'
import { Alert, Box, Button, Paper, Typography } from '@mui/material'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import CloudDoneOutlined from '@mui/icons-material/CloudDoneOutlined'
import LayersOutlined from '@mui/icons-material/LayersOutlined'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import { signInWithGoogle } from '../lib/firebase'

interface LoginScreenProps {
  error: string
  onError: (message: string) => void
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.4a4.7 4.7 0 0 1-2 3.1v2.4h3.2c1.9-1.8 3-4.2 3-7.2Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.5L15.4 17c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.5A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.9A6 6 0 0 1 6.1 12c0-.7.1-1.3.3-1.9V7.6H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.4l3.3-2.5Z" />
      <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.9 5.6l3.3 2.5C7.2 7.8 9.4 6 12 6Z" />
    </svg>
  )
}

function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <span className={`grid shrink-0 place-items-center bg-primary text-white shadow-[0_6px_14px_rgba(99,117,215,0.2)] ${large ? 'size-[52px] rounded-[15px]' : 'size-8 rounded-md'}`}>
      <CheckOutlined sx={{ fontSize: large ? 26 : 18 }} />
    </span>
  )
}

export function LoginScreen({ error, onError }: LoginScreenProps) {
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    setLoading(true)
    onError('')
    try {
      await signInWithGoogle()
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : '登录失败，请重试')
      setLoading(false)
    }
  }

  return (
    <Box component="main" className="grid min-h-svh grid-cols-[minmax(420px,1.05fr)_minmax(430px,0.95fr)] bg-base max-sm:block max-sm:bg-surface">
      <Box
        component="section"
        className="flex min-h-svh flex-col bg-[radial-gradient(circle_at_15%_80%,rgba(131,212,182,0.16),transparent_30%),linear-gradient(145deg,#f5f4fc,#eeedf9)] px-16 py-16 max-sm:min-h-0 max-sm:px-6 max-sm:pt-[calc(32px+env(safe-area-inset-top))] max-sm:pb-8"
      >
        <div className="flex items-center gap-2.5 text-[17px] font-bold"><BrandMark /><span>轻任务</span></div>
        <div className="my-auto max-w-[600px] max-sm:my-16">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.08em] text-primary-strong uppercase"><AutoAwesomeOutlined sx={{ fontSize: 14 }} /> 轻一点，也能持续向前</span>
          <h1 className="my-[18px] text-[clamp(40px,5vw,64px)] leading-[1.08] tracking-[-0.055em] text-ink max-sm:text-[40px]">
            把每一次完成，<br />变成看得见的进度。
          </h1>
          <p className="max-w-[480px] text-[15px] leading-[1.8] text-ink-2">普通任务一次完成，进度任务逐次推进。今天、本周或全部，任务始终清楚。</p>
        </div>
        <div className="flex flex-wrap gap-2.5 max-sm:grid max-sm:grid-cols-1">
          <span className="flex items-center gap-[7px] rounded-md border border-primary/20 bg-white/55 px-3 py-2 text-[11px] text-ink-2"><CheckOutlined sx={{ fontSize: 14 }} /> 滑动完成或推进</span>
          <span className="flex items-center gap-[7px] rounded-md border border-primary/20 bg-white/55 px-3 py-2 text-[11px] text-ink-2"><LayersOutlined sx={{ fontSize: 14 }} /> 两种任务类型</span>
          <span className="flex items-center gap-[7px] rounded-md border border-primary/20 bg-white/55 px-3 py-2 text-[11px] text-ink-2"><CloudDoneOutlined sx={{ fontSize: 14 }} /> 自动保存到云端</span>
        </div>
      </Box>

      <Box component="section" className="relative grid min-h-svh place-items-center overflow-hidden bg-surface p-12 max-sm:min-h-0 max-sm:px-5 max-sm:pt-8 max-sm:pb-[calc(40px+env(safe-area-inset-bottom))]">
        <div aria-hidden="true" className="absolute -left-20 bottom-12 w-[360px] -rotate-5 rounded-2xl border border-line bg-[#f7f7fc]/90 p-4 opacity-65 shadow-soft max-sm:hidden">
          <div className="flex items-center justify-between gap-2.5 px-[5px] pt-1 pb-3 font-bold text-primary"><span>今日</span><small className="text-[10px] text-muted">3 个任务</small></div>
          <div className="flex min-h-[52px] items-center gap-2.5 border-t border-line bg-surface px-3 text-[11px]"><span className="size-[18px] rounded-[5px] border border-line-strong" /><span>写完产品方案</span><b className="ml-auto font-mono text-[10px]">3 / 5</b></div>
          <div className="flex min-h-[52px] items-center gap-2.5 border-t border-line bg-mint-soft px-3 text-[11px] text-mint-strong"><i className="font-extrabold not-italic">+1</i><span>晨间运动</span><b className="ml-auto font-mono text-[10px]">12 / 20</b></div>
          <div className="flex min-h-[52px] items-center gap-2.5 border-t border-line bg-surface px-3 text-[11px] text-muted"><span className="grid size-[18px] place-items-center rounded-[5px] bg-mint text-white"><CheckOutlined sx={{ fontSize: 14 }} /></span><span>整理桌面</span></div>
        </div>
        <Paper className="relative z-[2] w-[min(100%,390px)] rounded-[18px] bg-white/95 p-8 shadow-panel max-sm:p-6 max-sm:shadow-none" variant="outlined">
          <BrandMark large />
          <Typography component="h2" className="mt-5 mb-2 text-[23px] tracking-[-0.035em] text-ink">登录轻任务</Typography>
          <Typography component="p" className="text-xs leading-[1.65] text-muted">使用 Google 账号登录，你的任务会安全地保存在个人云空间。</Typography>
          <Button className="my-6 grid min-h-12 w-full grid-cols-[22px_1fr_18px] items-center gap-2.5" variant="outlined" onClick={() => void handleSignIn()} disabled={loading}>
            <GoogleMark />
            <span>{loading ? '正在连接…' : '使用 Google 账号登录'}</span>
            <ArrowForwardOutlined sx={{ fontSize: 18 }} />
          </Button>
          {error && <Alert severity="error">{error}</Alert>}
          <small className="mt-3 block text-[9px] leading-[1.55] text-faint">我们只使用登录所需的基本账号信息，不会读取你的 Google 数据。</small>
        </Paper>
      </Box>
    </Box>
  )
}
