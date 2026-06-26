import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, Spinner, Badge } from '../components/ui';
import { parseMedicinesFile, importMedicines } from '../services/importService';
import { exportToExcel } from '../services/exportService';

export default function ImportMedicines() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [parsed, setParsed] = useState(null); // { rows, errors }
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(0);

  function downloadTemplate() {
    exportToExcel('seyada-medicines-template', [
      {
        [t('importMedicines.columnName')]:     'Paracétamol 500mg',
        [t('importMedicines.columnLot')]:      'LOT-2025-001',
        [t('importMedicines.columnPurchase')]: 50,
        [t('importMedicines.columnSale')]:     80,
        [t('importMedicines.columnQuantity')]: 100,
        [t('importMedicines.columnExpiry')]:   '2027-01-01',
      },
    ]);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setDone(0);
    try {
      const result = await parseMedicinesFile(file);
      setParsed(result);
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!parsed?.rows?.length) return;
    setImporting(true);
    try {
      const count = await importMedicines(parsed.rows, user);
      setDone(count);
      setParsed(null);
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-xl font-extrabold text-ink">{t('importMedicines.title')}</h1>

      <Card className="p-5">
        <p className="text-sm text-sub leading-relaxed mb-4">{t('importMedicines.instructions')}</p>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download size={16} /> {t('importMedicines.downloadTemplate')}
          </Button>
          <label className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold bg-primary text-white cursor-pointer hover:bg-primary-dark">
            <Upload size={16} /> {t('importMedicines.uploadFile')}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
          </label>
        </div>

        {parsing && (
          <div className="flex items-center gap-2 mt-4 text-sm text-sub">
            <Spinner /> {t('common.loading')}
          </div>
        )}

        {done > 0 && (
          <div className="flex items-center gap-2 mt-4 text-sm text-primary font-bold">
            <CheckCircle2 size={18} /> {t('importMedicines.importSuccess')} ({done})
          </div>
        )}
      </Card>

      {parsed && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-ink">{t('importMedicines.preview')}</h2>
            <Badge tone="primary">{parsed.rows.length} {t('importMedicines.rowsFound')}</Badge>
          </div>

          {parsed.errors.length > 0 && (
            <div className="mb-3 p-3 bg-danger-soft rounded-lg">
              <div className="flex items-center gap-2 text-xs font-bold text-danger mb-1">
                <AlertCircle size={14} /> {parsed.errors.length} {t('importMedicines.importErrors')}
              </div>
              <ul className="text-[11px] text-danger space-y-0.5">
                {parsed.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    {t('common.date')} {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto border border-line rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-bg sticky top-0">
                <tr>
                  <th className="text-start px-3 py-2">{t('medicines.medicineName')}</th>
                  <th className="text-start px-3 py-2">{t('importMedicines.columnLot')}</th>
                  <th className="text-start px-3 py-2">{t('medicines.quantity')}</th>
                  <th className="text-start px-3 py-2">{t('medicines.salePrice')}</th>
                  <th className="text-start px-3 py-2">{t('medicines.expiryDate')}</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-3 py-1.5 font-semibold">{r.name}</td>
                    <td className="px-3 py-1.5">{r.batchNumber || '—'}</td>
                    <td className="px-3 py-1.5">{r.quantity}</td>
                    <td className="px-3 py-1.5">{r.sellPrice}</td>
                    <td className="px-3 py-1.5">{r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button className="w-full mt-4" onClick={handleImport} disabled={importing || parsed.rows.length === 0}>
            {importing ? <Spinner className="text-white" /> : t('importMedicines.importNow')}
          </Button>
        </Card>
      )}
    </div>
  );
}
