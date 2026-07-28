import { useState } from 'react'
import { ArrowRight, Check, Cloud, Layers3, Sparkles } from 'lucide-react'
import { signInWithGoogle } from '../lib/firebase'

interface LoginScreenProps {
  error: string
  onError: (message: string) => void
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.4a4.7 4.7 0 0 1-2 3.1v2.4h3.2c1.9-1.8 3-4.2 3-7.2Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.5L15.4 17c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.5A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.9A6 6 0 0 1 6.1 12c0-.7.1-1.3.3-1.9V7.6H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.4l3.3-2.5Z" />
      <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.9 5.6l3.3 2.5C7.2 7.8 9.4 6 12 6Z" />
    </svg>
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
    <main className="login-screen">
      <section className="login-intro">
        <div className="brand-lockup"><span className="brand-mark"><Check /></span><span>轻任务</span></div>
        <div className="login-copy">
          <span className="eyebrow"><Sparkles /> 轻一点，也能持续向前</span>
          <h1>把每一次完成，<br />变成看得见的进度。</h1>
          <p>普通任务一次完成，进度任务逐次推进。今天、本周或全部，任务始终清楚。</p>
        </div>
        <div className="login-features">
          <span><Check /> 滑动完成或推进</span>
          <span><Layers3 /> 两种任务类型</span>
          <span><Cloud /> 自动保存到云端</span>
        </div>
      </section>

      <section className="login-card-wrap">
        <div className="login-preview" aria-hidden="true">
          <div className="preview-heading"><span>今日</span><small>3 个任务</small></div>
          <div className="preview-task"><span className="preview-check" /><span>写完产品方案</span><b>3 / 5</b></div>
          <div className="preview-task swiped"><i>+1</i><span>晨间运动</span><b>12 / 20</b></div>
          <div className="preview-task complete"><span className="preview-check"><Check /></span><span>整理桌面</span></div>
        </div>
        <div className="login-card">
          <span className="brand-mark large"><Check /></span>
          <h2>登录轻任务</h2>
          <p>使用 Google 账号登录，你的任务会安全地保存在个人云空间。</p>
          <button type="button" className="google-button" onClick={() => void handleSignIn()} disabled={loading}>
            <GoogleMark />
            <span>{loading ? '正在连接…' : '使用 Google 账号登录'}</span>
            <ArrowRight />
          </button>
          {error && <p className="form-error" role="alert">{error}</p>}
          <small className="privacy-note">我们只使用登录所需的基本账号信息，不会读取你的 Google 数据。</small>
        </div>
      </section>
    </main>
  )
}
