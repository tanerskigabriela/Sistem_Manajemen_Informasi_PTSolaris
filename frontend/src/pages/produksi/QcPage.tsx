import { useState } from 'react';
import { Alert, Badge, Button, Input, Select } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { QC_STAGES, produksiApi, typeCodeOf, type QcStageSummary, type StageCode } from '../../lib/api/produksi';
import { formatNumber, formatPercent, formatStatus } from '../../lib/format';
import { parseApiError, toFieldErrorMap } from '../../lib/http';
import { MSG_NON_NEGATIVE, MSG_POSITIVE_NUMBER, nonNegativeNumber, positiveNumber, required, validateForm } from '../../lib/validation';
import { Card, DataTable, PageHeader, today, useLoad, type Col } from '../order/shared';
import { integerNumber, spkLabel, toNumber, useApprovedSpk } from './common';

// SCR-13 Hasil QC (FSD-2.13, mockup Gambar 3.13).
// QC mencatat jumlah barang lolos per SPK, tahap (Cutting s.d. Ironing; Packing tidak ada QC) dan tanggal.
// PPIC dan Pimpinan hanya melihat hasil. Standar QC, jumlah sampel, dan jenis cacat mengikuti KONTRAK v2.

interface DefectRow {
  defect_type_id: string;
  qty: string;
}

export default function QcPage() {
  const { user } = useAuth();
  const canRecord = user?.role_code === 'QC';

  const spkList = useApprovedSpk();
  const [spkId, setSpkId] = useState('');
  const view = useLoad(() => (spkId ? produksiApi.qcResults(spkId) : Promise.resolve(null)), [spkId]);
  const spk = (spkList.data?.rows ?? []).find((s) => s.spk_id === spkId);
  const standards = useLoad(
    () => (canRecord && spk ? produksiApi.qcStandards(typeCodeOf(spk.item_code)) : Promise.resolve([])),
    [canRecord, spk?.item_code],
  );
  const defectTypes = useLoad(() => (canRecord ? produksiApi.defectTypes() : Promise.resolve([])), [canRecord]);

  const [stage, setStage] = useState<StageCode>('CUTTING');
  const [checkDate, setCheckDate] = useState(today());
  const [qty, setQty] = useState('');
  const [standardId, setStandardId] = useState('');
  const [sample, setSample] = useState('');
  const [defects, setDefects] = useState<DefectRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const data = view.data;
  const stageRow = data?.stages.find((s) => s.stage_code === stage);
  const limit = data?.style.reject_limit_pct ?? 0;

  function resetForm() {
    setQty('');
    setSample('');
    setDefects([]);
    setErrors({});
    setFormError(null);
  }

  async function save() {
    const e = validateForm(
      { spk: spkId, check_date: checkDate, standard_id: standardId, qty_passed: qty, sample_qty: sample },
      {
        spk: [required()],
        check_date: [required()],
        standard_id: [required()],
        qty_passed: [required(), nonNegativeNumber(), integerNumber(MSG_NON_NEGATIVE)],
        sample_qty: [positiveNumber(), integerNumber(MSG_POSITIVE_NUMBER)],
      },
    );
    const n = toNumber(qty);
    if (!e.qty_passed && stageRow && n > stageRow.max_passed_input)
      e.qty_passed = `Jumlah lolos melebihi jumlah selesai pada tahap ini (maksimum: ${stageRow.max_passed_input}).`;
    const defectRule = { defect_type_id: [required()], qty: [required(), positiveNumber(), integerNumber(MSG_POSITIVE_NUMBER)] };
    const defectError = defects.map((d) => Object.values(validateForm({ defect_type_id: d.defect_type_id, qty: d.qty }, defectRule))[0]).find(Boolean);
    if (defectError) e.defects = defectError;
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    setFormError(null);
    try {
      const res = await produksiApi.addQcResult(spkId, {
        stage_code: stage,
        check_date: checkDate,
        qty_passed: n,
        standard_id: standardId,
        sample_qty: sample.trim() === '' ? null : toNumber(sample),
        defects: defects.map((d) => ({ defect_type_id: d.defect_type_id, qty: toNumber(d.qty) })),
      });
      setFlash(
        `Hasil QC ${formatStatus(stage)} disimpan. Tidak lolos ${formatNumber(res.data.failed)} (${formatPercent(res.data.failed_pct)}).`,
      );
      resetForm();
      await view.reload();
    } catch (err) {
      const api = parseApiError(err);
      setFormError(api.message);
      setErrors(toFieldErrorMap(api.errors));
    } finally {
      setSaving(false);
    }
  }

  const columns: Col<QcStageSummary>[] = [
    { key: 'tahap', header: 'Tahap', render: (r) => r.stage_name },
    { key: 'selesai', header: 'Selesai', align: 'right', render: (r) => formatNumber(r.cumulative_done) },
    { key: 'lolos', header: 'Lolos', align: 'right', render: (r) => formatNumber(r.cumulative_passed) },
    { key: 'gagal', header: 'Tidak lolos', align: 'right', render: (r) => formatNumber(r.failed) },
    { key: 'pct', header: '%', align: 'right', render: (r) => formatPercent(r.failed_pct) },
    { key: 'batas', header: 'Batas reject', align: 'right', render: () => formatPercent(limit) },
    {
      key: 'tanda',
      header: 'Tanda',
      render: (r) =>
        r.cumulative_done > 0 && r.failed_pct > limit ? <Badge status="MELEBIHI_REJECT" /> : <span className="text-ink-subtle">—</span>,
    },
  ];

  return (
    <div>
      <PageHeader code="SCR-13" title="Hasil QC" subtitle="QC hanya mencatat jumlah barang yang lolos" />

      {flash && <Alert className="mb-4" variant="success" message={flash} onClose={() => setFlash(null)} />}
      {spkList.error && <Alert className="mb-4" variant="danger" title="Gagal memuat SPK" message={spkList.error} onRetry={spkList.reload} />}

      <Card className="mb-5">
        {formError && <Alert className="mb-4" variant="danger" message={formError} />}
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* 1-4 */}
          <Select
            label="SPK (order – style)"
            required
            placeholder={spkList.loading ? 'Memuat...' : 'Pilih SPK'}
            value={spkId}
            onChange={(e) => {
              setSpkId(e.target.value);
              setStandardId('');
              resetForm();
            }}
            options={(spkList.data?.rows ?? []).map((s) => ({ value: s.spk_id, label: spkLabel(s) }))}
            error={errors.spk}
          />
          <Select
            label="Tahap"
            required
            disabled={!canRecord}
            value={stage}
            onChange={(e) => setStage(e.target.value as StageCode)}
            options={QC_STAGES.map((s) => ({ value: s, label: formatStatus(s) }))}
            error={errors.stage_code}
            hint="Packing tidak dicatat hasil QC-nya."
          />
          <Input label="Tanggal" required type="date" disabled={!canRecord} value={checkDate} onChange={(e) => setCheckDate(e.target.value)} error={errors.check_date} />
          <Input
            label="Jumlah lolos"
            required
            type="number"
            min={0}
            disabled={!canRecord}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            error={errors.qty_passed}
          />
        </div>

        {canRecord && (
          <>
            {/* 5. Info selesai kumulatif */}
            <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
              <Input
                label="Selesai kumulatif tahap ini"
                readOnly
                disabled
                value={
                  stageRow
                    ? `${formatNumber(stageRow.cumulative_done)} pcs · lolos sebelumnya ${formatNumber(stageRow.cumulative_passed)} · maksimum diisi ${formatNumber(stageRow.max_passed_input)}`
                    : spkId
                      ? 'Memuat...'
                      : 'Pilih SPK dulu'
                }
              />
              <Select
                label="Standar QC"
                required
                placeholder={spkId ? 'Pilih standar' : 'Pilih SPK dulu'}
                disabled={!spkId}
                value={standardId}
                onChange={(e) => setStandardId(e.target.value)}
                options={(standards.data ?? []).map((s) => ({ value: s.id, label: `${s.parameter_name} (${s.tolerance_value})` }))}
                error={errors.standard_id}
              />
              <Input label="Jumlah sampel" type="number" min={1} value={sample} onChange={(e) => setSample(e.target.value)} error={errors.sample_qty} hint="Opsional" />
            </div>

            {/* Jenis cacat (opsional) */}
            <div className="mt-4 space-y-2">
              <p className="text-[13px] font-bold text-ink">Jenis cacat (opsional)</p>
              {defects.map((d, i) => (
                <div key={i} className="flex flex-wrap items-end gap-3">
                  <Select
                    containerClassName="min-w-56 flex-1"
                    placeholder="Pilih jenis cacat"
                    value={d.defect_type_id}
                    onChange={(e) => setDefects((all) => all.map((x, j) => (j === i ? { ...x, defect_type_id: e.target.value } : x)))}
                    options={(defectTypes.data ?? []).map((t) => ({ value: t.id, label: `${t.defect_name} (${formatStatus(t.level)})` }))}
                  />
                  <Input
                    containerClassName="w-28"
                    type="number"
                    min={1}
                    placeholder="Jumlah"
                    value={d.qty}
                    onChange={(e) => setDefects((all) => all.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                  />
                  <Button variant="ghost" size="sm" onClick={() => setDefects((all) => all.filter((_, j) => j !== i))}>
                    Hapus
                  </Button>
                </div>
              ))}
              {errors.defects && <p className="text-xs font-medium text-danger">{errors.defects}</p>}
              <Button variant="soft" size="sm" onClick={() => setDefects((all) => [...all, { defect_type_id: '', qty: '' }])}>
                + Tambah jenis cacat
              </Button>
            </div>

            {/* 6. Simpan */}
            <div className="mt-4 flex justify-end">
              <Button className="px-8" loading={saving} disabled={!spkId} onClick={save}>
                Simpan
              </Button>
            </div>
          </>
        )}
        {!canRecord && <p className="mt-3 text-xs text-ink-muted">Hanya Quality Control yang dapat mencatat hasil QC.</p>}
      </Card>

      {/* 7. Hasil */}
      {spkId && (
        <Card
          title={
            <span className="flex flex-wrap items-center gap-2">
              Hasil
              {data && (
                <span className="text-sm font-normal text-ink-muted">
                  · reject style {formatPercent(data.style.reject_pct)} dari batas {formatPercent(limit)}
                </span>
              )}
              {data?.style.is_over_reject && <Badge status="MELEBIHI_REJECT" />}
            </span>
          }
        >
          <DataTable
            columns={columns}
            rows={data?.stages ?? []}
            rowKey={(r) => r.stage_code}
            selectedKey={stage}
            loading={view.loading}
            error={view.error}
            onRetry={view.reload}
          />
        </Card>
      )}
    </div>
  );
}
