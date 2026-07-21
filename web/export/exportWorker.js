import { WordExporter } from './wordExporter.js';
import { ExcelExporter } from './excelExporter.js';
import { PPTXExporter } from './pptxExporter.js';

// Worker needs a mock store that just returns the state
class MockStore {
    constructor(state) {
        this.state = state;
    }
    getState() {
        return this.state;
    }
}

self.onmessage = async (e) => {
    const { type, state, options } = e.data;
    const store = new MockStore(state);
    
    try {
        let result;
        if (type === 'word') {
            const exporter = new WordExporter(store);
            result = await exporter.export();
        } else if (type === 'excel') {
            const exporter = new ExcelExporter(store);
            result = await exporter.export(options);
        } else if (type === 'pptx') {
            const exporter = new PPTXExporter(store);
            result = await exporter.export();
        } else if (type === 'batch_zip') {
            const JSZip = (await import('jszip')).default || await import('jszip');
            const zip = new JSZip();
            
            // 1. Generate Word
            const wordExporter = new WordExporter(store);
            const wordResult = await wordExporter.export();
            if (wordResult.success) zip.file(wordResult.fileName, wordResult.blob);
            
            // 2. Generate Excel
            const excelExporter = new ExcelExporter(store);
            const excelResult = await excelExporter.export(options);
            if (excelResult.blob) zip.file(excelResult.fileName, excelResult.blob);
            
            // 3. Generate PPTX
            const pptxExporter = new PPTXExporter(store);
            const pptxResult = await pptxExporter.export();
            if (pptxResult.success) zip.file(pptxResult.fileName, pptxResult.blob);
            
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            
            const { sanitizeFilename } = await import('./utils.js');
            const projName = state.projectInfo?.name || 'دراسة_جدوى';
            result = {
                blob: zipBlob,
                fileName: `حزمة_تصدير_${sanitizeFilename(projName)}.zip`
            };
        } else {
            throw new Error(`Unsupported export type in worker: ${type}`);
        }
        
        self.postMessage({
            status: 'success',
            blob: result.blob,
            fileName: result.fileName
        });
    } catch (error) {
        self.postMessage({
            status: 'error',
            error: error.message || String(error)
        });
    }
};
