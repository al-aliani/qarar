import React, { Suspense, lazy } from 'react';
import { AreaChart, BadgeDelta, Divider } from '@tremor/react';
import { motion } from 'framer-motion';
import ScenarioSimulator from './components/ScenarioSimulator';
import LiveCollab from './components/LiveCollab';
import Checkout from './components/Checkout';
import { formatCurrency } from './utils/currency';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';

// تحميل كسول للمكوّنات الثقيلة
const PDFReport = lazy(() => import('./components/PDFReport'));
const LocationAnalysis = lazy(() => import('./components/LocationAnalysis'));
const FinancialDataGrid = lazy(() => import('./components/FinancialDataGrid'));

function CardSkeleton({ height = 200 }) {
  return (
    <div
      className="animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/50"
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
  visible: { y: 0, opacity: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
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
    <Button
      variant="outline"
      size="icon"
      onClick={cycle}
      className="w-10 h-10 rounded-full"
      title="تبديل المظهر"
      aria-label="تبديل المظهر"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </Button>
  );
}

export default function App() {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50/50 dark:bg-[#060c0a] font-cairo">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/80 dark:bg-[#0b1512]/80 border-b border-slate-200 dark:border-slate-800 transition-all">
        <div className="container mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-brand-600 to-brand-500 dark:from-brand-400 dark:to-emerald-300">
              لوحة المستثمر الذكية
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
              دراسة الجدوى - البيانات الحية والتحليل الجغرافي
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <LiveCollab studyId="101" />
            <ThemeToggle />
            <Button onClick={() => window.location.href = '?auth=true'}>
              تسجيل الدخول
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 md:px-8 py-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-12 gap-6"
        >
          
          {/* Top Metrics Bento */}
          <motion.div variants={itemVariants} className="md:col-span-4">
            <Card className="h-full border-t-4 border-t-amber-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-500 text-sm font-medium">إجمالي التكاليف (SAR)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(150000, 'SAR')}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants} className="md:col-span-4">
            <Card className="h-full border-t-4 border-t-emerald-500">
              <CardHeader className="pb-2 flex-row justify-between items-center space-y-0">
                <CardTitle className="text-slate-500 text-sm font-medium">العائد المتوقع (ROI)</CardTitle>
                <BadgeDelta deltaType="increase" size="sm">إيجابي</BadgeDelta>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-slate-900 dark:text-white">
                  34.5%
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants} className="md:col-span-4">
            <Card className="h-full border-t-4 border-t-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-500 text-sm font-medium">فترة الاسترداد المتوقعة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-slate-900 dark:text-white">
                  18 شهر
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Main Chart Section */}
          <motion.div variants={itemVariants} className="md:col-span-8">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>مسار الإيرادات والتكاليف (Break-even)</CardTitle>
              </CardHeader>
              <CardContent>
                <AreaChart
                  className="h-80"
                  data={chartdata}
                  index="year"
                  categories={["الإيرادات المتوقعة", "التكاليف التراكمية"]}
                  colors={["emerald", "red"]}
                  yAxisWidth={80}
                  showAnimation={true}
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* Side Panel for Simulator & PDF */}
          <motion.div variants={itemVariants} className="md:col-span-4 flex flex-col gap-6">
            <Card className="flex-1">
              <CardContent className="pt-6">
                <ScenarioSimulator baseCost={150000} baseRevenue={200000} />
              </CardContent>
            </Card>
            <Suspense fallback={<CardSkeleton height={80} />}>
              <PDFReport />
            </Suspense>
          </motion.div>

          {/* Map and Data Grid (Bento Large Elements) */}
          <motion.div variants={itemVariants} className="md:col-span-7">
            <Card className="h-full overflow-hidden">
              <Suspense fallback={<CardSkeleton height={430} />}>
                <LocationAnalysis />
              </Suspense>
            </Card>
          </motion.div>
          
          <motion.div variants={itemVariants} className="md:col-span-5">
            <Card className="h-full">
              <Suspense fallback={<CardSkeleton height={370} />}>
                <FinancialDataGrid />
              </Suspense>
            </Card>
          </motion.div>

        </motion.div>

        <Divider className="my-10" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex justify-center"
        >
          <Checkout reportId="101" price={199} />
        </motion.div>
      </main>
    </div>
  );
}
