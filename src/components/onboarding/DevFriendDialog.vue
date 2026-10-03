<template>
    <Dialog v-model:open="isOpen">
        <DialogContent
            class="border border-border bg-background/85 p-5 shadow-lg backdrop-blur-xl backdrop-saturate-[1.4] sm:max-w-md"
            :show-close-button="false"
            @escape-key-down="handleDismiss"
            @pointer-down-outside="handleDismiss"
            @interact-outside.prevent>
            <!-- Header: developer avatar + title -->
            <div class="flex flex-col items-center pt-2 text-center">
                <Avatar class="mb-3 size-16 rounded-full">
                    <AvatarImage :src="avatarUrl" :alt="developerName" />
                    <AvatarFallback class="text-xl font-semibold">{{ avatarInitial }}</AvatarFallback>
                </Avatar>
                <h2 class="m-0 text-[22px] font-bold tracking-tight">{{ t('onboarding.devFriend.title') }}</h2>
                <p class="mt-1.5 text-sm text-muted-foreground">{{ t('onboarding.devFriend.body') }}</p>
            </div>

            <!-- Contact table -->
            <Panel variant="muted" class="mt-4">
                <div class="mb-2 text-[13px] font-semibold">{{ t('onboarding.devFriend.contact_title') }}</div>
                <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                    <template v-for="row in contactRows" :key="row.labelKey">
                        <div class="text-muted-foreground">{{ t(row.labelKey) }}</div>
                        <button
                            v-if="row.href"
                            type="button"
                            class="cursor-pointer text-left text-primary underline-offset-2 hover:underline"
                            @click="openExternalLink(row.href)">
                            {{ t(row.valueKey) }}
                        </button>
                        <div v-else>{{ t(row.valueKey) }}</div>
                    </template>
                </div>
            </Panel>

            <!-- CTA -->
            <div class="mt-4 flex flex-col items-center">
                <Button class="h-11 w-full text-sm font-semibold" size="lg" @click="handleDismiss">
                    {{ t('onboarding.devFriend.cta') }}
                </Button>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { computed, ref, watch } from 'vue';
    import { useI18n } from 'vue-i18n';
    import confetti from 'canvas-confetti';

    import { Dialog, DialogContent } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Panel } from '@/components/ui/panel';
    import { userRequest } from '@/api';
    import configRepository from '../../services/config';
    import { DEV_FRIEND_SEEN_KEY } from '../../services/oobe';
    import { watchState } from '../../services/watchState';
    import { useUserDisplay } from '../../composables/useUserDisplay';
    import { useFriendStore, useUserStore } from '../../stores';
    import { openExternalLink } from '../../shared/utils/appActions';
    import {
        DEV_FRIEND_USER_ID,
        devFriendDialogForce,
        devFriendDialogShowRequest
    } from './devFriendDialogState';

    const OPEN_DELAY_MS = 500;
    const FRIENDS_LOAD_TIMEOUT_MS = 15000;
    const PROFILE_URL = 'https://yusurmount.github.io/about/';

    const { t } = useI18n();

    const isOpen = ref(false);
    let openTimer = null;

    const friendStore = useFriendStore();
    const userStore = useUserStore();
    const { userImage } = useUserDisplay();

    // One in-flight (or settled) profile fetch per app session; a failed
    // fetch clears it so the next show request can retry.
    let profilePromise = null;

    const contactRows = [
        { labelKey: 'onboarding.devFriend.ingame_label', valueKey: 'onboarding.devFriend.ingame_value' },
        { labelKey: 'onboarding.devFriend.qq_label', valueKey: 'onboarding.devFriend.qq_value' },
        {
            labelKey: 'onboarding.devFriend.other_label',
            valueKey: 'onboarding.devFriend.other_value',
            href: PROFILE_URL
        }
    ];

    const devFriend = computed(() => friendStore.friends.get(DEV_FRIEND_USER_ID));
    // Prefer the friend entry, then any cached user (e.g. a debug preview
    // where the developer is not in the local friend list).
    const devUser = computed(
        () => devFriend.value?.ref ?? userStore.cachedUsers.get(DEV_FRIEND_USER_ID) ?? null
    );
    const developerName = computed(() => devUser.value?.displayName ?? devFriend.value?.name ?? '');
    const avatarUrl = computed(() => userImage(devUser.value, true));
    const avatarInitial = computed(() => developerName.value.trim().charAt(0) || '?');

    // UI debug tool / welcome dismissal: re-read the seen flag, then show.
    watch(devFriendDialogShowRequest, () => {
        maybeOpen(Boolean(devFriendDialogForce.value));
    });

    // Celebration cannons every time the dialog opens.
    watch(isOpen, (open) => {
        if (open) {
            fireConfetti();
        }
    });

    /**
     * Two corner cannons plus a center bloom, staggered so the burst reads
     * as a "confetti cannon blooming" rather than one flat explosion.
     * @returns {void}
     */
    function fireConfetti() {
        const cannon = { particleCount: 50, spread: 55, startVelocity: 38, scalar: 0.9 };
        confetti({ ...cannon, angle: 60, origin: { x: 0, y: 0.9 } });
        confetti({ ...cannon, angle: 120, origin: { x: 1, y: 0.9 } });
        setTimeout(() => {
            confetti({ particleCount: 90, spread: 110, decay: 0.92, scalar: 1.1, origin: { y: 0.55 } });
        }, 220);
    }

    /**
     * Open the dialog after a short delay unless it has already been seen.
     * Without `force`, the developer must be in the friend list — the check
     * waits (bounded) for the friend list to finish loading first, because
     * the welcome dialog can be dismissed before that happens.
     * @param {boolean} force
     * @returns {Promise<void>}
     */
    async function maybeOpen(force) {
        if (isOpen.value || openTimer) {
            return;
        }
        const seen = await configRepository.getBool(DEV_FRIEND_SEEN_KEY, false);
        if (seen) {
            return;
        }
        if (!force) {
            await waitFriendsLoaded();
            if (!friendStore.friends.has(DEV_FRIEND_USER_ID)) {
                return;
            }
        }
        await ensureDevProfile();
        openTimer = setTimeout(() => {
            openTimer = null;
            isOpen.value = true;
        }, OPEN_DELAY_MS);
    }

    /**
     * Make sure the developer's user object (avatar + name) is available —
     * the friend entry alone is not enough for debug previews, and a friend
     * entry can exist without a resolved user ref. Resolves either way so
     * a failed fetch never blocks the dialog.
     * @returns {Promise<void>}
     */
    function ensureDevProfile() {
        if (devUser.value) {
            return Promise.resolve();
        }
        if (!profilePromise) {
            profilePromise = userRequest
                .getUser({ userId: DEV_FRIEND_USER_ID })
                .catch(() => {
                    profilePromise = null;
                });
        }
        return profilePromise;
    }

    /**
     * Resolve once the friend list has loaded, or after a bounded timeout
     * so a stuck load never leaves this check hanging forever.
     * @returns {Promise<void>}
     */
    function waitFriendsLoaded() {
        if (watchState.isFriendsLoaded) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            let stop = () => {};
            const finish = () => {
                clearTimeout(timer);
                stop();
                resolve();
            };
            const timer = setTimeout(finish, FRIENDS_LOAD_TIMEOUT_MS);
            stop = watch(
                () => watchState.isFriendsLoaded,
                (loaded) => {
                    if (loaded) {
                        finish();
                    }
                }
            );
        });
    }

    /**
     * Close the dialog and mark it as seen.
     * @returns {Promise<void>}
     */
    async function handleDismiss() {
        isOpen.value = false;
        await configRepository.setBool(DEV_FRIEND_SEEN_KEY, true);
    }
</script>
