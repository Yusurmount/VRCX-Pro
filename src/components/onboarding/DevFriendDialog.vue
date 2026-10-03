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

    import { Dialog, DialogContent } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Panel } from '@/components/ui/panel';
    import configRepository from '../../services/config';
    import { DEV_FRIEND_SEEN_KEY } from '../../services/oobe';
    import { watchState } from '../../services/watchState';
    import { useUserDisplay } from '../../composables/useUserDisplay';
    import { useFriendStore } from '../../stores';
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
    const { userImage } = useUserDisplay();

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
    const developerName = computed(() => devFriend.value?.ref?.displayName ?? devFriend.value?.name ?? '');
    const avatarUrl = computed(() => userImage(devFriend.value?.ref ?? null, true));
    const avatarInitial = computed(() => developerName.value.trim().charAt(0) || '?');

    // UI debug tool / welcome dismissal: re-read the seen flag, then show.
    watch(devFriendDialogShowRequest, () => {
        maybeOpen(Boolean(devFriendDialogForce.value));
    });

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
        openTimer = setTimeout(() => {
            openTimer = null;
            isOpen.value = true;
        }, OPEN_DELAY_MS);
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
