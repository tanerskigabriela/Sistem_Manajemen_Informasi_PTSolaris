import { useMemo, useState } from 'react';
import { Alert, Button, Input, Select, Textarea } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { STAGES, produksiApi, type ProgressEntry, type StageCode, type StageSummary } from '../../lib/api/produksi';
import { formatDate, formatNumber, formatStatus } from '../../lib/format';
import { parseApiError, toFieldErrorMap } from '../../lib/http';
import { MSG_NON_NEGATIVE, nonNegativeNumber, required, validateForm } from '../../lib/validation';
import { Card, DataTable, PageHeader, today, useLoad, type Col } from '../order/shared';
import { integerNumber, spkLabel, toNumber, useApprovedSpk } from './common';

// SCR-12 Progres Harian (FSD-2.12, mockup Gambar 3.12).
// Supervisor mencatat; PPIC, Pimpinan, dan QC hanya melihat panel sisa pekerjaan.
// Satu data per SPK–tahap–tanggal (RB-36). Data yang sudah ada diubah lewat "Ubah Data Lama" (AF-2).

const MSG_VARIANCE = 'Keterangan selisih Cutting wajib diisi.';

export default function ProgresPage() {
  const { user } = useAuth();
  const canRecord = user?.role_code === 'SPV';

  const spkList = useApprovedSpk();
  const [spkId, setSpkId] = useState('');
  const view = useLoad(() => (spkId ? produksiApi.progress(spkId) : Promise.resolve(null)), [spkId]);

  const [stage, setStage] = useState<StageCode>('CUTTING');
  const [workDate, setWorkDate] = useState(today());
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<ProgressEntry | null>(null);
  const [duplicate, setDuplicate] = useState<ProgressEntry | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const data = view.data;
  const stageRow = data?.stages.find((s) => s.stage_code === stage);

  // Kumulatif Cutting setelah data ini disimpan; bila berbeda dari jumlah SPK, keterangan wajib (RB-38)
  const cuttingAfter = useMemo(() => {
    if (!data || stage !== 'CUTTING') return null;
    const n = toNumber(qty);
    if (Number.isNaN(n)) return null;
    const current = data.stages.find((s) => s.stage_code === 'CUTTING')?.cumulative_done ?? 0;
    return current - (editing?.qty_done ?? 0) + n;
  }, [data, stage, qty, editing]);
  const needNote = cuttingAfter !== null && data !== null && cuttingAfter !== data.total_qty;

  function resetForm() {
    setQty('');
    setNote('');
    setEditing(null);
    setDuplicate(null);
    setErrors({});
    setFormError(null);
  }

  function editEntry(entry: ProgressEntry) {
    setEditing(entry);
    setDuplicate(null);
    setStage(entry.stage_code);
    setWorkDate(entry.work_date);
    setQty(String(entry.qty_done));
    setNote(entry.variance_note ?? '');
    setErrors({});
    setFormError(null);
  }

  async function save() {
    const e = validateForm(
      { spk: spkId, work_date: workDate, qty_done: qty, variance_note: note },
      {
        spk: [required()],
        work_date: [required()],
        qty_done: [required(), nonNegativeNumber(), integerNumber(MSG_NON_NEGATIVE)],
        variance_note: needNote ? [required(MSG_VARIANCE)] : [],
      },
    );
    setErrors(e);
    if (Object.keys(e).length > 0) {
      if (e.variance_note && data && cuttingAfter !== null) {
        setFormError(
          `${MSG_VARIANCE.replace('.', '')} karena jumlah Cutting (${formatNumber(cuttingAfter)}) berbeda dari jumlah SPK (${formatNumber(data.total_qty)}).`,
        );
      }
      return;
    }

    setSaving(true);
    setFormError(null);
    setDuplicate(null);
    try {
      const body = { qty_done: toNumber(qty), variance_note: note.trim() || null };
      const res = editing
        ? await produksiApi.updateProgress(editing.id, body)
        : await produksiApi.addProgress(spkId, { stage_code: stage, work_date: workDate, ...body });
      setFlash(
        `Progres ${formatStatus(stage)} ${formatDate(workDate)} ${editing ? 'diubah' : 'disimpan'}. Kumulatif ${formatNumber(res.data.cumulative_done)}, sisa ${formatNumber(res.data.remaining)}.`,
      );
      resetForm();
      await view.reload();
    } catch (err) {
      const api = parseApiError(err);
      setFormError(api.message);
      setErrors(toFieldErrorMap(api.errors));
      if (api.errorCode === 'ERR-PRG-02') {
        setDuplicate(data?.entries.find((x) => x.stage_code === stage && x.work_date === workDate) ?? null);
      }
    } finally {
      setSaving(false);
    }
  }

  const panelColumns: Col<StageSummary>[] = [
    { key: 'tahap', header: 'Tahap', render: (s) => s.stage_name },
    { key: 'spk', header: 'Jumlah SPK', align: 'right', render: () => formatNumber(data?.total_qty ?? 0) },
    { key: 'done', header: 'Kumulatif selesai', align: 'right', render: (s) => formatNumber(s.cumulative_done) },
    { key: 'lolos', header: 'Lolos QC', align: 'right', render: (s) => (s.cumulative_passed === null ? '—' : formatNumber(s.cumulative_passed)) },
    { key: 'sisa', header: 'Sisa', align: 'right', render: (s) => formatNumber(s.remaining) },
  ];

  const entryColumns: Col<ProgressEntry>[] = [
    { key: 'tgl', header: 'Tanggal', render: (x) => formatDate(x.work_date) },
    { key: 'tahap', header: 'Tahap', render: (x) => x.stage_name },
    { key: 'qty', header: 'Jumlah selesai', align: 'right', render: (x) => formatNumber(x.qty_done) },
    { key: 'ket', header: 'Keterangan', render: (x) => x.variance_note ?? '—' },
    { key: 'oleh', header: 'Dicatat oleh', render: (x) => x.recorded_by_name },
    ...(canRecord
      ? [
          {
            key: 'aksi',
            header: 'Aksi',
            render: (x: ProgressEntry) => (
              <button type="button" className="font-semibold text-ink underline hover:text-brand" onClick={() => editEntry(x)}>
                Ubah
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader code="SCR-12" title="Progres Harian" subtitle="Formulir yang sama untuk seluruh tahap" />

      {flash && <Alert className="mb-4" variant="success" message={flash} onClose={() => setFlash(null)} />}
      {formError && (
        <Alert className="mb-4" variant="danger" message={formError}>
          {duplicate && (
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => editEntry(duplicate)}>
              Ubah Data Lama
            </Button>
          )}
        </Alert>
      )}
      {spkList.error && <Alert className="mb-4" variant="danger" title="Gagal memuat SPK" message={spkList.error} onRetry={spkList.reload} />}

      <Card className="mb-5" title={editing ? `Ubah Progres · ${editing.stage_name} ${formatDate(editing.work_date)}` : undefined}>
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* 1-4 */}
          <Select
            label="SPK (order – style)"
            required
            placeholder={spkList.loading ? 'Memuat...' : 'Pilih SPK'}
            value={spkId}
            onChange={(e) => {
              setSpkId(e.target.value);
              resetForm();
            }}
            options={(spkList.data?.rows ?? []).map((s) => ({ value: s.spk_id, label: spkLabel(s) }))}
            error={errors.spk}
          />
          <Select
            label="Tahap"
            required
            disabled={!canRecord || Boolean(editing)}
            value={stage}
            onChange={(e) => setStage(e.target.value as StageCode)}
            options={STAGES.map((s) => ({ value: s, label: formatStatus(s) }))}
          />
          <Input
            label="Tanggal"
            required
            type="date"
            disabled={!canRecord || Boolean(editing)}
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            error={errors.work_date}
          />
          <Input
            label="Jumlah selesai"
            required
            type="number"
            min={0}
            disabled={!canRecord}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            error={errors.qty_done}
            hint={stageRow && stage !== 'CUTTING' ? `Maksimum kumulatif ${formatNumber(stageRow.max_allowed)} (lolos QC tahap sebelumnya)` : undefined}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[3fr_1fr] md:items-start">
          {/* 5. Keterangan selisih Cutting — muncul otomatis */}
          {stage === 'CUTTING' && needNote ? (
            <Textarea
              label="Keterangan selisih Cutting"
              required
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              error={errors.variance_note}
              hint={`Kumulatif Cutting ${formatNumber(cuttingAfter ?? 0)} berbeda dari jumlah SPK ${formatNumber(data?.total_qty ?? 0)}.`}
            />
          ) : (
            <div />
          )}
          {/* 6. Simpan */}
          {canRecord && (
            <div className="flex justify-end gap-2 md:pt-6">
              {editing && (
                <Button variant="secondary" onClick={resetForm}>
                  Batal
                </Button>
              )}
              <Button className="px-8" loading={saving} disabled={!spkId} onClick={save}>
                Simpan
              </Button>
            </div>
          )}
        </div>
        {!canRecord && <p className="mt-3 text-xs text-ink-muted">Hanya Supervisor yang dapat mencatat progres. Anda dapat melihat sisa pekerjaan per tahap.</p>}
      </Card>

      {/* 7. Panel sisa pekerjaan */}
      {spkId && (
        <>
          <Card className="mb-5" title={data ? `${data.spk_no} · ${data.item_code} · ${data.color}` : 'Sisa pekerjaan'}>
            <DataTable
              columns={panelColumns}
              rows={data?.stages ?? []}
              rowKey={(s) => s.stage_code}
              selectedKey={stage}
              loading={view.loading}
              error={view.error}
              onRetry={view.reload}
            />
          </Card>
          <Card title="Riwayat pencatatan">
            <DataTable
              columns={entryColumns}
              rows={data?.entries ?? []}
              rowKey={(x) => x.id}
              selectedKey={editing?.id}
              loading={view.loading}
              error={view.error}
              onRetry={view.reload}
              emptyMessage="Belum ada progres untuk SPK ini."
            />
          </Card>
        </>
      )}
    </div>
  );
}
