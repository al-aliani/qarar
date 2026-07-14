import React, { useState } from 'react';

export default function ScenarioSimulator({ baseCost = 100000, baseRevenue = 150000 }) {
  const [costMultiplier, setCostMultiplier] = useState(1);
  const [revenueMultiplier, setRevenueMultiplier] = useState(1);

  const currentCost = baseCost * costMultiplier;
  const currentRevenue = baseRevenue * revenueMultiplier;
  const profit = currentRevenue - currentCost;
  const roi = ((profit / currentCost) * 100).toFixed(1);

  return (
    <div style={{ padding: '1.5rem', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', direction: 'rtl' }}>
      <h3 style={{ color: '#0f172a', marginBottom: '1rem' }}>محاكي السيناريوهات (ماذا لو؟)</h3>
      
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569' }}>
          تغير التكاليف: {Math.round((costMultiplier - 1) * 100)}%
        </label>
        <input 
          type="range" min="0.5" max="1.5" step="0.05" 
          value={costMultiplier} 
          onChange={e => setCostMultiplier(Number(e.target.value))} 
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569' }}>
          تغير الإيرادات: {Math.round((revenueMultiplier - 1) * 100)}%
        </label>
        <input 
          type="range" min="0.5" max="1.5" step="0.05" 
          value={revenueMultiplier} 
          onChange={e => setRevenueMultiplier(Number(e.target.value))} 
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ padding: '1rem', background: profit >= 0 ? '#ecfdf5' : '#fef2f2', borderRadius: '8px', borderLeft: `4px solid ${profit >= 0 ? '#10b981' : '#ef4444'}` }}>
        <h4 style={{ margin: 0, color: profit >= 0 ? '#065f46' : '#991b1b' }}>النتيجة المتوقعة:</h4>
        <p style={{ margin: '0.5rem 0 0', fontWeight: 'bold', fontSize: '1.25rem', color: profit >= 0 ? '#10b981' : '#ef4444' }}>
          العائد: {roi}% ({profit > 0 ? '+' : ''}{profit.toLocaleString()} ريال)
        </p>
      </div>
    </div>
  );
}
