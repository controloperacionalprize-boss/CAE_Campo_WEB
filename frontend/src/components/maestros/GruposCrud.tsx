import { useEffect, useMemo, useState } from 'react'
import { NombreActivoCrud } from './NombreActivoCrud'
import { Select } from '../ui/Form'
import { listAllItems } from '../../lib/api'
import type { Empresa, Fundo } from '../../types/api'

type Props = { onChanged?: () => void }

export function GruposCrud({ onChanged }: Props) {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [fundos, setFundos] = useState<Fundo[]>([])

  useEffect(() => {
    void Promise.all([
      listAllItems<Empresa>('/api/v1/empresas', { incluirInactivos: true }),
      listAllItems<Fundo>('/api/v1/fundos', { incluirInactivos: true }),
    ]).then(([e, f]) => {
      setEmpresas(e)
      setFundos(f)
    })
  }, [])

  const empresaMap = useMemo(() => new Map(empresas.map((e) => [e.id, e.razon_social])), [empresas])
  const fundoMap = useMemo(() => new Map(fundos.map((f) => [f.id, f.nombre])), [fundos])

  return (
    <NombreActivoCrud
      title="Grupos"
      description="Equipos de trabajo por empresa o fundo."
      singular="grupo"
      path="/api/v1/grupos"
      onChanged={onChanged}
      extraColumns={[
        {
          header: 'Empresa',
          render: (item) => {
            const id = item.empresa_id as number | null
            return id != null ? empresaMap.get(id) ?? `#${id}` : '—'
          },
        },
        {
          header: 'Fundo',
          render: (item) => {
            const id = item.fundo_id as number | null
            return id != null ? fundoMap.get(id) ?? `#${id}` : '—'
          },
        },
      ]}
      extraFields={[
        {
          key: 'empresa_id',
          label: 'Empresa',
          getValue: (item) =>
            item && item.empresa_id != null ? String(item.empresa_id as number) : '',
          render: (value, onChange) => (
            <Select
              label="Empresa"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Sin empresa"
              options={empresas.map((e) => ({ value: e.id, label: e.razon_social }))}
            />
          ),
          toBody: (value) => ({ empresa_id: value ? Number(value) : null }),
        },
        {
          key: 'fundo_id',
          label: 'Fundo',
          getValue: (item) =>
            item && item.fundo_id != null ? String(item.fundo_id as number) : '',
          render: (value, onChange) => (
            <Select
              label="Fundo"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Sin fundo"
              options={fundos.map((f) => ({ value: f.id, label: f.nombre }))}
            />
          ),
          toBody: (value) => ({ fundo_id: value ? Number(value) : null }),
        },
      ]}
    />
  )
}
