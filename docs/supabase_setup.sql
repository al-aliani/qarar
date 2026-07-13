-- ============================================
-- ✅ Supabase Database Schema for FeasSimulator — الملف الكنسي الوحيد (CANONICAL)
-- ============================================
-- هذا هو مصدر الحقيقة الوحيد لمخطط قاعدة البيانات. ملفات SQL الأخرى في docs/
-- (supabase_schema.sql، supabase_add_data_column.sql) مُتقاعدة — لا تُنفّذها.
-- المخطط هنا (studies: user_id + data JSONB) يطابق تماماً كود التطبيق في
-- web/js/services/PersistenceService.js و web/supabaseClient.js.
--
-- تنفيذ: Supabase → SQL Editor → New query → الصق الملف كاملاً → Run.

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. User Profiles Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    company_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    projects_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- 3. Studies (Projects) Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.studies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'مشروع جديد',
    description TEXT,
    sector TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    data JSONB NOT NULL DEFAULT '{}',
    thumbnail_url TEXT,
    is_template BOOLEAN DEFAULT FALSE,
    last_calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_studies_user_id ON public.studies(user_id);
CREATE INDEX IF NOT EXISTS idx_studies_status ON public.studies(status);
CREATE INDEX IF NOT EXISTS idx_studies_updated_at ON public.studies(updated_at DESC);

-- Enable RLS
ALTER TABLE public.studies ENABLE ROW LEVEL SECURITY;

-- Policies for studies
CREATE POLICY "Users can view own studies" ON public.studies
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own studies" ON public.studies
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own studies" ON public.studies
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own studies" ON public.studies
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 4. Study Sharing Table (for collaboration)
-- ============================================
CREATE TABLE IF NOT EXISTS public.study_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_id UUID NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
    shared_with_email TEXT NOT NULL,
    shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    permission TEXT DEFAULT 'view' CHECK (permission IN ('view', 'edit', 'admin')),
    accepted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_study_shares_study_id ON public.study_shares(study_id);
CREATE INDEX IF NOT EXISTS idx_study_shares_email ON public.study_shares(shared_with_email);

-- Enable RLS
ALTER TABLE public.study_shares ENABLE ROW LEVEL SECURITY;

-- Policies for study_shares
CREATE POLICY "Study owners can manage shares" ON public.study_shares
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.studies
            WHERE id = study_shares.study_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Shared users can view their shares" ON public.study_shares
    FOR SELECT USING (
        shared_with_user_id = auth.uid() OR
        shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- ============================================
-- 5. Study Versions (History) Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.study_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_id UUID NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    data JSONB NOT NULL,
    change_summary TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_study_versions_study_id ON public.study_versions(study_id);

-- Enable RLS
ALTER TABLE public.study_versions ENABLE ROW LEVEL SECURITY;

-- Policy
CREATE POLICY "Users can manage versions of own studies" ON public.study_versions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.studies
            WHERE id = study_versions.study_id
            AND user_id = auth.uid()
        )
    );

-- ============================================
-- 6. Functions & Triggers
-- ============================================

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_studies_updated_at ON public.studies;
CREATE TRIGGER update_studies_updated_at
    BEFORE UPDATE ON public.studies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- Function to increment projects_count
CREATE OR REPLACE FUNCTION public.increment_projects_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET projects_count = projects_count + 1
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement projects_count
CREATE OR REPLACE FUNCTION public.decrement_projects_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET projects_count = GREATEST(0, projects_count - 1)
    WHERE id = OLD.user_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for projects_count
DROP TRIGGER IF EXISTS on_study_created ON public.studies;
CREATE TRIGGER on_study_created
    AFTER INSERT ON public.studies
    FOR EACH ROW
    EXECUTE FUNCTION public.increment_projects_count();

DROP TRIGGER IF EXISTS on_study_deleted ON public.studies;
CREATE TRIGGER on_study_deleted
    AFTER DELETE ON public.studies
    FOR EACH ROW
    EXECUTE FUNCTION public.decrement_projects_count();

-- ============================================
-- 7. Views
-- ============================================

-- View for study list with user info
CREATE OR REPLACE VIEW public.studies_with_owner AS
SELECT
    s.*,
    p.full_name as owner_name,
    p.company_name as owner_company
FROM public.studies s
LEFT JOIN public.profiles p ON s.user_id = p.id;

-- ============================================
-- 8. Storage Bucket for Attachments
-- ============================================
-- خاص (public=false) — الوصول فقط عبر رابط موقَّع مؤقت (createSignedUrl) أو RLS أدناه.
-- يطابق مسار الرفع في web/js/services/AttachmentsService.js: {auth.uid()}/{studyId}/{file}
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS على storage.objects مُفعّلة افتراضياً من Supabase — نضيف فقط سياسات الوصول.
-- كل مستخدم يرى/يرفع/يحذف فقط ما تحت مجلده الخاص (أول جزء من المسار = معرّف المستخدم).
CREATE POLICY "Users can view own attachments"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload own attachments"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own attachments"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- After running this SQL:
-- 1. Go to Authentication > Email Templates and customize
-- 2. Go to Authentication > URL Configuration and set Site URL
-- 3. Enable Email provider in Authentication > Providers
-- ============================================
