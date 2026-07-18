import { useState } from 'react'
import { Modal } from './Modal'
import { ShieldIcon, EyeIcon, EyeOffIcon } from './icons'

interface PasswordPromptProps {
  /** Name of the protected file we need a password for. */
  fileName: string
  /** Show an "incorrect password" hint after a failed attempt. */
  wrongPassword?: boolean
  /** True while the entered password is being tried (decrypting). */
  busy?: boolean
  onSubmit: (password: string) => void
  /** Skip this file and continue with the rest of the batch. */
  onCancel: () => void
}

/**
 * Presentational prompt only — the caller owns the decrypt + retry loop and
 * toggles `wrongPassword` / `busy`. Closing (Esc / backdrop / Skip) cancels.
 */
export function PasswordPrompt({
  fileName,
  wrongPassword,
  busy,
  onSubmit,
  onCancel,
}: PasswordPromptProps) {
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)

  function submit() {
    if (!busy) onSubmit(password)
  }

  return (
    <Modal
      title="This PDF is password-protected"
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            Skip this file
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">
        <strong className="text-ink">{fileName}</strong> needs a password before it can be edited.
        It’s unlocked here on your device — the password is never sent anywhere.
      </p>

      <label className="mt-4 block text-sm font-bold text-ink" htmlFor="pdf-password">
        Password
      </label>
      <div className="relative mt-1">
        <input
          id="pdf-password"
          type={visible ? 'text' : 'password'}
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          disabled={busy}
          className="w-full rounded-xl border border-brand-100 bg-white px-3 py-2.5 pr-10 font-semibold outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          title={visible ? 'Hide password' : 'Show password'}
          aria-label={visible ? 'Hide password' : 'Show password'}
          disabled={busy}
          className="icon-btn absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-soft hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {visible ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
        </button>
      </div>
      {wrongPassword && (
        <p className="mt-1.5 text-xs font-semibold text-red-600">
          That password didn’t work — please try again.
        </p>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-xs text-ink-faint">
        <ShieldIcon width={14} height={14} className="mt-0.5 flex-none text-brand-400" />
        Everything happens in your browser. Nothing is uploaded to any server.
      </p>
    </Modal>
  )
}
