import { WordExporter } from './wordExporter.js';
import { ExcelExporter } from './excelExporter.js';
import { PPTXExporter } from './pptxExporter.js';
import { calculateStudy } from '../js/core/engine.js';

// WordExporter/PPTXExporter يقبلان store ويستدعيان getState() داخلياً؛ أما ExcelExporter
// فتوقيعه (studyData, financialResults, options) ولا يستدعي getState — لذا نمرّر له الحالة
// والنتائج المحسوبة صراحةً، وإلا خرج مصنّف فارغ (كان يُمرَّر له الـstore بالخطأ).
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
            result = await new WordExporter(store, options).export();
        } else if (type === 'excel') {
            result = await new ExcelExporter(state, calculateStudy(state), options).export();
        } else if (type === 'pptx') {
            result = await new PPTXExporter(store).export();
        } else if (type === 'batch_zip') {
            const JSZip = (await import('jszip')).default || await import('jszip');
            const zip = new JSZip();
            const results = calculateStudy(state);

            const wordResult = await new WordExporter(store, options).export();
            if (wordResult.blob) zip.file(wordResult.fileName, wordResult.blob);

            const excelResult = await new ExcelExporter(state, results, options).export();
            if (excelResult.blob) zip.file(excelResult.fileName, excelResult.blob);

            const pptxResult = await new PPTXExporter(store).export();
            if (pptxResult.blob) zip.file(pptxResult.fileName, pptxResult.blob);

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

        if (!result || !result.blob) {
            self.postMessage({ status: 'error', error: 'لم يُنتج التصدير ملفاً صالحاً' });
            return;
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
