export class CommunityForumView {
    constructor(containerOrId) {
        if (typeof containerOrId === 'string') {
            this.container = document.getElementById(containerOrId);
        } else {
            this.container = containerOrId;
        }
    }

    async render() {
        if (!this.container) return;

        const posts = [
            { id: 1, user: 'أحمد سعيد', time: 'منذ ساعتين', topic: 'رخص البلدية للمطاعم', text: 'السلام عليكم، هل واجه أحدكم صعوبة في استخراج رخصة "مقهى" في الرياض مؤخراً؟ كم تستغرق من الوقت عادة؟', likes: 12, replies: 5 },
            { id: 2, user: 'نورة الخالد', time: 'منذ 5 ساعات', topic: 'تسويق', text: 'أبحث عن وكالة تسويق ممتازة لإطلاق براند أزياء جديد. الميزانية متوسطة.', likes: 8, replies: 14 },
            { id: 3, user: 'مستشار مالي (قرار)', time: 'أمس', topic: 'نصيحة', text: 'تذكير لجميع المؤسسين: تأكدوا من احتساب معدل الإهلاك للأصول الثابتة في دراساتكم لتجنب أزمات السيولة.', likes: 45, replies: 2 }
        ];

        this.container.innerHTML = `
            <div class="community-view max-w-5xl mx-auto py-8 px-4 animate-entry">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-gradient-to-l from-pink-500/10 to-transparent p-6 rounded-2xl border border-pink-500/20">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <svg class="ic w-6 h-6 text-pink-400" aria-hidden="true"><use href="#i-users"/></svg>
                            مجتمع رواد قرار (Community)
                        </h2>
                        <p class="text-white/60 text-sm">تبادل الخبرات، اسأل المختصين، وتواصل مع رواد أعمال يشاركونك نفس التحديات.</p>
                    </div>
                    <button class="btn btn--primary !bg-pink-500 hover:!bg-pink-600 font-bold whitespace-nowrap">
                        + موضوع جديد
                    </button>
                </div>

                <!-- Main Layout -->
                <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <!-- Sidebar Topics -->
                    <div class="lg:col-span-1 space-y-2">
                        <h3 class="text-white font-bold text-sm mb-4">التصنيفات</h3>
                        <div class="p-3 rounded-lg bg-white/10 border border-white/20 text-white flex items-center justify-between cursor-pointer">
                            <span class="text-sm font-medium">النقاش العام</span>
                            <span class="bg-white/20 text-xs px-2 py-0.5 rounded-full">120</span>
                        </div>
                        <div class="p-3 rounded-lg hover:bg-white/5 border border-transparent text-white/70 flex items-center justify-between cursor-pointer transition-colors">
                            <span class="text-sm font-medium">تأسيس وتراخيص</span>
                            <span class="bg-white/10 text-xs px-2 py-0.5 rounded-full">45</span>
                        </div>
                        <div class="p-3 rounded-lg hover:bg-white/5 border border-transparent text-white/70 flex items-center justify-between cursor-pointer transition-colors">
                            <span class="text-sm font-medium">تمويل واستثمار</span>
                            <span class="bg-white/10 text-xs px-2 py-0.5 rounded-full">89</span>
                        </div>
                        <div class="p-3 rounded-lg hover:bg-white/5 border border-transparent text-white/70 flex items-center justify-between cursor-pointer transition-colors">
                            <span class="text-sm font-medium">تسويق ومبيعات</span>
                            <span class="bg-white/10 text-xs px-2 py-0.5 rounded-full">32</span>
                        </div>
                    </div>

                    <!-- Posts Feed -->
                    <div class="lg:col-span-3 space-y-4">
                        ${posts.map(post => `
                            <div class="p-6 rounded-2xl border border-white/5 hover:bg-white/5 transition-colors cursor-pointer" style="background: rgba(255,255,255,0.02);">
                                <div class="flex items-center gap-3 mb-4">
                                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                        ${post.user.charAt(0)}
                                    </div>
                                    <div>
                                        <div class="text-white font-bold text-sm">${post.user}</div>
                                        <div class="text-[10px] text-white/40">${post.time} • ${post.topic}</div>
                                    </div>
                                </div>
                                <p class="text-white/80 text-sm mb-4 leading-relaxed">${post.text}</p>
                                <div class="flex items-center gap-4 text-white/50 text-xs">
                                    <button class="flex items-center gap-1 hover:text-pink-400 transition-colors">
                                        <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-heart"/></svg> ${post.likes} إعجاب
                                    </button>
                                    <button class="flex items-center gap-1 hover:text-white transition-colors">
                                        <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-message-square"/></svg> ${post.replies} ردود
                                    </button>
                                    <button class="flex items-center gap-1 hover:text-white transition-colors mr-auto">
                                        <svg class="ic w-4 h-4" aria-hidden="true"><use href="#i-share-2"/></svg> مشاركة
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <div class="max-w-5xl mx-auto px-4 mt-6">
                <button type="button" class="btn btn-secondary btn-back-dashboard">
                    <svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg>
                    العودة للوحة التحكم
                </button>
            </div>
        `;

        this.container.querySelector('.btn-back-dashboard')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        return this.container;
    }
}
