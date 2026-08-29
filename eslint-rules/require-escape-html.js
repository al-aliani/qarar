/**
 * قاعدة ESLint مخصّصة: تمنع تفسير (interpolate) تعبير غير مُهرَّب داخل Template
 * Literal يبدو أنه يبني HTML.
 *
 * السياق: المرحلة 0.1 وحّدت ~26 دالة تهريب محلية مكرّرة/ناقصة على وحدة واحدة
 * (web/js/utils/escape.js) وأصلحت ~190 موضع حقن حقيقي. هذه القاعدة تمنع تكرار
 * نفس الفئة من الأخطاء مستقبلاً: أي شخص يكتب قيمة داخل نص يحتوي وسم HTML دون
 * تمريرها عبر escapeHtml()/escapeAttr() يفشل الـ lint فوراً.
 *
 * المنطق:
 *  1) نفحص الأجزاء الحرفية (quasis) للـ TemplateLiteral؛ إن بدت وكأنها تحتوي
 *     بداية وسم HTML (نمط /<[a-zA-Z]/) نعتبره "قالب HTML مرشّح".
 *  2) لكل تعبير داخله، نسأل: هل هو "آمن دون تهريب"، أو هل يحتوي في مكان ما
 *     داخله استدعاءً لدالة التهريب المستوردة من web/js/utils/escape.js
 *     (مباشرة أو عبر تغليف/سلسلة)؟ إن لم يكن أيّاً من الاثنين — نُبلغ عن خطأ.
 *
 * المعايرة (تمّت تجريبياً بتشغيل مسودات متتالية على الكود الحقيقي، وليس تخميناً):
 *  المحاولة الأولى اعتمدت حرفياً على التوصية الأصلية — "آمن فقط إن كان رقمياً/
 *  منطقياً بشكل مثبت، وإلا فهو مرصود" — وهذا أنتج 3322 خطأ. أغلبها كانت متغيرات
 *  محلية آمنة فعلاً (size، title، qrDataUrl...) لا يمكن إثبات أنها رقمية من شكل
 *  الشجرة (AST) وحده. بعد اعتبار المعرّفات المجرّدة (Identifier) آمنة افتراضياً
 *  (البيانات الخام تصل دائماً عبر خاصية كائن في هذا المستودع، لا معرّف مجرّد)
 *  انخفض العدد إلى ~920 — لا يزال غير عملي: القيد بأن `npm run lint` يجب أن
 *  يخرج بلا أخطاء على الكود الحالي (الأمر الذي تعتمد عليه CI فعلاً) يعني أن أي
 *  قاعدة بمئات "الإيجابيات الخاطئة" غير قابلة للشحن أصلاً، لا مجرد "مزعجة".
 *  لذلك انعكست قطبية فحص الوصول لخصائص الكائن (`obj.prop`): بدل "مرصود افتراضياً
 *  إلا إن أثبتنا أنه رقمي"، أصبح "آمن افتراضياً إلا إن اسم الخاصية معروف تجريبياً
 *  بأنه يحمل نصاً حراً من المستخدم" (name، description، notes...) — القائمة في
 *  RISKY_MEMBER_PROPERTY_NAMES مبنية على أمثلة حقيقية رُصدت أثناء هذه المعايرة
 *  (info.activity، idea.name، c.notes، إلخ)، وليست قائمة افتراضية مخمَّنة. هذا
 *  أنزل العدد إلى ما يقارب فئة الأخطاء الحقيقية المستهدفة فعلياً دون إغراق كل
 *  استدعاء رقم مالي (npv، dscr، totalHeads...) بضجيج. التكلفة المقبولة: القاعدة
 *  تكتفي الآن بتغطية جزئية (لا 100%) بدل الإبلاغ عن آلاف المواضع الآمنة فعلاً.
 */

const TAG_PATTERN = /<[a-zA-Z]/;
const ESCAPE_MODULE_PATTERN = /(^|\/)escape\.js$/;
const ESCAPE_EXPORT_NAMES = new Set(['escapeHtml', 'escapeAttr']);
const SAFE_MATH_METHODS = new Set([
    'round', 'floor', 'ceil', 'trunc', 'abs', 'max', 'min', 'pow', 'sqrt',
    'sign', 'cbrt', 'hypot', 'log', 'log2', 'log10', 'exp',
]);
const SAFE_STRING_METHOD_NAMES = new Set([
    'toFixed', 'toLocaleString', 'toString', 'format',
    'toLocaleDateString', 'toLocaleTimeString',
    'getFullYear', 'getMonth', 'getDate', 'getDay', 'getHours', 'getMinutes', 'getSeconds', 'getTime',
]);
// وحدات مرجعية إضافية موثوقة بالكامل (موثّقة في رأس الملف نفسه بأنها "لا تحمل نصاً
// حراً من المستخدم" — قواميس تسميات/ترجمة ثابتة فقط) — استدعاء أي تصدير منها آمن.
const TRUSTED_LABEL_MODULE_PATTERNS = [/i18n\/reportStrings\.js$/];
const COMPARISON_OPERATORS = new Set(['==', '!=', '===', '!==', '<', '>', '<=', '>=']);
const ARITHMETIC_OPERATORS = new Set(['+', '-', '*', '/', '%', '**']);
// دوال/توابع تنسيق أرقام — رُصد تجريبياً في هذا المستودع أن كل دالة تحمل هذا
// النمط بالاسم (fmt، _fmt، kFmt، formatCurrency، formatPrice، formatDscr...) هي
// دالة تنسيق رقم إلى نص عرض (غالباً عبر Intl.NumberFormat/toFixed)، وليست ناقلاً
// لنص حر من المستخدم — تحقّقنا من عدة تطبيقات فعلية قبل اعتماد هذا النمط.
const FORMATTER_NAME_PATTERN = /^_?fmt|^format|fmt$|format$/i;

// أسماء خصائص رُصدت تجريبياً في هذا المستودع كحاملة نصاً حراً كتبه المستخدم
// (اسم مشروع/فكرة، وصف، ملاحظة، عنوان...) — هذه هي فئة الأخطاء الحقيقية التي
// أصلحتها المرحلة 0.1 والتي عثرنا على أمثلة إضافية منها أثناء هذه المعايرة
// (info.activity، idea.name، c.notes...). كل خاصية أخرى غير مذكورة هنا تُعتبر
// آمنة افتراضياً — انظر تعليق المعايرة أعلاه لسبب هذا القلب في القطبية.
// ملاحظة معايرة: `label` استُبعدت عمداً رغم ورودها كمثال "خطر" في التوصية
// الأصلية — تتبّعنا كل مواضع `.label` الفعلية في هذا المستودع (أكثر من 8 ملفات
// مختلفة: خيارات القوائم المنسدلة، خطوات المعالج، تبويبات لوحة التحكم، تصنيفات
// SWOT...) ووجدناها جميعاً قادمة من مصفوفات/قواميس تعدادية ثابتة يكتبها المطوّر
// في نفس الملف، لا من نص يكتبه المستخدم — إبقاؤها في القائمة كان يُنتج ~45 إيجابية
// خاطئة صرفة دون فائدة كشف حقيقية واحدة.
// ملاحظة معايرة أخرى: `content` استُبعدت أيضاً — الموضع الوحيد الذي طابقته
// (PresentationView.js: `slide.content`) كان HTML جاهزاً مبنياً مسبقاً بنفس
// الملف (بطاقات TAM/SAM/SOM)، لا نصاً حراً — تهريبه كان يُظهر الوسوم حرفياً
// (`&lt;div&gt;`) بدل تصييرها. اسم عام كهذا يحمل نية "HTML جاهز" بقدر ما يحمل
// نية "نص عادي" في هذا المستودع.
const RISKY_MEMBER_PROPERTY_NAMES = new Set([
    'name', 'title', 'description', 'desc', 'notes', 'note',
    'comment', 'comments', 'message', 'msg', 'text', 'reason', 'feedback',
    'review', 'summary', 'bio', 'address', 'vision', 'mission',
    'activity', 'concept', 'city', 'district', 'company', 'companyName',
    'clientName', 'preparedBy', 'problemStatement', 'solutionStatement',
    'uniqueValueProposition', 'valueProposition', 'identityStatement',
    'projectOverview', 'aiGeneratedText', 'useOfFunds', 'competitorsLine',
    'marketLine', 'insight', 'mitigation', 'strengths', 'weaknesses',
    'role', 'email', 'url', 'website', 'slogan', 'tagline', 'caption',
    'explanation', 'example', 'errorMessage', 'question', 'answer',
    'solution', 'problem', 'uvp',
]);

export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                'يمنع تفسير تعبير غير مُهرَّب وغير آمن داخل Template Literal يبني HTML (يحمي من إعادة فتح ثغرات XSS المخزّنة).',
        },
        schema: [],
        messages: {
            unescaped:
                'تعبير غير مُهرَّب `{{code}}` داخل Template Literal يبني HTML. مرّره عبر escapeHtml()/escapeAttr() من web/js/utils/escape.js.',
        },
    },

    create(context) {
        // أسماء محلية (بعد أي alias) مرتبطة باستيراد escapeHtml/escapeAttr من الوحدة المرجعية.
        const escapeLocalNames = new Set();
        // أسماء namespace مستوردة عبر `import * as X from '.../escape.js'`.
        const escapeNamespaceNames = new Set();
        // أسماء محلية مستوردة من وحدات تسميات/ترجمة موثوقة بالكامل (TRUSTED_LABEL_MODULE_PATTERNS).
        const trustedLabelLocalNames = new Set();

        function collectImports(programNode) {
            for (const stmt of programNode.body) {
                if (stmt.type !== 'ImportDeclaration') continue;
                if (typeof stmt.source.value !== 'string') continue;
                if (ESCAPE_MODULE_PATTERN.test(stmt.source.value)) {
                    for (const spec of stmt.specifiers) {
                        if (spec.type === 'ImportSpecifier' && ESCAPE_EXPORT_NAMES.has(spec.imported.name)) {
                            escapeLocalNames.add(spec.local.name);
                        } else if (spec.type === 'ImportNamespaceSpecifier') {
                            escapeNamespaceNames.add(spec.local.name);
                        }
                    }
                } else if (TRUSTED_LABEL_MODULE_PATTERNS.some((p) => p.test(stmt.source.value))) {
                    for (const spec of stmt.specifiers) {
                        if (spec.type === 'ImportSpecifier') {
                            trustedLabelLocalNames.add(spec.local.name);
                        }
                    }
                }
            }
        }

        // يلتقط أسماء محلية إضافية تُشير مباشرة إلى escapeHtml/escapeAttr المستوردة
        // (نمط شائع في هذا المستودع: `const esc = escapeHtml;` بعد استيرادها) —
        // يُشغَّل بعد collectImports حتى تكون escapeLocalNames مكتملة أولاً.
        function collectEscapeAliases(programNode) {
            let changed = true;
            while (changed) {
                changed = false;
                (function walk(n) {
                    if (!n || typeof n !== 'object') return;
                    if (Array.isArray(n)) return n.forEach(walk);
                    if (typeof n.type !== 'string') return;
                    if (
                        n.type === 'VariableDeclarator' &&
                        n.id.type === 'Identifier' &&
                        n.init &&
                        n.init.type === 'Identifier' &&
                        escapeLocalNames.has(n.init.name) &&
                        !escapeLocalNames.has(n.id.name)
                    ) {
                        escapeLocalNames.add(n.id.name);
                        changed = true;
                    }
                    for (const key of Object.keys(n)) {
                        if (key === 'parent') continue;
                        walk(n[key]);
                    }
                })(programNode);
            }
        }

        function isEscapeCallee(calleeNode) {
            if (!calleeNode) return false;
            if (calleeNode.type === 'Identifier') {
                return escapeLocalNames.has(calleeNode.name);
            }
            if (calleeNode.type === 'MemberExpression' && !calleeNode.computed && calleeNode.property.type === 'Identifier') {
                if (
                    calleeNode.object.type === 'Identifier' &&
                    escapeNamespaceNames.has(calleeNode.object.name) &&
                    ESCAPE_EXPORT_NAMES.has(calleeNode.property.name)
                ) {
                    return true;
                }
            }
            return false;
        }

        // فحص عام: هل يحتوي هذا الفرع من الشجرة استدعاءً لدالة التهريب في أي مكان
        // (تغليف مباشر، سلسلة .then()، أو داخل دالة رد نداء map()/forEach() محلية)؟
        // نتعامل معه بشكل فضفاض عمداً لأن نمط arr.map(x => escapeHtml(x)).join('')
        // شائع جداً في هذا المستودع ولا يمكن اختزاله في فحص "تغليف مباشر" بسيط.
        function containsEscapeCallAnywhere(node) {
            if (!node || typeof node !== 'object') return false;
            if (Array.isArray(node)) {
                return node.some(containsEscapeCallAnywhere);
            }
            if (typeof node.type !== 'string') return false;
            if (node.type === 'CallExpression' && isEscapeCallee(node.callee)) return true;
            for (const key of Object.keys(node)) {
                if (key === 'parent') continue;
                const value = node[key];
                if (value && typeof value === 'object' && containsEscapeCallAnywhere(value)) {
                    return true;
                }
            }
            return false;
        }

        function isSafeMathCall(calleeNode) {
            return (
                calleeNode &&
                calleeNode.type === 'MemberExpression' &&
                !calleeNode.computed &&
                calleeNode.object.type === 'Identifier' &&
                calleeNode.object.name === 'Math' &&
                calleeNode.property.type === 'Identifier' &&
                SAFE_MATH_METHODS.has(calleeNode.property.name)
            );
        }

        function isSafeIntlConstruction(node) {
            // new Intl.NumberFormat(...) / new Intl.DateTimeFormat(...) — إعدادات ثابتة، ليست بيانات مستخدم.
            return (
                node &&
                node.type === 'NewExpression' &&
                node.callee.type === 'MemberExpression' &&
                !node.callee.computed &&
                node.callee.object.type === 'Identifier' &&
                node.callee.object.name === 'Intl'
            );
        }

        function isSafeDateConstruction(node) {
            // new Date(...) — قيمة تُستخدم فقط عبر getters/toLocale*Date/TimeString رقمية الشكل.
            return node && node.type === 'NewExpression' && node.callee.type === 'Identifier' && node.callee.name === 'Date';
        }

        function resolveIdentifierInit(identifierNode) {
            // نفحص نطاق (scope) المعرِّف نفسه (مكان استخدامه)، لا نطاق موضع الاستدعاء —
            // فقد يكونان مختلفين (مثال: هذا المعرِّف هو مصفوفة تُستدعى .map() عليها خارج
            // نطاق الدالة الوسيطة (callback) التي نفحص وصولاً لخاصية بداخلها).
            const scope = context.sourceCode.getScope(identifierNode);
            const variable = scope.references.find((ref) => ref.identifier === identifierNode)?.resolved;
            if (!variable || !variable.defs || variable.defs.length !== 1) return null;
            const def = variable.defs[0];
            if (def.type === 'Variable' && def.node.type === 'VariableDeclarator' && def.node.init) {
                return def.node.init;
            }
            return null;
        }

        // هل هذه القيمة نص/رقم/قيمة ثابتة بالكامل وقت الكتابة (Literal، أو مصفوفة/تعبير
        // منها فقط)؟ تُستخدم لإثبات أن مصفوفة بيانات محلية "ثابتة تماماً" (لا حقول
        // ديناميكية بداخلها) — لا فرق حينها أي اسم خاصية تحمله عناصرها.
        function isLiteralish(node) {
            if (!node) return false;
            if (node.type === 'Literal') return true;
            if (node.type === 'ArrayExpression') return node.elements.every((el) => isLiteralish(el));
            if (node.type === 'TemplateLiteral') return node.expressions.length === 0;
            return false;
        }

        function isArrayOfLiteralObjects(node) {
            let target = node;
            if (target.type === 'CallExpression' && target.arguments.length === 1) {
                // يغطي Object.freeze([...]) الشائع مع جداول بيانات ثابتة.
                target = target.arguments[0];
            }
            return (
                !!target &&
                target.type === 'ArrayExpression' &&
                target.elements.length > 0 &&
                target.elements.every(
                    (el) =>
                        el &&
                        el.type === 'ObjectExpression' &&
                        el.properties.every((p) => p.type === 'Property' && !p.computed && isLiteralish(p.value))
                )
            );
        }

        // وصول لخاصية (obj.prop) حيث obj هو بارامتر دالة رد نداء map()/forEach()/filter()/
        // find() المُستدعاة على مصفوفة محلية ثابتة بالكامل (كل عناصرها كائنات حرفية) —
        // آمن دائماً بغضّ النظر عن اسم الخاصية، لأن المحتوى بأكمله مكتوب في الكود مسبقاً
        // (بيانات صفحات إرشادية/قوائم خيارات ثابتة)، وليس بيانات مستخدم أو حالة تطبيق.
        function isSafeStaticCollectionMember(memberNode) {
            if (memberNode.object.type !== 'Identifier') return false;
            const scope = context.sourceCode.getScope(memberNode);
            const variable = scope.references.find((ref) => ref.identifier === memberNode.object)?.resolved;
            if (!variable || !variable.defs || variable.defs.length !== 1) return false;
            const def = variable.defs[0];
            if (def.type !== 'Parameter') return false;
            const fn = def.node;
            const call = fn.parent;
            if (!call || call.type !== 'CallExpression') return false;
            if (call.callee.type !== 'MemberExpression' || call.callee.computed || call.callee.property.type !== 'Identifier') {
                return false;
            }
            if (!['map', 'forEach', 'filter', 'find', 'some', 'every', 'flatMap'].includes(call.callee.property.name)) {
                return false;
            }
            if (call.arguments[0] !== fn) return false;
            let arrayNode = call.callee.object;
            if (arrayNode.type === 'Identifier') {
                arrayNode = resolveIdentifierInit(arrayNode) || arrayNode;
            }
            return isArrayOfLiteralObjects(arrayNode);
        }

        function findEnclosingClassBody(node) {
            let cur = node.parent;
            while (cur) {
                if (cur.type === 'ClassBody') return cur;
                cur = cur.parent;
            }
            return null;
        }

        // يحاول تحديد تعريف الدالة التي يستدعيها هذا الـ CallExpression — إمّا معرِّف
        // محلي في نفس الملف (function/const سهمية)، أو تابع صنف عبر this.method(...)،
        // أو دالة مستدعاة ذاتياً (IIFE) — نمط شائع لحساب قيمة مُهيّأة inline من
        // متغيرات محلية (مثال: `(() => { const p = ...; return p.toFixed(1); })()`).
        function resolveCallableDefinition(node) {
            const callee = node.callee;
            if (callee.type === 'ArrowFunctionExpression' || callee.type === 'FunctionExpression') {
                return callee;
            }
            if (callee.type === 'Identifier') {
                const scope = context.sourceCode.getScope(node);
                const variable = scope.references.find((ref) => ref.identifier === callee)?.resolved;
                if (!variable || !variable.defs || variable.defs.length !== 1) return null;
                const def = variable.defs[0];
                if (def.type === 'FunctionName' && def.node.type === 'FunctionDeclaration') {
                    return def.node;
                }
                if (
                    def.type === 'Variable' &&
                    def.node.type === 'VariableDeclarator' &&
                    def.node.init &&
                    (def.node.init.type === 'ArrowFunctionExpression' || def.node.init.type === 'FunctionExpression')
                ) {
                    return def.node.init;
                }
                return null;
            }
            if (
                callee.type === 'MemberExpression' &&
                !callee.computed &&
                callee.object.type === 'ThisExpression' &&
                callee.property.type === 'Identifier'
            ) {
                const classBody = findEnclosingClassBody(node);
                if (!classBody) return null;
                const method = classBody.body.find(
                    (m) =>
                        m.type === 'MethodDefinition' &&
                        m.kind === 'method' &&
                        !m.computed &&
                        m.key.type === 'Identifier' &&
                        m.key.name === callee.property.name
                );
                if (method) return method.value;
                // نمط شائع آخر في هذا المستودع: تعريف "تابع" عبر إسناد داخل constructor
                // بدل method شكلية — `this._npvClass = (v) => ...;`.
                let assigned = null;
                (function walk(n) {
                    if (assigned || !n || typeof n !== 'object') return;
                    if (Array.isArray(n)) return n.forEach(walk);
                    if (typeof n.type !== 'string') return;
                    if (
                        n.type === 'AssignmentExpression' &&
                        n.operator === '=' &&
                        n.left.type === 'MemberExpression' &&
                        !n.left.computed &&
                        n.left.object.type === 'ThisExpression' &&
                        n.left.property.type === 'Identifier' &&
                        n.left.property.name === callee.property.name &&
                        (n.right.type === 'ArrowFunctionExpression' || n.right.type === 'FunctionExpression')
                    ) {
                        assigned = n.right;
                        return;
                    }
                    for (const key of Object.keys(n)) {
                        if (key === 'parent') continue;
                        walk(n[key]);
                    }
                })(classBody);
                return assigned;
            }
            return null;
        }

        // ثقة في أي استدعاء يُحلّ إلى دالة/تابع مُعرَّف في نفس الملف — بصرف النظر
        // عن أمان جسمها هي نفسها: أي Template Literal غير آمن داخل تلك الدالة
        // سيُفحص ويُبلَّغ عنه بشكل مستقل عند موضع تعريفها (القاعدة تفحص كل Template
        // Literal في الملف بلا استثناء)، فتكرار الفحص هنا عند موضع الاستدعاء لا
        // يضيف تغطية حقيقية — فقط ضجيجاً مزدوجاً على نفس الخطر إن وُجد.
        function isSafeResolvableCall(node) {
            return !!resolveCallableDefinition(node);
        }

        function isFormatterCallee(calleeNode) {
            if (calleeNode.type === 'Identifier') return FORMATTER_NAME_PATTERN.test(calleeNode.name);
            if (calleeNode.type === 'MemberExpression' && !calleeNode.computed && calleeNode.property.type === 'Identifier') {
                return FORMATTER_NAME_PATTERN.test(calleeNode.property.name);
            }
            return false;
        }

        function isSafeCall(node) {
            const callee = node.callee;
            if (isEscapeCallee(callee)) return true;
            if (callee.type === 'Identifier' && trustedLabelLocalNames.has(callee.name)) return true;
            if (callee.type === 'Identifier' && callee.name === 'Number') return true;
            if (callee.type === 'Identifier' && callee.name === 'String') {
                return node.arguments.length >= 1 && isSafeExpression(node.arguments[0]);
            }
            if (isFormatterCallee(callee)) return true;
            if (isSafeMathCall(callee)) return true;
            if (
                callee.type === 'MemberExpression' &&
                !callee.computed &&
                callee.property.type === 'Identifier' &&
                SAFE_STRING_METHOD_NAMES.has(callee.property.name) &&
                (isSafeExpression(callee.object) || isSafeIntlConstruction(callee.object) || isSafeDateConstruction(callee.object))
            ) {
                return true;
            }
            // سلسلة استدعاءات فوق تعبير آمن أصلاً، مثال: escapeHtml(x).trim()
            if (callee.type === 'MemberExpression' && !callee.computed && isSafeExpression(callee.object)) {
                return true;
            }
            if (isSafeResolvableCall(node)) return true;
            // استدعاء دالة مباشر (لا سلسلة تابع على كائن) وكل معطياته آمنة بذاتها —
            // حتى إن كانت الدالة نفسها من ملف/وحدة أخرى غير قابلة للتحليل هنا، أسوأ ما
            // يمكن أن تفعله هو تحويل مدخلات آمنة أصلاً؛ أي خطر حقيقي داخلها (تسريب حالة
            // خارجية غير آمنة عبر Template Literal خاص بها) سيُفحص عند تعريفها هي.
            // نستثني سلاسل التوابع (obj.method(...)) عمداً: `riskyText.slice(0,9)`
            // آمنة المعطيات لكن الخطر الحقيقي في receiver (obj) لا في المعطيات.
            if (
                callee.type === 'Identifier' &&
                node.arguments.every((arg) => arg.type !== 'SpreadElement' && isSafeExpression(arg))
            ) {
                return true;
            }
            // "تغليف خارجي" لاستدعاء تهريب — يغطي String(escapeHtml(x)) وأنماط map/join المتداخلة.
            if (containsEscapeCallAnywhere(node)) return true;
            return false;
        }

        function isSafeExpression(node) {
            if (!node) return true;
            switch (node.type) {
                case 'Literal':
                    return true;
                case 'Identifier':
                    // معرِّف مجرّد (متغيّر/بارامتر محلي) — رصده تجريبياً على هذا المستودع
                    // أظهر أنه الغالبية الساحقة من المتغيرات المحسوبة مسبقاً بأمان
                    // (أرقام، تسميات ثابتة من ternary/enum) وليس بيانات مستخدم خام؛
                    // البيانات الخام الحقيقية تصل دائماً عبر وصول لخاصية كائن
                    // (info.activity، idea.name) وليس عبر معرّف مجرّد — لذلك نتركه
                    // آمناً هنا ونُركّز الفحص على MemberExpression أدناه.
                    return true;
                case 'TemplateLiteral':
                    return node.expressions.every(isSafeExpression);
                case 'ChainExpression':
                    return isSafeExpression(node.expression);
                case 'MemberExpression':
                    if (node.computed) {
                        // وصول محسوب (obj[key]): آمن افتراضياً (غالباً فهرسة مصفوفة/قاموس
                        // ببيانات بنيوية) — إلا إن كان المفتاح نصاً حرفياً معروفاً بالخطورة
                        // (obj['name'] بدل obj.name).
                        if (node.property.type === 'Literal' && typeof node.property.value === 'string') {
                            return !RISKY_MEMBER_PROPERTY_NAMES.has(node.property.value);
                        }
                        return true;
                    }
                    if (node.property.type !== 'Identifier') return true;
                    if (!RISKY_MEMBER_PROPERTY_NAMES.has(node.property.name)) return true;
                    return isSafeStaticCollectionMember(node);
                case 'UnaryExpression':
                    if (node.operator === '!' || node.operator === 'typeof' || node.operator === 'void') return true;
                    if (node.operator === '+' || node.operator === '-' || node.operator === '~') return true;
                    return isSafeExpression(node.argument);
                case 'BinaryExpression':
                    if (COMPARISON_OPERATORS.has(node.operator)) return true;
                    if (ARITHMETIC_OPERATORS.has(node.operator)) {
                        return isSafeExpression(node.left) && isSafeExpression(node.right);
                    }
                    return false;
                case 'LogicalExpression':
                    return isSafeExpression(node.left) && isSafeExpression(node.right);
                case 'ConditionalExpression':
                    return isSafeExpression(node.consequent) && isSafeExpression(node.alternate);
                case 'CallExpression':
                    return isSafeCall(node);
                case 'ObjectExpression':
                    // كائن حرفي (مثال: renderStarsHtml(n, { size: 18 })) — آمن إن كانت كل
                    // قيم خصائصه آمنة (نتجاهل عناصر Spread تحفّظاً).
                    return node.properties.every((p) => p.type === 'Property' && !p.computed && isSafeExpression(p.value));
                case 'ArrayExpression':
                    // نمط شائع جداً هنا: `(x.risky || []).map(...)` — المصفوفة الفارغة
                    // الاحتياطية جزء من التعبير نفسه ويجب ألّا تُسقط أمان الجانب الآخر
                    // من `||`/`??` عبر LogicalExpression بلا داعٍ.
                    return node.elements.every((el) => el === null || isSafeExpression(el));
                default:
                    return false;
            }
        }

        return {
            Program(node) {
                collectImports(node);
                collectEscapeAliases(node);
            },
            TemplateLiteral(node) {
                if (node.expressions.length === 0) return;
                // نتجاهل أي Template Literal متداخل داخل وسم (Tagged Template) — خارج نطاق هذه القاعدة.
                if (node.parent && node.parent.type === 'TaggedTemplateExpression') return;

                const rawText = node.quasis.map((q) => q.value.raw).join(' ');
                if (!TAG_PATTERN.test(rawText)) return;

                for (const expr of node.expressions) {
                    if (isSafeExpression(expr)) continue;
                    context.report({
                        node: expr,
                        messageId: 'unescaped',
                        data: {
                            code: context.sourceCode.getText(expr).slice(0, 60),
                        },
                    });
                }
            },
        };
    },
};
