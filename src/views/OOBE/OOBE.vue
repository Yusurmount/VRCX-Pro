<template>
    <WizardShell ref="shellRef" :current-step="currentStep" :total-steps="7" :icons="stepIcons">
        <template #icon="{ step }">
            <img
                v-if="step === 1"
                :src="vrcxLogo"
                alt="VRCX-Pro"
                class="oobe-vrcx-logo h-[140px] w-[140px] rounded-3xl"
                @click="onLogoClick" />
            <component v-else :is="stepIcons[step]" class="wiz-icon-svg text-foreground" :stroke-width="1.5" />
        </template>

        <template #overlay>
            <OpenSourceSoftwareNoticeDialog v-if="ossDialog" v-model:ossDialog="ossDialog" />
        </template>

        <!-- Step 1: Welcome -->
        <div v-if="currentStep === 1" class="wiz-panel">
            <h2 class="wiz-title text-foreground">{{ t('oobe.welcome.title') }}</h2>
            <p class="wiz-desc text-muted-foreground">{{ t('oobe.welcome.subtitle') }}</p>
            <Button size="lg" class="w-full" @click="goTo(2)">{{ t('oobe.welcome.cta') }}</Button>
        </div>

        <!-- Step 2: Legal / disclaimer -->
        <div v-else-if="currentStep === 2" class="wiz-panel">
            <h2 class="wiz-title text-foreground">{{ t('oobe.legal.title') }}</h2>
            <div
                class="max-h-[220px] overflow-y-auto rounded-[10px] border border-border bg-muted p-3 text-[12.5px] leading-[1.7] text-muted-foreground [&_p:last-child]:mb-0 [&_p]:mb-2">
                <p>{{ t('view.settings.general.legal_notice.info') }}</p>
                <p>{{ t('view.settings.general.legal_notice.disclaimer1') }}</p>
                <p>{{ t('view.settings.general.legal_notice.disclaimer2') }}</p>
                <div class="mt-2">
                    <Button variant="outline" @click="ossDialog = true">
                        {{ t('view.settings.general.legal_notice.open_source_software_notice') }}
                    </Button>
                </div>
            </div>
            <div class="wiz-actions">
                <Button @click="goTo(3)">{{ t('oobe.legal.agree') }}</Button>
                <Button variant="ghost" @click="quitApp">{{ t('oobe.legal.decline') }}</Button>
            </div>
            <Button variant="ghost" class="w-full" @click="goBack">{{ t('oobe.back') }}</Button>
        </div>

        <!-- Step 3: Not official warning -->
        <div v-else-if="currentStep === 3" class="wiz-panel">
            <h2 class="wiz-title text-foreground">{{ t('oobe.warning.title') }}</h2>
            <p class="wiz-desc text-muted-foreground">{{ t('oobe.warning.subtitle') }}</p>
            <div
                class="max-h-[220px] overflow-y-auto rounded-[10px] border border-border bg-muted p-3 text-[12.5px] leading-[1.7] text-muted-foreground [&_p:last-child]:mb-0 [&_p]:mb-2">
                <p>{{ t('oobe.warning.body') }}</p>
                <ul class="m-0 mt-3 flex list-disc flex-col gap-2 pl-[1.1rem]">
                    <li>{{ t('oobe.warning.account_1') }}</li>
                    <li>{{ t('oobe.warning.account_2') }}</li>
                    <li>{{ t('oobe.warning.account_3') }}</li>
                </ul>
            </div>
            <Button size="lg" class="w-full" @click="goTo(4)">{{ t('oobe.warning.acknowledge') }}</Button>
            <Button variant="ghost" class="w-full" @click="goBack">{{ t('oobe.back') }}</Button>
        </div>

        <!-- Step 4: Simple settings -->
        <div v-else-if="currentStep === 4" class="wiz-panel">
            <h2 class="wiz-title text-foreground">{{ t('oobe.setup.title') }}</h2>
            <p class="wiz-desc text-muted-foreground">{{ t('oobe.setup.subtitle') }}</p>
            <div class="flex flex-col gap-0.5 rounded-xl border border-border bg-muted p-2">
                <label class="flex cursor-pointer items-center justify-between gap-3 px-2.5 py-3">
                    <div class="flex min-w-0 flex-col gap-0.5">
                        <span class="text-sm font-semibold text-foreground">{{ t('oobe.setup.tray') }}</span>
                        <span class="text-xs text-muted-foreground">{{ t('oobe.setup.tray_desc') }}</span>
                    </div>
                    <Switch :model-value="isCloseToTray" @update:modelValue="setIsCloseToTray" />
                </label>
                <label class="flex cursor-pointer items-center justify-between gap-3 px-2.5 py-3">
                    <div class="flex min-w-0 flex-col gap-0.5">
                        <span class="text-sm font-semibold text-foreground">{{ t('oobe.setup.startup') }}</span>
                        <span class="text-xs text-muted-foreground">{{ t('oobe.setup.startup_desc') }}</span>
                    </div>
                    <Switch :model-value="isStartAtWindowsStartup" @update:modelValue="setIsStartAtWindowsStartup" />
                </label>
                <label class="flex cursor-pointer items-center justify-between gap-3 px-2.5 py-3">
                    <div class="flex min-w-0 flex-col gap-0.5">
                        <span class="text-sm font-semibold text-foreground">{{ t('oobe.setup.minimized') }}</span>
                        <span class="text-xs text-muted-foreground">{{ t('oobe.setup.minimized_desc') }}</span>
                    </div>
                    <Switch :model-value="isStartAsMinimizedState" @update:modelValue="setIsStartAsMinimizedState" />
                </label>
                <label class="flex cursor-pointer items-center justify-between gap-3 px-2.5 py-3">
                    <div class="flex min-w-0 flex-col gap-0.5">
                        <span class="text-sm font-semibold text-foreground">{{ t('oobe.setup.theme') }}</span>
                        <span class="text-xs text-muted-foreground">{{ t('oobe.setup.theme_desc') }}</span>
                    </div>
                    <Switch :model-value="isDarkMode" @update:modelValue="toggleThemeMode" />
                </label>
                <div class="flex items-center justify-between gap-3 px-2.5 py-3">
                    <div class="flex min-w-0 flex-col gap-0.5">
                        <span class="text-sm font-semibold text-foreground">{{ t('oobe.setup.language') }}</span>
                        <span class="text-xs text-muted-foreground">{{ t('oobe.setup.language_desc') }}</span>
                    </div>
                    <Select :model-value="appLanguage" @update:modelValue="changeAppLanguage">
                        <SelectTrigger size="sm" class="w-40">
                            <SelectValue :placeholder="getLanguageName(appLanguage)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem v-for="language in languageCodes" :key="language" :value="language">
                                    {{ getLanguageName(language) }}
                                </SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <Button size="lg" class="w-full mt-4" @click="nextFromSetup">
                {{ t('oobe.setup.next') }}
            </Button>
            <Button variant="ghost" class="w-full" @click="goBack">{{ t('oobe.back') }}</Button>
        </div>

        <!-- Step 5: Login -->
        <div v-else-if="currentStep === 5" class="wiz-panel">
            <h2 class="wiz-title text-foreground">{{ t('oobe.login.title') }}</h2>
            <p class="wiz-desc text-muted-foreground">{{ t('oobe.login.subtitle') }}</p>

            <!-- Account list mode (already logged in / saved accounts) -->
            <template v-if="loginMode === 'list'">
                <RadioGroup
                    v-if="hasSavedAccounts"
                    v-model="selectedUserId"
                    :disabled="loginBusy"
                    class="flex max-h-[220px] flex-col gap-1 overflow-y-auto rounded-[10px] border border-border bg-muted p-3">
                    <label
                        v-for="cred in savedAccounts"
                        :key="cred.user.id"
                        class="flex cursor-pointer items-center gap-2.5 rounded-lg p-2 text-foreground hover:bg-muted"
                        :class="{ 'pointer-events-none opacity-50': loginBusy }"
                        @click="!loginBusy && (selectedUserId = cred.user.id)">
                        <RadioGroupItem :value="cred.user.id" />
                        <Avatar class="rounded-full size-7">
                            <AvatarImage :src="userImage(cred.user, true)" />
                            <AvatarFallback><User class="size-4 text-muted-foreground" /></AvatarFallback>
                        </Avatar>
                        <div class="min-w-0 flex-1">
                            <div class="truncate text-sm text-foreground">{{ cred.user.displayName }}</div>
                            <div class="truncate text-xs text-muted-foreground">
                                {{ cred.user.username }}
                            </div>
                        </div>
                    </label>
                </RadioGroup>
                <Button size="lg" class="w-full" :disabled="!selectedUserId || loginBusy" @click="loginSelectedAccount">
                    <Loader2 v-if="loginBusy" class="size-4 animate-spin" />
                    {{ t('oobe.login.useSelected') }}
                </Button>
                <Button variant="outline" class="w-full" :disabled="loginBusy" @click="loginMode = 'form'">
                    {{ t('oobe.login.addAccount') }}
                </Button>
                <Button variant="ghost" class="w-full" :disabled="loginBusy" @click="goBack">
                    {{ t('oobe.back') }}
                </Button>
            </template>

            <!-- Login form mode -->
            <template v-else>
                <form @submit.prevent="onLoginSubmit">
                    <FieldGroup class="gap-3">
                        <VeeField v-slot="{ field, errors }" name="username">
                            <Field :data-invalid="!!errors.length">
                                <FieldLabel for="oobe-login-username" class="text-foreground">
                                    {{ t('view.login.field.username') }}
                                </FieldLabel>
                                <FieldContent>
                                    <InputGroupField
                                        id="oobe-login-username"
                                        :model-value="field.value"
                                        autocomplete="off"
                                        name="username"
                                        :placeholder="t('view.login.field.username')"
                                        :aria-invalid="!!errors.length"
                                        :disabled="loginBusy"
                                        @update:modelValue="field.onChange"
                                        @blur="field.onBlur" />
                                    <FieldError v-if="errors.length" :errors="errors" />
                                </FieldContent>
                            </Field>
                        </VeeField>
                        <VeeField v-slot="{ field, errors, handleChange }" name="password">
                            <Field :data-invalid="!!errors.length">
                                <FieldLabel for="oobe-login-password" class="text-foreground">
                                    {{ t('view.login.field.password') }}
                                </FieldLabel>
                                <FieldContent>
                                    <InputGroupField
                                        id="oobe-login-password"
                                        :model-value="field.value"
                                        type="password"
                                        autocomplete="off"
                                        name="password"
                                        :placeholder="t('view.login.field.password')"
                                        :aria-invalid="!!errors.length"
                                        show-password
                                        :disabled="loginBusy"
                                        @keydown.delete="handleChange('', false)"
                                        @update:modelValue="field.onChange"
                                        @blur="field.onBlur" />
                                    <FieldError v-if="errors.length" :errors="errors" />
                                </FieldContent>
                            </Field>
                        </VeeField>
                    </FieldGroup>
                    <label class="inline-flex items-center gap-2 mr-2 mt-3 text-sm">
                        <Checkbox v-model="loginForm.saveCredentials" :disabled="loginBusy" />
                        <span>{{ t('view.login.field.saveCredentials') }}</span>
                    </label>
                    <Field class="mt-4">
                        <Button type="submit" size="lg" class="w-full" :disabled="loginBusy">
                            <Loader2 v-if="loginBusy" class="size-4 animate-spin" />
                            {{ t('view.login.login') }}
                        </Button>
                    </Field>
                </form>
                <Button
                    v-if="hasSavedAccounts"
                    variant="ghost"
                    class="w-full"
                    :disabled="loginBusy"
                    @click="loginMode = 'list'">
                    {{ t('oobe.login.backToAccounts') }}
                </Button>
                <Button variant="ghost" class="w-full" :disabled="loginBusy" @click="goBack">{{
                    t('oobe.back')
                }}</Button>
            </template>
        </div>

        <!-- Step 6: Data recovery (optional) -->
        <div v-else-if="currentStep === 6" class="wiz-panel">
            <h2 class="wiz-title text-foreground">{{ t('oobe.recovery.title') }}</h2>
            <p class="wiz-desc text-muted-foreground">{{ t('oobe.recovery.subtitle') }}</p>
            <div class="w-full">
                <RadioGroup v-model="recoverMode" class="grid gap-2">
                    <RadioCard
                        id="oobe-mode-incremental"
                        value="incremental"
                        :title="t('view.settings.advanced.advanced.db_import.mode_incremental')"
                        :description="t('view.settings.advanced.advanced.db_import.mode_incremental_desc')" />
                    <RadioCard
                        id="oobe-mode-full"
                        value="full"
                        :title="t('view.settings.advanced.advanced.db_import.mode_full')"
                        :description="t('view.settings.advanced.advanced.db_import.mode_full_desc')" />
                </RadioGroup>
            </div>
            <Button size="lg" class="w-full" :disabled="recovering" @click="handleRecoverImport">
                <Loader2 v-if="recovering" class="size-4 animate-spin" />
                {{ t('oobe.recovery.import') }}
            </Button>
            <Button variant="ghost" class="w-full" :disabled="recovering" @click="goTo(7)">
                {{ t('oobe.recovery.skip') }}
            </Button>
            <Button variant="ghost" class="w-full" :disabled="recovering" @click="goBack">{{ t('oobe.back') }}</Button>
        </div>

        <!-- Step 7: Complete -->
        <div v-else class="wiz-panel">
            <h2 class="wiz-title text-foreground">{{ t('oobe.complete.title') }}</h2>
            <p class="wiz-desc text-muted-foreground">{{ t('oobe.complete.subtitle') }}</p>
            <Button size="lg" class="w-full" @click="finish">{{ t('oobe.complete.enter') }}</Button>
        </div>
    </WizardShell>
</template>

<script setup>
    import { computed, defineAsyncComponent, markRaw, nextTick, onMounted, ref, watch } from 'vue';
    import {
        DatabaseBackup,
        CheckCircle2,
        Loader2,
        LogIn,
        ShieldCheck,
        SlidersHorizontal,
        TriangleAlert,
        User
    } from 'lucide-vue-next';
    import { storeToRefs } from 'pinia';
    import { useRoute, useRouter } from 'vue-router';
    import { useI18n } from 'vue-i18n';

    import { Button } from '@/components/ui/button';
    import WizardShell from '@/components/wizard/WizardShell.vue';
    import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
    import { RadioCard } from '@/components/ui/radio-card';
    import { Switch } from '@/components/ui/switch';
    import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
    import { Checkbox } from '@/components/ui/checkbox';
    import { InputGroupField } from '@/components/ui/input-group';
    import { Field as VeeField, useForm } from 'vee-validate';
    import { toTypedSchema } from '@vee-validate/zod';
    import { z } from 'zod';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

    import { useAppearanceSettingsStore, useAuthStore, useGeneralSettingsStore, useUserStore } from '@/stores';
    import { getLanguageName, languageCodes } from '@/localization';
    import { watchState } from '@/services/watchState';
    import { completeOobe } from '@/services/oobe';
    import { executeImport, readImportFile } from '@/services/database/exportImport';
    import { useUserDisplay } from '@/composables/useUserDisplay';
    import { toast } from 'vue-sonner';

    import vrcxLogo from '../../../images/VRCX.png';

    const OpenSourceSoftwareNoticeDialog = defineAsyncComponent(
        () => import('../Settings/dialogs/OpenSourceSoftwareNoticeDialog.vue')
    );

    const { t } = useI18n();
    const route = useRoute();
    const router = useRouter();

    const generalSettingsStore = useGeneralSettingsStore();
    const appearanceSettingsStore = useAppearanceSettingsStore();

    const { isCloseToTray, isStartAtWindowsStartup, isStartAsMinimizedState } = storeToRefs(generalSettingsStore);
    const { setIsCloseToTray, setIsStartAtWindowsStartup, setIsStartAsMinimizedState } = generalSettingsStore;

    const { appLanguage, isDarkMode } = storeToRefs(appearanceSettingsStore);
    const { changeAppLanguage, toggleThemeMode } = appearanceSettingsStore;

    const currentStep = ref(1);
    const ossDialog = ref(false);
    const logoClickCount = ref(0);

    /**
     * Hidden escape hatch: clicking the VRCX logo on the welcome screen
     * 10 times closes the OOBE and goes straight to the normal login page.
     * @returns {Promise<void>}
     */
    async function onLogoClick() {
        logoClickCount.value += 1;
        if (logoClickCount.value < 10) return;
        logoClickCount.value = 0;
        try {
            await completeOobe();
        } catch (e) {
            console.error('[OOBE] completeOobe failed:', e);
        } finally {
            await shellRef.value?.playCloseAnimation();
            router.replace('/login').catch((e) => console.error('[OOBE] navigation failed:', e));
        }
    }

    const authStore = useAuthStore();
    const { loginForm } = storeToRefs(authStore);
    const { getAllSavedCredentials, login, relogin } = authStore;

    const { userImage } = useUserDisplay();

    const savedCredentials = ref({});
    const savedAccounts = computed(() => Object.values(savedCredentials.value));
    const hasSavedAccounts = computed(() => savedAccounts.value.length > 0);
    const selectedUserId = ref('');
    const loginMode = ref('form');
    const loginBusy = ref(false);

    /**
     * @returns {Promise<void>}
     */
    async function updateSavedCredentials() {
        try {
            savedCredentials.value = await getAllSavedCredentials();
        } catch (e) {
            // Never let a credential-loading failure break the wizard.
            console.error('[OOBE] failed to load saved credentials:', e);
            savedCredentials.value = {};
        }
        if (hasSavedAccounts.value) {
            loginMode.value = 'list';
        }
    }

    /**
     * @returns {Promise<void>}
     */
    async function loginSelectedAccount() {
        const cred = savedAccounts.value.find((c) => c.user.id === selectedUserId.value);
        if (!cred || loginBusy.value) return;
        loginBusy.value = true;
        await nextTick(); // ensure the loading spinner paints before the login promise resolves
        try {
            await relogin(cred);
            if (watchState.isLoggedIn) {
                currentStep.value = 6;
                preloadFeed();
            }
        } catch (e) {
            // relogin already handles user-facing error display (toast)
            console.error('[OOBE] relogin failed:', e);
        } finally {
            await updateSavedCredentials();
            loginBusy.value = false;
        }
    }

    const requiredMessage = 'Required';
    const formSchema = toTypedSchema(
        z.object({
            username: z.string().min(1, requiredMessage),
            password: z.string().min(1, requiredMessage)
        })
    );
    const { handleSubmit } = useForm({
        validationSchema: formSchema,
        initialValues: {
            username: loginForm.value.username,
            password: loginForm.value.password
        }
    });

    const onLoginSubmit = handleSubmit(async (formValues) => {
        loginForm.value.username = formValues.username ?? '';
        loginForm.value.password = formValues.password ?? '';
        loginBusy.value = true;
        try {
            await login();
            if (watchState.isLoggedIn) {
                preloadFeed();
            }
        } catch (e) {
            // API-level errors are already toasted by the global interceptor;
            // log anything else (e.g. crypto/local failures) without crashing.
            console.error('[OOBE] login failed:', e);
        } finally {
            loginBusy.value = false;
        }
    });

    watch(
        () => watchState.isLoggedIn,
        (isLoggedIn) => {
            if (isLoggedIn && currentStep.value === 5) {
                currentStep.value = 6;
            }
        }
    );
    // Per-step SVG icons (step 1 uses the VRCX logo image instead)
    const stepIcons = {
        2: markRaw(ShieldCheck),
        3: markRaw(TriangleAlert),
        4: markRaw(SlidersHorizontal),
        5: markRaw(LogIn),
        6: markRaw(DatabaseBackup),
        7: markRaw(CheckCircle2)
    };
    const shellRef = ref(null);

    onMounted(async () => {
        // ?debug=1 forces the wizard to start from step 1 (used by the UI debug tool)
        if (route.query.debug !== '1' && route.query.step === 'complete') {
            currentStep.value = 7;
        }
        await updateSavedCredentials();
        // Default-select the first account in the list.
        if (savedAccounts.value.length > 0) {
            selectedUserId.value = savedAccounts.value[0].user.id;
        }
    });

    /**
     * @param {number} step
     */
    function goTo(step) {
        currentStep.value = step;
    }

    /**
     *
     */
    function goBack() {
        if (currentStep.value > 1) {
            currentStep.value -= 1;
        }
    }

    /**
     *
     */
    function nextFromSetup() {
        currentStep.value = 5;
    }
    /**
     *
     */
    function quitApp() {
        window.platform?.quitApplication?.();
    }

    const finishing = ref(false);

    /**
     *
     */
    async function finish() {
        if (finishing.value) return;
        finishing.value = true;
        try {
            await completeOobe();
        } catch (e) {
            console.error('[OOBE] completeOobe failed:', e);
        } finally {
            await shellRef.value?.playCloseAnimation();
            router.replace('/feed').catch((e) => console.error('[OOBE] navigation failed:', e));
        }
    }

    /**
     * Preload the main feed view (lazy chunk + async component) in the
     * background so entering it after OOBE does not stall.
     * @returns {Promise<void>}
     */
    async function preloadFeed() {
        try {
            const resolved = router.resolve('/feed');
            const matched = resolved.matched.find((m) => m.components?.default);
            await matched?.components?.default;
        } catch (e) {
            console.error('[OOBE] preload feed failed:', e);
        }
    }

    const recovering = ref(false);
    const recoverMode = ref('incremental');

    /**
     * Data recovery (optional): restore a backup database file, same as
     * "Settings > Advanced > Restore Database".
     */
    async function handleRecoverImport() {
        if (recovering.value) return;
        const userStore = useUserStore();
        const userId = userStore.currentUser?.id || '';
        recovering.value = true;
        try {
            const result = await readImportFile(userId, { allowUserMismatch: false });
            if (!result.success) {
                if (result.error !== 'cancelled') {
                    toast.error(t('view.settings.advanced.advanced.db_import.error', { error: result.error }));
                }
                return;
            }
            const importResult = await executeImport(result.data, {
                conflictStrategy: 'overwrite',
                newDataStrategy: 'add',
                mode: recoverMode.value
            });
            if (importResult.success) {
                toast.success(
                    t('view.settings.advanced.advanced.db_import.success', {
                        importedCount: importResult.report.overwritten + importResult.report.added,
                        tablesProcessed: importResult.tablesProcessed
                    })
                );
                currentStep.value = 7;
            } else if (importResult.error !== 'cancelled') {
                toast.error(t('view.settings.advanced.advanced.db_import.error', { error: importResult.error }));
            }
        } catch (e) {
            console.error('[OOBE] import failed:', e);
            toast.error(t('view.settings.advanced.advanced.db_import.error', { error: e.message || String(e) }));
        } finally {
            recovering.value = false;
        }
    }
</script>
