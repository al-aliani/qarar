-- ============================================================
-- Runway-style: مشاركة الدراسة + مجلدات (اختياري — نفّذ بعد الربط)
-- ============================================================

-- مجلدات المستخدم (تنظيم الدراسات)
CREATE TABLE IF NOT EXISTS public.study_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_folders_owner ON public.study_folders(owner_id);

-- عمود مجلد اختياري في studies (إن لم يكن موجوداً)
-- ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.study_folders(id) ON DELETE SET NULL;

-- مشاركة الدراسة: صلاحيات محرر/مشاهد
CREATE TABLE IF NOT EXISTS public.study_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id UUID NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
    shared_with_email TEXT NOT NULL,
    shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('editor', 'viewer')),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(study_id, shared_with_email)
);

CREATE INDEX IF NOT EXISTS idx_study_shares_study ON public.study_shares(study_id);
CREATE INDEX IF NOT EXISTS idx_study_shares_user ON public.study_shares(shared_with_user_id);

ALTER TABLE public.study_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_shares ENABLE ROW LEVEL SECURITY;

-- سياسات study_folders: المالك فقط
CREATE POLICY "Users manage own folders"
    ON public.study_folders FOR ALL
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- سياسات study_shares: المالك يضيف/يحذف؛ المشارك يقرأ حسب الصلاحية
CREATE POLICY "Study owner can manage shares"
    ON public.study_shares FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.studies s WHERE s.id = study_id AND s.owner_id = auth.uid())
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.studies s WHERE s.id = study_id AND s.owner_id = auth.uid())
    );

CREATE POLICY "Shared user can read share"
    ON public.study_shares FOR SELECT
    USING (shared_with_user_id = auth.uid() OR shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid()));
