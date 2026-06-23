import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ELEMENT_ID = 'seyada-barcode-reader';

export default function BarcodeScannerModal({ open, onClose, onDetected }) {
  const { t } = useTranslation();
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const scanner = new Html5Qrcode(ELEMENT_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          if (cancelled) return;
          onDetected(decodedText);
        },
        () => {} // ignore per-frame decode failures
      )
      .catch((err) => {
        console.warn('camera start failed', err);
      });

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => scannerRef.current.clear()).catch(() => {});
      }
    };
  }, [open, onDetected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl2 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="font-bold text-sm text-ink">{t('sales.scanOrSearch')}</span>
          <button onClick={onClose} className="text-sub hover:text-ink">
            <X size={20} />
          </button>
        </div>
        <div id={ELEMENT_ID} className="w-full" />
        <p className="text-[11px] text-sub text-center py-2 px-3">{t('sales.scanHint')}</p>
      </div>
    </div>
  );
}
