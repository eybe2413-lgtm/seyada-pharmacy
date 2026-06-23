import * as XLSX from 'xlsx';
import { writeBatch, collection, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { computeLowStock } from './medicineService';
import { logAction } from './auditService';

const HEADER_MAP = {
  name:          ['name', 'medicine name', 'اسم الدواء', 'الاسم التجاري', 'nom', 'nom du médicament', 'nom du medicament', 'nom commercial'],
  batchNumber:   ['lot', 'lot number', 'رقم اللوت', 'رقم الدفعة', 'numéro de lot', 'numero de lot', 'batch', 'batch number'],
  purchasePrice: ['purchase price', 'سعر الشراء', "prix d'achat", 'prix achat'],
  salePrice:     ['sale price', 'سعر البيع', 'prix de vente', 'prix vente'],
  quantity:      ['quantity', 'الكمية', 'quantité', 'quantite'],
  expiryDate:    ['expiry date', 'تاريخ الانتهاء', "date d'expiration", 'date expiration', 'date de péremption', 'date de peremption'],
};

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase();
}

function buildColumnIndex(headerRow) {
  const index = {};
  headerRow.forEach((raw, i) => {
    const norm = normalizeHeader(raw);
    for (const [field, variants] of Object.entries(HEADER_MAP)) {
      if (variants.includes(norm)) index[field] = i;
    }
  });
  return index;
}

function parseExcelDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // Excel serial date
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function parseMedicinesFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
  if (rows.length < 2) return { rows: [], errors: [{ row: 0, message: 'الملف فارغ' }] };

  const colIndex = buildColumnIndex(rows[0]);
  if (colIndex.name === undefined) {
    return { rows: [], errors: [{ row: 0, message: 'لم يتم العثور على عمود اسم الدواء — تحقق من رؤوس الأعمدة' }] };
  }

  const parsed = [];
  const errors = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => c === undefined || c === '')) continue;
    const name = r[colIndex.name];
    if (!name) {
      errors.push({ row: i + 1, message: 'اسم الدواء مفقود' });
      continue;
    }
    const quantity     = colIndex.quantity      !== undefined ? Number(r[colIndex.quantity])      || 0  : 0;
    const sellPrice    = colIndex.salePrice     !== undefined ? Number(r[colIndex.salePrice])     || 0  : 0;
    const costPrice    = colIndex.purchasePrice !== undefined ? Number(r[colIndex.purchasePrice]) || 0  : 0;
    const batchNumber  = colIndex.batchNumber   !== undefined ? String(r[colIndex.batchNumber]   || '').trim() : '';
    const expiryRaw    = colIndex.expiryDate    !== undefined ? r[colIndex.expiryDate] : null;
    const expiryDate   = parseExcelDate(expiryRaw);

    parsed.push({
      rowNumber: i + 1,
      name: String(name).trim(),
      batchNumber,
      quantity,
      sellPrice,
      costPrice,
      expiryDate,
    });
  }

  return { rows: parsed, errors };
}

// Writes in batches of 400 (under Firestore's 500-write cap per batch) so a
// 10,000-row catalog import doesn't exceed any single batch limit.
export async function importMedicines(rows, user) {
  const BATCH_SIZE = 400;
  let imported = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((row) => {
      const ref = doc(collection(db, 'medicines'));
      const lowStockThreshold = 10;
      batch.set(ref, {
        name: row.name,
        name_lower: row.name.toLowerCase(),
        scientificName: '',
        scientificName_lower: '',
        category: '',
        barcode: '',
        batchNumber: row.batchNumber || '',
        supplier: '',
        quantity: row.quantity,
        sellPrice: row.sellPrice,
        costPrice: row.costPrice,
        lowStockThreshold,
        isLowStock: computeLowStock(row.quantity, lowStockThreshold),
        expiryDate: row.expiryDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
    imported += chunk.length;
  }
  logAction({ user, action: 'medicines.import', target: `${imported} دواء`, details: 'استيراد من Excel' });
  return imported;
}
