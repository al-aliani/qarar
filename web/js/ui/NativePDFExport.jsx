import React from 'react';
import { pdf, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register Arabic font if possible, or fallback to standard
Font.register({
  family: 'Cairo',
  src: 'https://fonts.gstatic.com/s/cairo/v28/SLXVc1nY6HkvangtZmpQdOQD.ttf' // direct link to ttf
});

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Cairo'
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    color: '#1a56db'
  },
  text: {
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'right'
  }
});

const FeasibilityReport = ({ studyData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text style={styles.header}>تقرير دراسة الجدوى</Text>
        <Text style={styles.text}>اسم المشروع: {studyData?.projectInfo?.name || 'غير محدد'}</Text>
        <Text style={styles.text}>القطاع: {studyData?.projectInfo?.sector || 'غير محدد'}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.header}>الخلاصة المالية</Text>
        <Text style={styles.text}>صافي القيمة الحالية (NPV): {studyData?.results?.indicators?.npv || 0}</Text>
        <Text style={styles.text}>معدل العائد الداخلي (IRR): {studyData?.results?.indicators?.irr || 0}%</Text>
      </View>
    </Page>
  </Document>
);

export async function generateNativePDF(studyData) {
  try {
    const blob = await pdf(<FeasibilityReport studyData={studyData} />).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_دراسة_الجدوى_${studyData?.projectInfo?.name || 'جديد'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Failed to generate native PDF:', error);
    throw error;
  }
}
