<template>
    <Dialog v-model:open="isOpen">
        <DialogContent
            class="border border-border bg-background/85 shadow-lg backdrop-blur-xl backdrop-saturate-[1.4] sm:max-w-md"
            :show-close-button="false"
            @escape-key-down="handleDismiss"
            @pointer-down-outside="handleDismiss"
            @interact-outside.prevent>
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

            <div class="flex flex-col items-center">
                <Button class="w-full text-sm font-semibold" size="lg" @click="handleDismiss">
                    {{ t('onboarding.welcome.cta') }}
                </Button>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { computed, onMounted, ref, watch } from 'vue';
    import { useI18n } from 'vue-i18n';

    import { Dialog, DialogContent } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import configRepository from '../../services/config';
    import { PERSONAL_WELCOME_SEEN_KEY } from '../../services/oobe';
    import { useUserDisplay } from '../../composables/useUserDisplay';
    import { useUserStore } from '../../stores';
    import { welcomeDialogShowRequest } from './welcomeDialogState';

    const OPEN_DELAY_MS = 800;

    const { t } = useI18n();

    const isOpen = ref(false);
    let openTimer = null;

    const userStore = useUserStore();
    const { userImage } = useUserDisplay();

    const displayName = computed(() => userStore.currentUser?.displayName ?? '');
    const avatarUrl = computed(() => userImage(userStore.currentUser, true));
    const avatarInitial = computed(() => displayName.value.trim().charAt(0) || '?');

    onMounted(() => {
        maybeOpen();
    });

    // UI debug tool: reset the seen flag, then bump the request to re-open
    // the dialog immediately instead of waiting for the next app start.
    watch(welcomeDialogShowRequest, () => {
        maybeOpen();
    });

    /**
     * Open the dialog after a short delay unless it is already shown, already
     * scheduled, or the seen flag is set.
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
     * never shows again on this machine.
     * @returns {Promise<void>}
     */
    async function handleDismiss() {
        isOpen.value = false;
        await configRepository.setBool(PERSONAL_WELCOME_SEEN_KEY, true);
    }
</script>
