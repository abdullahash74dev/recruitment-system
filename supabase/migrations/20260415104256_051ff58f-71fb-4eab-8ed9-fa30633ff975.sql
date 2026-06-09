
-- Add content fields to site_settings
ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS hero_title1_ar text DEFAULT 'ابنِ مستقبلك المهني',
ADD COLUMN IF NOT EXISTS hero_title1_en text DEFAULT 'Build Your Career',
ADD COLUMN IF NOT EXISTS hero_title2_ar text DEFAULT 'مع مجموعة الخولي',
ADD COLUMN IF NOT EXISTS hero_title2_en text DEFAULT 'With AlKholi Group',
ADD COLUMN IF NOT EXISTS hero_desc_ar text DEFAULT 'نبحث عن كفاءات متميزة للانضمام لفريقنا. قدّم طلبك الآن واكتشف الفرص الوظيفية المتاحة.',
ADD COLUMN IF NOT EXISTS hero_desc_en text DEFAULT 'We are looking for exceptional talents to join our team. Apply now and discover available opportunities.',
ADD COLUMN IF NOT EXISTS employee_count text DEFAULT '2100',
ADD COLUMN IF NOT EXISTS founding_year text DEFAULT '2006',
ADD COLUMN IF NOT EXISTS projects_count text DEFAULT '50',
ADD COLUMN IF NOT EXISTS feature1_title_ar text DEFAULT 'بيئة عمل احترافية',
ADD COLUMN IF NOT EXISTS feature1_title_en text DEFAULT 'Professional Environment',
ADD COLUMN IF NOT EXISTS feature1_desc_ar text DEFAULT 'نوفر بيئة عمل محفزة تساعدك على الإبداع والتطور المهني المستمر.',
ADD COLUMN IF NOT EXISTS feature1_desc_en text DEFAULT 'We provide a stimulating environment that helps you innovate and grow professionally.',
ADD COLUMN IF NOT EXISTS feature2_title_ar text DEFAULT 'فريق متميز',
ADD COLUMN IF NOT EXISTS feature2_title_en text DEFAULT 'Outstanding Team',
ADD COLUMN IF NOT EXISTS feature2_desc_ar text DEFAULT 'انضم لفريق من المحترفين والخبراء في مختلف المجالات والتخصصات.',
ADD COLUMN IF NOT EXISTS feature2_desc_en text DEFAULT 'Join a team of professionals and experts in various fields.',
ADD COLUMN IF NOT EXISTS feature3_title_ar text DEFAULT 'فرص نمو حقيقية',
ADD COLUMN IF NOT EXISTS feature3_title_en text DEFAULT 'Real Growth Opportunities',
ADD COLUMN IF NOT EXISTS feature3_desc_ar text DEFAULT 'نؤمن بتطوير كوادرنا ونقدم مسارات وظيفية واضحة للترقي.',
ADD COLUMN IF NOT EXISTS feature3_desc_en text DEFAULT 'We believe in developing our workforce with clear career paths.',
ADD COLUMN IF NOT EXISTS cta_title_ar text DEFAULT 'جاهز للخطوة التالية؟',
ADD COLUMN IF NOT EXISTS cta_title_en text DEFAULT 'Ready for the Next Step?',
ADD COLUMN IF NOT EXISTS cta_desc_ar text DEFAULT 'تقديم الطلب يستغرق بضع دقائق فقط. بياناتك تُحفظ تلقائياً.',
ADD COLUMN IF NOT EXISTS cta_desc_en text DEFAULT 'Applying takes just a few minutes. Your data is saved automatically.',
ADD COLUMN IF NOT EXISTS stats_section_title_ar text DEFAULT 'أرقام تتحدث عنا',
ADD COLUMN IF NOT EXISTS stats_section_title_en text DEFAULT 'Numbers That Speak',
ADD COLUMN IF NOT EXISTS show_stats_section boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_projects_section boolean DEFAULT true;

-- Add logo_url to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS logo_url text;
