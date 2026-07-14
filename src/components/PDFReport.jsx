import React from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer';

// Create styles
const styles = StyleSheet.create({
  page: { padding: 30, backgroundColor: '#ffffff' },
  section: { margin: 10, padding: 10, flexGrow: 1, border: '1pt solid #cbd5e1' },
  header: { fontSize: 24, marginBottom: 20, textAlign: 'center', color: '#0f172a' },
  text: { fontSize: 14, marginBottom: 10, color: '#334155' },
});

// Document Component
const FeasibilityDocument = () => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text style={styles.header}>Feasibility Study Report (Demo)</Text>
        <Text style={styles.text}>Project Name: Al-Narjis Cafe</Text>
        <Text style={styles.text}>Expected Revenue: $200,000</Text>
        <Text style={styles.text}>Expected Costs: $150,000</Text>
        <Text style={styles.text}>ROI: 33.3%</Text>
        <Text style={styles.text}>Break-even: 18 Months</Text>
      </View>
    </Page>
  </Document>
);

export default function PDFReport() {
  return (
    <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '2px dashed #cbd5e1' }}>
      <h3 style={{ color: '#0f172a', marginBottom: '1rem' }}>تصدير التقرير الفوري للطباعة (Client-Side)</h3>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>توليد الـ PDF يتم بالكامل داخل متصفحك للحفاظ على الخصوصية والسرعة.</p>
      <PDFDownloadLink document={<FeasibilityDocument />} fileName="feasibility_report.pdf" style={{ textDecoration: 'none', padding: '0.75rem 1.5rem', background: '#ef4444', color: 'white', borderRadius: '8px', fontWeight: 'bold', display: 'inline-block' }}>
        {({ blob, url, loading, error }) =>
          loading ? 'جاري التجهيز...' : 'تحميل بصيغة PDF 📄'
        }
      </PDFDownloadLink>
    </div>
  );
}
