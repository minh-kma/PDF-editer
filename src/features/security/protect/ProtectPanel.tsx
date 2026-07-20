import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../../shared/components/Modal'
import { useStore } from '../../../shared/state/store'
import { buildPdf } from '../../page-management/workspace/buildPdf'
import { protectPdf } from './protectPdf'
import { ShieldIcon, EyeIcon, EyeOffIcon, LockIcon } from '../../../shared/components/icons'

interface ProtectPanelProps {
  baseName: string
  onClose: () => void
  onError: (message: string) => void
  /** Hand the protected PDF back to the app to preview (never auto-download). */
  onProtected: (bytes: Uint8Array, fileName: string) => void
}

/**
 * Password-entry form for Protect PDF (D8: user password only — protectPdf.ts
 * sets the owner password equal to it internally).
 *
 * Deliberately its own small form rather than a PasswordPrompt.tsx mode
 * variant: that component verifies an EXISTING password (one field, a
 * wrong-password retry loop, "Skip this file" semantics). This one collects
 * a NEW password with confirmation (two fields, mismatch validation, no
 * retry loop, different copy/labels throughout). The two forms only share
 * the Modal shell and input styling, which they already do — folding them
 * into one component behind a mode flag would mean more branching than
 * either form has on its own.
 */
export function ProtectPanel({ baseName, onClose, onError, onProtected }: ProtectPanelProps) {
  const { t } = useTranslation(['protect', 'common'])
  const { sources, pages, docAnnotations, assets, setBusy } = useStore()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState(false)
  const [working, setWorking] = useState(false)
  const [touched, setTouched] = useState(false)

  const empty = password.trim().length === 0
  const mismatch = !empty && password !== confirm

  async function handleProtect() {
    setTouched(true)
    if (empty || mismatch) return

    try {
      setWorking(true)
      setBusy(true, t('panel.working'))
      const assembled = await buildPdf(sources, pages, { docAnnotations, assets })
      const protectedBytes = await protectPdf(assembled, password)
      onProtected(protectedBytes, `${baseName}_protected.pdf`)
    } catch {
      // Logic-layer errors stay English as diagnostics; show a translated one.
      onError(t('panel.failed'))
    } finally {
      setWorking(false)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('panel.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={working}>
            {t('common:cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={handleProtect} disabled={working}>
            <LockIcon width={18} height={18} />
            {working ? t('panel.working') : t('panel.button')}
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">{t('panel.intro')}</p>

      <label className="mt-4 block text-sm font-bold text-ink" htmlFor="protect-password">
        {t('panel.password')}
      </label>
      <div className="relative mt-1">
        <input
          id="protect-password"
          type={visible ? 'text' : 'password'}
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={working}
          className="w-full rounded-xl border border-brand-100 bg-white px-3 py-2.5 pr-10 font-semibold outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          title={visible ? t('prompt.hidePassword') : t('prompt.showPassword')}
          aria-label={visible ? t('prompt.hidePassword') : t('prompt.showPassword')}
          disabled={working}
          className="icon-btn absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-soft hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {visible ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
        </button>
      </div>

      <label className="mt-3 block text-sm font-bold text-ink" htmlFor="protect-password-confirm">
        {t('panel.confirm')}
      </label>
      <input
        id="protect-password-confirm"
        type={visible ? 'text' : 'password'}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleProtect()}
        disabled={working}
        className="mt-1 w-full rounded-xl border border-brand-100 bg-white px-3 py-2.5 font-semibold outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
      />

      {touched && empty && (
        <p className="mt-1.5 text-xs font-semibold text-red-600">{t('panel.enterPassword')}</p>
      )}
      {touched && mismatch && (
        <p className="mt-1.5 text-xs font-semibold text-red-600">{t('panel.mismatch')}</p>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-xs text-ink-faint">
        <ShieldIcon width={14} height={14} className="mt-0.5 flex-none text-brand-400" />
        {t('common:privacyFull')}
      </p>
    </Modal>
  )
}
