import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ScenarioSimulator from './components/ScenarioSimulator';
import LiveCollab from './components/LiveCollab';
import Checkout from './components/Checkout';
import PDFReport from './components/PDFReport';
import LocationAnalysis from './components/LocationAnalysis';
import FinancialDataGrid from './components/FinancialDataGrid';
import { formatCurrency } from './utils/currency';

const data = [
  { name: 'السنة 1', الإيرادات: 50000, التكاليف: 150000 },
  { name: 'السنة 2', الإيرادات: 120000, التكاليف: 180000 },
  { name: 'السنة 3', الإيرادات: 200000, التكاليف: 210000 },
];

export default function App() {
  return (
    <div style={{ padding: '2rem', background: '#f8fafc', minHeight: '100vh', direction: 'rtl' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>لوحة المستثمر الذكية</h1>
          <p style={{ color: '#64748b', margin: '0.5rem 0 0' }}>دراسة الجدوى - البيانات الحية والتحليل الجغرافي</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <LiveCollab studyId="101" />
          <button onClick={() => window.location.href = '?auth=true'} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>تسجيل الدخول</button>
        </div>
      </header>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRight: '4px solid #f59e0b' }}>
          <h3 style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 0.5rem' }}>إجمالي التكاليف (SAR)</h3>
          <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{formatCurrency(150000, 'SAR')}</p>
        </div>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRight: '4px solid #10b981' }}>
          <h3 style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 0.5rem' }}>العائد المتوقع (ROI)</h3>
          <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#10b981', margin: 0 }}>+34.5%</p>
        </div>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRight: '4px solid #3b82f6' }}>
          <h3 style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 0.5rem' }}>فترة الاسترداد المتوقعة</h3>
          <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#3b82f6', margin: 0 }}>18 شهر</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', height: '420px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginBottom: '1.5rem', color: '#1e293b', fontSize: '1.25rem' }}>مسار الإيرادات والتكاليف</h2>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
              <Legend verticalAlign="top" height={36}/>
              <Line type="monotone" name="الإيرادات المتوقعة" dataKey="الإيرادات" stroke="#10b981" strokeWidth={4} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
              <Line type="monotone" name="التكاليف التراكمية" dataKey="التكاليف" stroke="#ef4444" strokeWidth={3} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <ScenarioSimulator baseCost={150000} baseRevenue={200000} />
          <PDFReport />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <LocationAnalysis />
        <FinancialDataGrid />
      </div>

      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '2rem', display: 'flex', justifyContent: 'center' }}>
        <Checkout reportId="101" price={199} />
      </div>
    </div>
  );
}
