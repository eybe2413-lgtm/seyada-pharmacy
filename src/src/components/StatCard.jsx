import React from 'react';

export default function StatCard({ icon: Icon, label, value, tone = 'primary', sub }) {
  const tones = {
    primary: 'bg-primary text-white',
    soft: 'bg-white text-ink border border-line',
    accent: 'bg-accent text-white',
    danger: 'bg-danger text-white',
  };
  const isFilled = tone === 'primary' || tone === 'accent' || tone === 'danger';
  return (
    <div className={`rounded-xl2 p-5 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-semibold ${isFilled ? 'text-white/80' : 'text-sub'}`}>{label}</span>
        {Icon && (
          <div className={`p-2 rounded-lg ${isFilled ? 'bg-white/15' : 'bg-primary-soft'}`}>
            <Icon size={16} className={isFilled ? 'text-white' : 'text-primary'} />
          </div>
        )}
      </div>
      <div className="text-2xl font-extrabold">{value}</div>
      {sub && <div className={`text-[11px] mt-1 ${isFilled ? 'text-white/70' : 'text-sub'}`}>{sub}</div>}
    </div>
  );
}
