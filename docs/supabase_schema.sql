-- ============================================================
-- منصة دراسة الجدوى — جداول Supabase
-- انسخ هذا الملف بالكامل والصقه في SQL Editor في Supabase (بدون أي أسطر إضافية).
-- ============================================================

-- جدول الدراسات (البيانات الوصفية فقط)
CREATE TABLE IF NOT EXISTS public.studies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    template_slug TEXT NOT NULL DEFAULT 'modelR',
    status TEXT NOT NULL DEFAULT 'draft',
    title TEXT NOT NULL DEFAULT 'Untitled Project',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- جدول بيانات الدراسة (JSON كامل)
CREATE TABLE IF NOT EXISTS public.study_inputs (
    study_id UUID PRIMARY KEY REFERENCES public.studies(id) ON DELETE CASCADE,
    inputs JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- فهارس لتسريع الاستعلامات
CREATE INDEX IF NOT EXISTS idx_studies_owner_id ON public.studies(owner_id);
CREATE INDEX IF NOT EXISTS idx_studies_updated_at ON public.studies(updated_at DESC);

-- تفعيل RLS على الجدولين
ALTER TABLE public.studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_inputs ENABLE ROW LEVEL SECURITY;

-- سياسات studies: المستخدم يرى ويعدل دراساته فقط
CREATE POLICY "Users can read own studies"
    ON public.studies FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own studies"
    ON public.studies FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own studies"
    ON public.studies FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own studies"
    ON public.studies FOR DELETE
    USING (auth.uid() = owner_id);

-- سياسات study_inputs: نفس المبدأ عبر الربط مع studies
CREATE POLICY "Users can read own study_inputs"
    ON public.study_inputs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.studies s
            WHERE s.id = study_inputs.study_id AND s.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own study_inputs"
    ON public.study_inputs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.studies s
            WHERE s.id = study_inputs.study_id AND s.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own study_inputs"
    ON public.study_inputs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.studies s
            WHERE s.id = study_inputs.study_id AND s.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own study_inputs"
    ON public.study_inputs FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.studies s
            WHERE s.id = study_inputs.study_id AND s.owner_id = auth.uid()
        )
    );
