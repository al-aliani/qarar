import React, { useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

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
    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h3 style={{ margin: '0 0 1rem', color: '#1e293b' }}>قاعدة البيانات المالية التفصيلية 📊</h3>
      <div className="ag-theme-alpine" style={{ height: 300, width: '100%', direction: 'rtl' }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          enableRtl={true}
          pagination={true}
          paginationPageSize={5}
        />
      </div>
    </div>
  );
}
