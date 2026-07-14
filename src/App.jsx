import React, { Suspense, lazy } from 'react';
import { Card, Metric, Text, AreaChart, BadgeDelta, Flex, Grid, Title, Divider } from '@tremor/react';
import { motion } from 'framer-motion';
import ScenarioSimulator from './components/ScenarioSimulator';
import LiveCollab from './components/LiveCollab';
import Checkout from './components/Checkout';
import { formatCurrency } from './utils/currency';

// تحميل كسول للمكوّنات الثقيلة (react-pdf/renderer، react-leaflet+leaflet،
// ag-grid) — كانت الثلاثة تُحمَّل بشكل ساكن فتُدمَج في حزمة dashboard واحدة
// (~3.4MB قبل الضغط)، رغم أنها ليست فوق الطية ولا تحتاج فوراً عند أول رسم.
const PDFReport = lazy(() => import('./components/PDFReport'));
const LocationAnalysis = lazy(() => import('./components/LocationAnalysis'));
const FinancialDataGrid = lazy(() => import('./components/FinancialDataGrid'));

function CardSkeleton({ height = 200 }) {
  return (
    <div
      className="animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
      style={{ height }}
    />
  );
}

const chartdata = [
  { year: 'السنة 1', "الإيرادات المتوقعة": 50000, "التكاليف التراكمية": 150000 },
  { year: 'السنة 2', "الإيرادات المتوقعة": 120000, "التكاليف التراكمية": 180000 },
  { year: 'السنة 3', "الإيرادات المتوقعة": 200000, "التكاليف التراكمية": 210000 },
  { year: 'السنة 4', "الإيرادات المتوقعة": 310000, "التكاليف التراكمية": 240000 },
  { year: 'السنة 5', "الإيرادات المتوقعة": 450000, "التكاليف التراكمية": 270000 },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.5, ease: "easeOut" } }
};

function ThemeToggle() {
  const [theme, setTheme] = React.useState(
    () => document.documentElement.getAttribute('data-theme') || 'light'
  );

  const cycle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('feas_theme', next);
    document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
  };

  return (
    <button
      onClick={cycle}
      className="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-brand-600 dark:text-brand-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      title="تبديل المظهر"
      aria-label="تبديل المظهر"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

export default function App() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-8 min-h-screen bg-slate-50 dark:bg-brand-darkBg"
      dir="rtl"
    >
      <motion.div variants={itemVariants} className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <div>
          <Title className="text-3xl font-bold text-slate-900 dark:text-white">لوحة المستثمر الذكية</Title>
          <Text>دراسة الجدوى - البيانات الحية والتحليل الجغرافي</Text>
        </div>
        <div className="flex gap-4 items-center">
          <LiveCollab studyId="101" />
          <ThemeToggle />
          <button onClick={() => window.location.href = '?auth=true'} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition-colors">
            تسجيل الدخول
          </button>
        </div>
      </motion.div>
      
      <Grid numItemsSm={1} numItemsLg={3} className="gap-6 mb-8">
        <motion.div variants={itemVariants}>
          <Card decoration="top" decorationColor="amber">
            <Text>إجمالي التكاليف (SAR)</Text>
            <Metric>{formatCurrency(150000, 'SAR')}</Metric>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card decoration="top" decorationColor="emerald">
            <Flex alignItems="start">
              <div>
                <Text>العائد المتوقع (ROI)</Text>
                <Metric>34.5%</Metric>
              </div>
              <BadgeDelta deltaType="increase">إيجابي</BadgeDelta>
            </Flex>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card decoration="top" decorationColor="blue">
            <Text>فترة الاسترداد المتوقعة</Text>
            <Metric>18 شهر</Metric>
          </Card>
        </motion.div>
      </Grid>

      <Grid numItemsSm={1} numItemsLg={3} className="gap-6 mb-8">
        <motion.div variants={itemVariants} className="col-span-1 lg:col-span-2">
          <Card className="h-full">
            <Title>مسار الإيرادات والتكاليف (Break-even)</Title>
            <AreaChart
              className="h-80 mt-4"
              data={chartdata}
              index="year"
              categories={["الإيرادات المتوقعة", "التكاليف التراكمية"]}
              colors={["emerald", "red"]}
              yAxisWidth={80}
            />
          </Card>
        </motion.div>
        
        <motion.div variants={itemVariants} className="flex flex-col gap-6">
          <Card>
            <ScenarioSimulator baseCost={150000} baseRevenue={200000} />
          </Card>
          <Suspense fallback={<CardSkeleton height={80} />}>
            <PDFReport />
          </Suspense>
        </motion.div>
      </Grid>

      <Grid numItemsSm={1} numItemsLg={2} className="gap-6 mb-8">
        <motion.div variants={itemVariants}>
          <Card>
            <Suspense fallback={<CardSkeleton height={430} />}>
              <LocationAnalysis />
            </Suspense>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <Suspense fallback={<CardSkeleton height={370} />}>
              <FinancialDataGrid />
            </Suspense>
          </Card>
        </motion.div>
      </Grid>

      <Divider />
      
      <motion.div variants={itemVariants} className="flex justify-center py-4">
        <Checkout reportId="101" price={199} />
      </motion.div>
    </motion.div>
  );
}
