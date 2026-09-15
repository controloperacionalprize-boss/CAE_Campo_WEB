import { useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { Button } from './Button'

export function ExportExcelButton({
  onExport,
  disabled,
  label = 'Excel',
}: {
  onExport: () => void | Promise<void>
  disabled?: boolean
  label?: string
}) {
  const [busy, setBusy] = useState(false)

  return (
    <Button
      type="button"
      variant="secondary"
      leftIcon={<FileSpreadsheet className="size-3.5" />}
      loading={busy}
      disabled={disabled || busy}
      title="Exportar a Excel"
      onClick={() => {
        setBusy(true)
        void Promise.resolve(onExport()).finally(() => setBusy(false))
      }}
    >
      {label}
    </Button>
  )
}
