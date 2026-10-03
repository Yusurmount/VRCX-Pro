<template>
    <Dialog v-model:open="isOpen">
        <DialogContent
            class="border border-border bg-background/85 shadow-lg backdrop-blur-xl backdrop-saturate-[1.4]"
            :class="hasFeatures ? 'p-5 sm:max-w-2xl' : 'sm:max-w-md'"
            :show-close-button="false"
            @escape-key-down="handleDismiss"
            @pointer-down-outside="handleDismiss"
            @interact-outside.prevent>
            <!-- Welcome header -->
            <div class="flex flex-col items-center pt-2 text-center">
                <Avatar class="mb-3 size-16 rounded-full">
                    <AvatarImage :src="avatarUrl" :alt="displayName" />
                    <AvatarFallback class="text-xl font-semibold">{{ avatarInitial }}</AvatarFallback>
                </Avatar>
                <h2 class="m-0 text-[22px] font-bold tracking-tight">{{ t('onboarding.welcome.title') }}</h2>
                <p class="mt-1.5 text-sm text-muted-foreground">
                    {{ t('onboarding.welcome.subtitle', { name: displayName }) }}
                </p>
            </div>

            <!-- What's New features, below the welcome message -->
            <template v-if="hasFeatures">
                <div class="mt-2 text-center">
                    <div class="text-[13px] text-muted-foreground">{{ t(releaseSubtitleKey) }}</div>
                </div>

                <div class="my-2 grid auto-rows-fr grid-cols-4 gap-2.5">
                    <div
                        v-for="(feature, index) in whatsNewDialog.items"
                        :key="feature.key"
                        class="flex h-full animate-[featureAppear_0.4s_ease-out_both] cursor-default flex-col items-center rounded-[10px] border border-transparent bg-muted/50 px-2 py-3.5 pb-3 text-center transition-all duration-250 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-muted/80 hover:shadow-[0_4px_16px_hsl(from_var(--primary)_h_s_l/0.08)]"
                        :style="{ animationDelay: `${0.1 + index * 0.1}s` }">
                        <div
                            class="mb-2.5 flex size-10 items-center justify-center rounded-[10px] transition-all duration-250"
                            :style="{
                                background: `hsl(${resolveHue(feature.icon)} 60% 50% / 0.12)`,
                                color: `hsl(${resolveHue(feature.icon)} 60% 55%)`
                            }">
                            <component :is="resolveIcon(feature.icon)" class="size-5" />
                        </div>

                        <div class="mb-1 w-full text-[13px] font-semibold leading-snug">
                            {{ t(feature.titleKey) }}
                        </div>

                        <div class="w-full text-[11.5px] leading-snug text-muted-foreground">
                            {{ t(feature.descriptionKey) }}
                        </div>
                    </div>
                </div>

                <div class="mt-2 flex justify-center">
                    <Button
                        variant="link"
                        class="h-auto p-0 text-xs text-muted-foreground/70 hover:text-foreground"
                        @click="handleViewChangelog">
                        {{ t('onboarding.whatsnew.common.view_changelog') }} →
                    </Button>
                </div>
            </template>

            <!-- CTA -->
            <div class="flex flex-col items-center" :class="hasFeatures ? 'mt-3' : ''">
                <Button
                    class="w-full text-sm font-semibold"
                    :class="hasFeatures ? 'h-11' : ''"
                    size="lg"
                    @click="handleDismiss">
                    {{ t('onboarding.welcome.cta') }}
                </Button>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { computed, markRaw, onMounted, ref, watch } from 'vue';
    import { ChartNoAxesCombined, Gauge, PlugZap, Sparkles } from 'lucide-vue-next';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import { Dialog, DialogContent } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import configRepository from '../../services/config';
    import { PERSONAL_WELCOME_SEEN_KEY } from '../../services/oobe';
    import { useUserDisplay } from '../../composables/useUserDisplay';
    import { useUserStore, useVRCXUpdaterStore } from '../../stores';
    import { welcomeDialogShowRequest } from './welcomeDialogState';

    const OPEN_DELAY_MS = 800;

    const { t } = useI18n();

    const isOpen = ref(false);
    let openTimer = null;

    const userStore = useUserStore();
    const { userImage } = useUserDisplay();

    const vrcxUpdaterStore = useVRCXUpdaterStore();
    const { whatsNewDialog } = storeToRefs(vrcxUpdaterStore);
    const { closeWhatsNewDialog, openChangeLogDialogOnly } = vrcxUpdaterStore;

    const displayName = computed(() => userStore.currentUser?.displayName ?? '');
    const avatarUrl = computed(() => userImage(userStore.currentUser, true));
    const avatarInitial = computed(() => displayName.value.trim().charAt(0) || '?');

    const hasFeatures = computed(
        () => whatsNewDialog.value.visible && whatsNewDialog.value.items.length > 0
    );
    const releaseSubtitleKey = computed(
        () => whatsNewDialog.value.subtitleKey || 'onboarding.whatsnew.subtitle'
    );

    const iconMap = {
        'chart-no-axes-combined': markRaw(ChartNoAxesCombined),
        'plug-zap': markRaw(PlugZap),
        gauge: markRaw(Gauge),
        sparkles: markRaw(Sparkles)
    };

    const hueMap = {
        'chart-no-axes-combined': '280',
        'plug-zap': '45',
        gauge: '200',
        sparkles: '142'
    };

    function resolveIcon(iconName) {
        return iconMap[iconName] ?? ChartNoAxesCombined;
    }

    function resolveHue(iconName) {
        return hueMap[iconName] ?? '210';
    }

    onMounted(() => {
        maybeOpen();
    });

    // UI debug tool: reset the seen flag, then bump the request to re-open
    // the dialog immediately instead of waiting for the next app start.
    watch(welcomeDialogShowRequest, () => {
        maybeOpen();
    });

    // A What's New announcement clears the seen flag first, then publishes
    // release content; re-evaluate the welcome rules when it arrives so the
    // dialog opens regardless of mount ordering.
    watch(
        () => whatsNewDialog.value.visible,
        (visible) => {
            if (visible) {
                maybeOpen();
            }
        }
    );

    /**
     * Open the dialog after a short delay unless the personalized welcome
     * has already been seen — the single gate for this dialog, whether or
     * not What's New content accompanies it.
     * @returns {Promise<void>}
     */
    async function maybeOpen() {
        if (isOpen.value || openTimer) {
            return;
        }
        const seen = await configRepository.getBool(PERSONAL_WELCOME_SEEN_KEY, false);
        if (seen) {
            return;
        }
        openTimer = setTimeout(() => {
            openTimer = null;
            isOpen.value = true;
        }, OPEN_DELAY_MS);
    }

    /**
     * Close the dialog and mark the personalized welcome as seen so it
     * never shows again until the next What's New announcement resets
     * the flag.
     * @returns {Promise<void>}
     */
    async function handleDismiss() {
        isOpen.value = false;
        await configRepository.setBool(PERSONAL_WELCOME_SEEN_KEY, true);
        closeWhatsNewDialog();
    }

    /**
     * Close the dialog, then open the changelog dialog.
     * @returns {Promise<void>}
     */
    async function handleViewChangelog() {
        isOpen.value = false;
        closeWhatsNewDialog();
        await openChangeLogDialogOnly();
    }
</script>

<style>
    @keyframes featureAppear {
        from {
            opacity: 0;
            transform: translateY(12px) scale(0.95);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }
</style>
