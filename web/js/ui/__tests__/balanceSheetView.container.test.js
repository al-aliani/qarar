/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BalanceSheetView } from '../BalanceSheetView.js';

describe('BalanceSheetView container resolution', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('does not throw when rendered before its container exists', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const view = new BalanceSheetView('late-container', {}, null);

        expect(() => view.render([])).not.toThrow();
        expect(warn).toHaveBeenCalledWith('BalanceSheetView: container not found (late-container)');

        warn.mockRestore();
    });

    it('re-resolves the container when it appears after construction', () => {
        const view = new BalanceSheetView('late-container', {}, null);
        document.body.innerHTML = '<main id="late-container"></main>';

        expect(() => view.render([])).not.toThrow();
        expect(document.querySelector('#late-container .empty-state')).not.toBeNull();
    });
});
