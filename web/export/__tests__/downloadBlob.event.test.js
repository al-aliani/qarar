/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from '../utils.js';

describe('downloadBlob', () => {
    beforeEach(() => {
        global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        global.URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('dispatches a download event with file metadata', () => {
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        const listener = vi.fn();
        window.addEventListener('feasibility:download', listener);

        const blob = new Blob(['a,b\n1,2'], { type: 'text/csv;charset=utf-8' });
        downloadBlob(blob, 'summary.csv');

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].detail).toMatchObject({
            filename: 'summary.csv',
            mimeType: 'text/csv;charset=utf-8',
            size: blob.size
        });

        window.removeEventListener('feasibility:download', listener);
    });
});
