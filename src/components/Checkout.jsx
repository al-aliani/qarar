import React, { useState } from 'react';

export default function Checkout({ reportId, price = 100 }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'success' or 'error'

  const handlePayment = async () => {
    setLoading(true);
    try {
      // Mocking a call to payment_service.py API
      const res = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: price, reportId })
      });
      const data = await res.json();
      setStatus(data.success ? 'success' : 'error');
    } catch (error) {
      setStatus('error');
    }
    setLoading(false);
  };

  if (status === 'success') {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', background: '#ecfdf5', borderRadius: '12px' }}>
        <h3 style={{ color: '#065f46' }}>✅ الدفع ناجح!</h3>
        <p>يمكنك الآن تحميل تقرير دراسة الجدوى الخاص بك.</p>
        <button style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '1rem' }}>تحميل التقرير</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxWidth: '400px', margin: 'auto' }}>
      <h3 style={{ margin: '0 0 1rem', color: '#0f172a' }}>شراء دراسة الجدوى</h3>
      <p style={{ color: '#475569', marginBottom: '2rem' }}>للوصول إلى التقرير النهائي المفصل، يرجى إتمام عملية الدفع. التكلفة: <strong>{price}$</strong></p>
      
      <button 
        onClick={handlePayment} 
        disabled={loading}
        style={{ width: '100%', padding: '0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
      >
        {loading ? 'جاري المعالجة...' : 'ادفع الآن بشكل آمن'}
      </button>
    </div>
  );
}
