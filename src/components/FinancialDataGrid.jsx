import React, { useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// ag-grid-community v33+ يتطلب تسجيل الوحدات صراحةً قبل الاستخدام (ClientSideRowModel،
// Pagination، الفلاتر...) — بدونه: أخطاء #239/#200 صامتة بالكونسول والجدول لا يعمل فعلياً.
ModuleRegistry.registerModules([AllCommunityModule]);

export default function FinancialDataGrid() {
  const [rowData] = useState([
    { id: 1, category: 'رواتب الموظفين', amount: 50000, type: 'تشغيلي', status: 'مؤكد' },
    { id: 2, category: 'إيجار العقار', amount: 80000, type: 'تأسيسي', status: 'مؤكد' },
    { id: 3, category: 'معدات تقنية', amount: 15000, type: 'رأسمالي', status: 'تقديري' },
    { id: 4, category: 'حملات تسويقية', amount: 20000, type: 'تشغيلي', status: 'مؤكد' },
    { id: 5, category: 'تراخيص حكومية', amount: 5000, type: 'تأسيسي', status: 'مؤكد' },
  ]);

  const [columnDefs] = useState([
    { field: 'category', headerName: 'البند المالي', sortable: true, filter: true, flex: 1 },
    { field: 'amount', headerName: 'المبلغ (ريال)', sortable: true, filter: 'agNumberColumnFilter' },
    { field: 'type', headerName: 'التصنيف', sortable: true, filter: true },
    { field: 'status', headerName: 'الحالة', sortable: true, filter: true },
  ]);

  return (
    <div>
      <h3 className="m-0 mb-4 text-slate-900 dark:text-white font-bold">قاعدة البيانات المالية التفصيلية</h3>
      <div className="ag-theme-alpine" style={{ height: 300, width: '100%', direction: 'rtl' }}>
        <AgGridReact
          // v33+ Theming API الافتراضي يتعارض مع ملفات CSS القديمة المستوردة أعلاه
          // (خطأ #239) — legacy يبقي الجدول على ag-theme-alpine.css كما هو مصمَّم هنا.
          theme="legacy"
          rowData={rowData}
          columnDefs={columnDefs}
          enableRtl={true}
          pagination={true}
          paginationPageSize={5}
          paginationPageSizeSelector={false}
        />
      </div>
    </div>
  );
}
