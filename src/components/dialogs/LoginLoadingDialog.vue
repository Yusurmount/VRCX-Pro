<template>
    <AlertDialog :open="isOpen">
        <AlertDialogContent
            class="sm:max-w-[420px]"
            @interact-outside.prevent
            @escape-key-down.prevent
            @pointer-down-outside.prevent
            @close-auto-focus.prevent>
            <AlertDialogHeader class="min-w-0">
                <AlertDialogTitle>{{ t('view.login.loggingIn.title') }}</AlertDialogTitle>
                <AlertDialogDescription class="flex items-center gap-2 w-full min-w-0 whitespace-normal">
                    <Spinner class="h-4 w-4 shrink-0" />
                    <span>{{ t('view.login.loggingIn.description') }}</span>
                </AlertDialogDescription>
            </AlertDialogHeader>
        </AlertDialogContent>
    </AlertDialog>
</template>

<script setup>
    import { computed } from 'vue';
    import { storeToRefs } from 'pinia';
    import {
        AlertDialog,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogHeader,
        AlertDialogTitle
    } from '@/components/ui/alert-dialog';
    import { Spinner } from '@/components/ui/spinner';
    import { useI18n } from 'vue-i18n';

    import { useAuthStore, useModalStore } from '../../stores';

    const { t } = useI18n();
    const { loginForm } = storeToRefs(useAuthStore());
    const modalStore = useModalStore();

    // Hide while primary password / 2FA / confirm prompts own the screen,
    // otherwise the two dialogs would stack on top of each other.
    const isOpen = computed(
        () => loginForm.value.loading && !modalStore.alertOpen && !modalStore.promptOpen && !modalStore.otpOpen
    );
</script>
