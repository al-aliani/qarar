/**
 * DatabaseCompanyPicker.js — منطق تحويل صفوف ملفات قواعد البيانات (xlsx) لشكل
 * أعمدة جدولي الموردين/المنافسين (schema.js). لا اعتماد على قراءة ملف xlsx حقيقي
 * من القرص: نبني إما كائنات صف بسيطة يدوياً (اختبارات buildSupplierRow/
 * buildCompetitorRow) أو مصنّف exceljs في الذاكرة مباشرة (اختبار كشف صف الرؤوس)،
 * ExcelJS نفسها متاحة أصلاً كاعتمادية للمشروع (لا حاجة موك/mock).
 *
 * تحقّق مباشر على عيّنات حقيقية من ملفات قواعد البيانات الفعلية (لا افتراض):
 * - "الأجهزة الطبية": رؤوس companyName/sectorType/city/phoneNumber/email/cr.
 * - "دليل شركات المقاولات": رؤوس مختلفة تماماً name/phone/email/area/city/
 *   street/main_activity — هذا ما يثبت أن detectColumn لا يفترض اسم عمود ثابت.
 * - "دليل المصانع السعودية": الرؤوس الحقيقية بالصف 6 لا الصف 1 (عنوان مكرر
 *   بالصفوف 2-4) — هذا ما يثبت findHeaderRowNumber/parseWorksheetRows.
 */
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
    buildSupplierRow,
    buildCompetitorRow,
    detectColumn,
    findHeaderRowNumber,
    parseWorksheetRows,
    cleanText
} from '../DatabaseCompanyPicker.js';

// شكل ملف "الأجهزة الطبية" الحقيقي (companyName/sectorType/...)
const rowFileA = {
    companyName: 'شركة تضامن للاستشارات الصيدلية_x000D_\n_x000D_\n',
    companyType: 'مكتب استشاري',
    sectorType: 'أجهزة طبية',
    licenseNumber: 'CO-2023-FO-0002',
    city: 'الرياض',
    phoneNumber: '0557428252',
    email: 'mohammed@atadamun.com',
    scope: 'استشارات تنظيم الأجهزة الطبية',
    cr: '7009305645'
};
const headersFileA = Object.keys(rowFileA);

// شكل ملف "دليل شركات المقاولات" الحقيقي (name/main_activity/... — تسمية مختلفة تماماً)
const rowFileB = {
    name: 'مصنع طابوق البراهيم',
    phone: '8346588',
    email: 'albrahimblock@hotmail.com',
    area: 'المنطقة الشرقية',
    city: 'الدمام',
    street: 'طريق 36451',
    main_activity: 'صنع منتجات المعادن اللافلزية الأخرى'
};
const headersFileB = Object.keys(rowFileB);

describe('DatabaseCompanyPicker: تحويل صف واحد لشكل جدول الموردين', () => {
    it('يبني صف مورد صحيح من ملف بأعمدة companyName/sectorType', () => {
        const supplier = buildSupplierRow(rowFileA, headersFileA);
        expect(supplier.name).toBe('شركة تضامن للاستشارات الصيدلية');
        expect(supplier.supplyNature).toBe('أجهزة طبية');
        expect(supplier.availability).toBe('');
        expect(supplier.avgDeliveryDays).toBe(0);
        expect(supplier.notes).toContain('الرياض');
        expect(supplier.notes).toContain('0557428252');
        expect(supplier.notes).toContain('mohammed@atadamun.com');
        expect(supplier.notes).toContain('7009305645');
    });

    it('ينظّف هروب "_x000D_" الحرفي الموجود فعلياً في ملف الأجهزة الطبية', () => {
        expect(cleanText(rowFileA.companyName)).toBe('شركة تضامن للاستشارات الصيدلية');
    });
});

describe('DatabaseCompanyPicker: تحويل صف واحد لشكل جدول المنافسين', () => {
    it('يبني الاسم فقط ويترك بقية الأعمدة undefined بلا تخمين، وبلا حقل notes (schema.js لا يدعمه)', () => {
        const competitor = buildCompetitorRow(rowFileA, headersFileA);
        expect(competitor.name).toBe('شركة تضامن للاستشارات الصيدلية');
        expect(competitor.strengths).toBeUndefined();
        expect(competitor.weaknesses).toBeUndefined();
        expect(competitor.marketShare).toBeUndefined();
        expect(competitor.estimatedDailyCustomers).toBeUndefined();
        expect(competitor.estimatedAvgTicket).toBeUndefined();
        expect(Object.prototype.hasOwnProperty.call(competitor, 'notes')).toBe(false);
    });
});

describe('DatabaseCompanyPicker: أعمدة مختلفة الأسماء بين ملفين حقيقيين', () => {
    it('يكتشف عمود الاسم وعمود النشاط رغم اختلاف تسميتهما كلياً بين الملفين', () => {
        expect(detectColumn(headersFileA, ['companyname'])).toBe('companyName');
        expect(detectColumn(headersFileB, ['companyname'])).toBeNull();
        expect(detectColumn(headersFileB, ['name'])).toBe('name');

        const supplierA = buildSupplierRow(rowFileA, headersFileA);
        const supplierB = buildSupplierRow(rowFileB, headersFileB);
        expect(supplierA.name).toBe('شركة تضامن للاستشارات الصيدلية');
        expect(supplierB.name).toBe('مصنع طابوق البراهيم');
        expect(supplierB.supplyNature).toBe('صنع منتجات المعادن اللافلزية الأخرى');
        expect(supplierB.notes).toContain('الدمام');
        expect(supplierB.notes).toContain('albrahimblock@hotmail.com');
    });

    it('يرجع null إن لم يطابق أي عمود نمطاً معروفاً (بدل تخمين عمود خاطئ)', () => {
        expect(detectColumn(['foo', 'bar'], ['companyname', 'arabicname'])).toBeNull();
    });
});

describe('DatabaseCompanyPicker: كشف صف الرؤوس الحقيقي وسط عنوان مكرر', () => {
    async function buildWorksheetWithBanner() {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Sheet1');
        sheet.addRow([]); // صف 1 فارغ (كما في الملف الحقيقي)
        const banner = 'دليل المصانع السعودية حسب المركز الوطني';
        sheet.addRow([null, banner, banner, banner]); // صف 2: عنوان مكرر
        sheet.addRow([null, banner, banner, banner]); // صف 3: عنوان مكرر
        sheet.addRow([]); // صف 4 فارغ
        sheet.addRow([null, 'اسم المصنع', 'المنطقة', 'الهاتف']); // صف 5: الرؤوس الحقيقية
        sheet.addRow([null, 'مصنع الاختبار', 'الرياض', '0500000000']); // صف 6: بيانات
        return sheet;
    }

    it('findHeaderRowNumber يتجاوز العنوان المكرر ويلتقط صف الرؤوس الفعلي', async () => {
        const sheet = await buildWorksheetWithBanner();
        expect(findHeaderRowNumber(sheet)).toBe(5);
    });

    it('parseWorksheetRows يستخرج الرؤوس والبيانات الصحيحة متجاهلاً صفوف العنوان', async () => {
        const sheet = await buildWorksheetWithBanner();
        const { headers, rows } = parseWorksheetRows(sheet);
        expect(headers).toEqual(['اسم المصنع', 'المنطقة', 'الهاتف']);
        expect(rows).toHaveLength(1);
        expect(rows[0]['اسم المصنع']).toBe('مصنع الاختبار');
        expect(rows[0]['المنطقة']).toBe('الرياض');

        const supplier = buildSupplierRow(rows[0], headers);
        expect(supplier.name).toBe('مصنع الاختبار');
        expect(supplier.notes).toContain('الرياض');
        expect(supplier.notes).toContain('0500000000');
    });
});
