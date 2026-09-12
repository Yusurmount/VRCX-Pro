<template>
    <div class="oobe bg-background">
        <!-- Top bar: step counter + segmented progress -->
        <header class="oobe-header">
            <span class="oobe-step-counter text-muted-foreground">
                {{ t('oobe.step_of', { current: currentStep, total: 7 }) }}
            </span>
        </header>
        <div class="oobe-progress" role="progressbar" :aria-valuenow="currentStep" aria-valuemin="1" aria-valuemax="7">
            <div v-for="step in 7" :key="step" class="oobe-progress-segment" :class="{ active: step <= currentStep }" />
        </div>

        <!-- Left: centered icon with SVG stroke animation -->
        <aside class="oobe-left">
            <Transition name="oobe-icon">
                <div ref="iconWrapRef" :key="currentStep" class="oobe-icon-wrap">
                    <img
                        v-if="currentStep === 1"
                        :src="vrcxLogo"
                        alt="VRCX-Pro"
                        class="oobe-vrcx-logo"
                        @click="onLogoClick" />
                    <component v-else :is="currentIcon" class="oobe-icon-svg text-foreground" :stroke-width="1.5" />
                </div>
            </Transition>
        </aside>

        <!-- Right: content -->
        <section class="oobe-right">
            <div class="oobe-content">
                <Transition name="oobe-content" mode="out-in">
                    <!-- Step 1: Welcome -->
                    <div v-if="currentStep === 1" class="oobe-step-panel">
                        <h2 class="oobe-title text-foreground">{{ t('oobe.welcome.title') }}</h2>
                        <p class="oobe-desc text-muted-foreground">{{ t('oobe.welcome.subtitle') }}</p>
                        <Button size="lg" class="w-full" @click="goTo(2)">{{ t('oobe.welcome.cta') }}</Button>
                    </div>

                    <!-- Step 2: Legal / disclaimer -->
                    <div v-else-if="currentStep === 2" class="oobe-step-panel">
                        <h2 class="oobe-title text-foreground">{{ t('oobe.legal.title') }}</h2>
                        <div class="oobe-scroll border-border bg-muted text-muted-foreground">
                            <p>{{ t('view.settings.general.legal_notice.info') }}</p>
                            <p>{{ t('view.settings.general.legal_notice.disclaimer1') }}</p>
                            <p>{{ t('view.settings.general.legal_notice.disclaimer2') }}</p>
                            <div class="mt-2">
                                <Button variant="outline" @click="ossDialog = true">
                                    {{ t('view.settings.general.legal_notice.open_source_software_notice') }}
                                </Button>
                            </div>
                        </div>
                        <div class="oobe-actions">
                            <Button @click="goTo(3)">{{ t('oobe.legal.agree') }}</Button>
                            <Button variant="ghost" @click="quitApp">{{ t('oobe.legal.decline') }}</Button>
                        </div>
                        <Button variant="ghost" class="w-full" @click="goBack">{{ t('oobe.back') }}</Button>
                    </div>

                    <!-- Step 3: Not official warning -->
                    <div v-else-if="currentStep === 3" class="oobe-step-panel">
                        <h2 class="oobe-title text-foreground">{{ t('oobe.warning.title') }}</h2>
                        <p class="oobe-desc text-muted-foreground">{{ t('oobe.warning.subtitle') }}</p>
                        <div class="oobe-scroll border-border bg-muted text-muted-foreground">
                            <p>{{ t('oobe.warning.body') }}</p>
                            <ul class="oobe-warning-list">
                                <li>{{ t('oobe.warning.account_1') }}</li>
                                <li>{{ t('oobe.warning.account_2') }}</li>
                                <li>{{ t('oobe.warning.account_3') }}</li>
                            </ul>
                        </div>
                        <Button size="lg" class="w-full" @click="goTo(4)">{{ t('oobe.warning.acknowledge') }}</Button>
                        <Button variant="ghost" class="w-full" @click="goBack">{{ t('oobe.back') }}</Button>
                    </div>

                    <!-- Step 4: Simple settings -->
                    <div v-else-if="currentStep === 4" class="oobe-step-panel">
                        <h2 class="oobe-title text-foreground">{{ t('oobe.setup.title') }}</h2>
                        <p class="oobe-desc text-muted-foreground">{{ t('oobe.setup.subtitle') }}</p>
                        <div class="oobe-settings border-border bg-muted">
                            <label class="oobe-setting">
                                <div class="oobe-setting-text">
                                    <span class="oobe-setting-label text-foreground">{{ t('oobe.setup.tray') }}</span>
                                    <span class="oobe-setting-desc text-muted-foreground">{{
                                        t('oobe.setup.tray_desc')
                                    }}</span>
                                </div>
                                <Switch :model-value="isCloseToTray" @update:modelValue="setIsCloseToTray" />
                            </label>
                            <label class="oobe-setting">
                                <div class="oobe-setting-text">
                                    <span class="oobe-setting-label text-foreground">{{
                                        t('oobe.setup.startup')
                                    }}</span>
                                    <span class="oobe-setting-desc text-muted-foreground">{{
                                        t('oobe.setup.startup_desc')
                                    }}</span>
                                </div>
                                <Switch
                                    :model-value="isStartAtWindowsStartup"
                                    @update:modelValue="setIsStartAtWindowsStartup" />
                            </label>
                            <label class="oobe-setting">
                                <div class="oobe-setting-text">
                                    <span class="oobe-setting-label text-foreground">{{
                                        t('oobe.setup.minimized')
                                    }}</span>
                                    <span class="oobe-setting-desc text-muted-foreground">{{
                                        t('oobe.setup.minimized_desc')
                                    }}</span>
                                </div>
                                <Switch
                                    :model-value="isStartAsMinimizedState"
                                    @update:modelValue="setIsStartAsMinimizedState" />
                            </label>
                            <label class="oobe-setting">
                                <div class="oobe-setting-text">
                                    <span class="oobe-setting-label text-foreground">{{ t('oobe.setup.theme') }}</span>
                                    <span class="oobe-setting-desc text-muted-foreground">{{
                                        t('oobe.setup.theme_desc')
                                    }}</span>
                                </div>
                                <Switch :model-value="isDarkMode" @update:modelValue="toggleThemeMode" />
                            </label>
                            <div class="oobe-setting">
                                <div class="oobe-setting-text">
                                    <span class="oobe-setting-label text-foreground">{{
                                        t('oobe.setup.language')
                                    }}</span>
                                    <span class="oobe-setting-desc text-muted-foreground">{{
                                        t('oobe.setup.language_desc')
                                    }}</span>
                                </div>
                                <Select :model-value="appLanguage" @update:modelValue="changeAppLanguage">
                                    <SelectTrigger size="sm" class="w-40">
                                        <SelectValue :placeholder="getLanguageName(appLanguage)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectItem
                                                v-for="language in languageCodes"
                                                :key="language"
                                                :value="language">
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
                    <div v-else-if="currentStep === 5" class="oobe-step-panel">
                        <h2 class="oobe-title text-foreground">{{ t('oobe.login.title') }}</h2>
                        <p class="oobe-desc text-muted-foreground">{{ t('oobe.login.subtitle') }}</p>

                        <!-- Account list mode (already logged in / saved accounts) -->
                        <template v-if="loginMode === 'list'">
                            <div v-if="hasSavedAccounts" class="oobe-scroll oobe-account-list">
                                <label
                                    v-for="cred in savedAccounts"
                                    :key="cred.user.id"
                                    class="oobe-account-item"
                                    @click="selectedUserId = cred.user.id">
                                    <input type="radio" :value="cred.user.id" v-model="selectedUserId" />
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
                            </div>
                            <Button
                                size="lg"
                                class="w-full"
                                :disabled="!selectedUserId || loginBusy"
                                @click="loginSelectedAccount">
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
                                                    @keydown.delete="handleChange('', false)"
                                                    @update:modelValue="field.onChange"
                                                    @blur="field.onBlur" />
                                                <FieldError v-if="errors.length" :errors="errors" />
                                            </FieldContent>
                                        </Field>
                                    </VeeField>
                                </FieldGroup>
                                <label class="inline-flex items-center gap-2 mr-2 mt-3 text-sm">
                                    <Checkbox v-model="loginForm.saveCredentials" />
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
                    <div v-else-if="currentStep === 6" class="oobe-step-panel">
                        <h2 class="oobe-title text-foreground">{{ t('oobe.recovery.title') }}</h2>
                        <p class="oobe-desc text-muted-foreground">{{ t('oobe.recovery.subtitle') }}</p>
                        <Button size="lg" class="w-full" :disabled="recovering" @click="handleRecoverImport">
                            {{ t('oobe.recovery.import') }}
                        </Button>
                        <Button variant="ghost" class="w-full" @click="goTo(7)">
                            {{ t('oobe.recovery.skip') }}
                        </Button>
                        <Button variant="ghost" class="w-full" @click="goBack">{{ t('oobe.back') }}</Button>
                    </div>

                    <!-- Step 7: Complete -->
                    <div v-else class="oobe-step-panel">
                        <h2 class="oobe-title text-foreground">{{ t('oobe.complete.title') }}</h2>
                        <p class="oobe-desc text-muted-foreground">{{ t('oobe.complete.subtitle') }}</p>
                        <Button size="lg" class="w-full" @click="finish">{{ t('oobe.complete.enter') }}</Button>
                    </div>
                </Transition>
            </div>
        </section>

        <OpenSourceSoftwareNoticeDialog v-if="ossDialog" v-model:ossDialog="ossDialog" />
    </div>
</template>

<script setup>
    import { computed, defineAsyncComponent, markRaw, nextTick, onMounted, ref, watch } from 'vue';
    import { gsap } from 'gsap';
    import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
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

    gsap.registerPlugin(DrawSVGPlugin);

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
    const currentIcon = computed(() => stepIcons[currentStep.value]);

    const iconWrapRef = ref(null);

    // Draw the per-step SVG icon with a GSAP DrawSVGPlugin stroke animation
    // (step 1 uses the static VRCX logo image, so there is no SVG to animate).
    /**
     *
     */
    function animateIcon() {
        const svg = iconWrapRef.value?.querySelector('svg.oobe-icon-svg');
        if (!svg) return;
        const shapes = svg.querySelectorAll('path, circle, line, polyline, rect');
        if (!shapes.length) return;
        gsap.killTweensOf(shapes);
        gsap.fromTo(
            shapes,
            { drawSVG: '0%' },
            {
                drawSVG: '100%',
                duration: 0.67,
                ease: 'sine.inOut',
                stagger: 0,
                overwrite: true
            }
        );
    }

    watch(currentStep, () => {
        nextTick(() => animateIcon());
    });

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

    /**
     * Data recovery (optional): import a backup database file, same as
     * "Settings > Advanced > Import Database".
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
                newDataStrategy: 'add'
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

<style scoped>
    .oobe {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 192px;
        width: 100%;
        height: 100%;
        padding: 40px;
        overflow: hidden;
        position: relative;
        z-index: 50;
        background-color: var(--background);
    }

    /* ---- Top bar ---- */
    .oobe-header {
        position: absolute;
        top: 24px;
        left: 36px;
        right: 36px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
    }

    .oobe-step-counter {
        font-size: 13px;
        font-weight: 500;
    }

    .oobe-progress {
        position: absolute;
        top: 78px;
        left: 36px;
        right: 36px;
        display: flex;
        gap: 6px;
    }

    .oobe-progress-segment {
        flex: 1;
        height: 4px;
        border-radius: 999px;
        background-color: var(--muted-foreground);
        opacity: 0.2;
        transition:
            opacity 0.3s ease,
            background-color 0.3s ease;
    }

    .oobe-progress-segment.active {
        opacity: 1;
        background-color: var(--primary);
    }

    /* ---- Left icon ---- */
    .oobe-left {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        width: 140px;
        height: 140px;
        flex: none;
    }

    .oobe-icon-wrap {
        position: absolute;
        inset: 0;
        margin: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 140px;
        height: 140px;
    }

    .oobe-vrcx-logo {
        width: 140px;
        height: 140px;
        border-radius: 24px;
    }

    .oobe-icon-svg {
        width: 140px;
        height: 140px;
    }

    .oobe-warning-list {
        margin: 0;
        padding-left: 1.1rem;
        list-style: disc;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 0.75rem;
    }

    /* ---- Right content ---- */
    .oobe-right {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .oobe-content {
        width: 440px;
        max-width: 440px;
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .oobe-step-panel {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .oobe-title {
        margin: 0;
        font-size: 26px;
        font-weight: 800;
        letter-spacing: -0.02em;
    }

    .oobe-desc {
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
    }

    .oobe-scroll {
        max-height: 220px;
        overflow-y: auto;
        padding: 12px;
        border-radius: 10px;
        border-width: 1px;
        border-style: solid;
        font-size: 12.5px;
        line-height: 1.7;
        background-color: var(--muted);
        border-color: var(--border);
    }

    .oobe-scroll p {
        margin: 0 0 8px;
    }

    .oobe-scroll p:last-child {
        margin-bottom: 0;
    }

    .oobe-account-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .oobe-account-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px;
        border-radius: 8px;
        cursor: pointer;
        color: var(--foreground);
    }

    .oobe-account-item:hover {
        background-color: var(--muted);
    }

    .oobe-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .oobe-actions > * {
        width: 100%;
    }

    .oobe-settings {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px;
        border-radius: 12px;
        border-width: 1px;
        border-style: solid;
        background-color: var(--muted);
        border-color: var(--border);
    }

    .oobe-setting {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 10px;
        cursor: pointer;
    }

    .oobe-setting-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .oobe-setting-label {
        font-size: 14px;
        font-weight: 600;
    }

    .oobe-setting-desc {
        font-size: 12px;
    }

    /* ---- Step content transition ---- */
    .oobe-content-enter-active,
    .oobe-content-leave-active {
        transition:
            opacity 0.3s ease,
            transform 0.3s ease;
    }

    .oobe-content-enter-from {
        opacity: 0;
        transform: translateX(16px);
    }

    .oobe-content-leave-to {
        opacity: 0;
        transform: translateX(-16px);
    }

    /* ---- Icon transition ---- */
    .oobe-icon-enter-active,
    .oobe-icon-leave-active {
        transition:
            opacity 0.3s ease,
            transform 0.3s ease;
    }

    .oobe-icon-enter-from {
        opacity: 0;
        transform: scale(0.85);
    }

    .oobe-icon-leave-to {
        opacity: 0;
        transform: scale(1.05);
    }

    /* ---- Responsive: keep the layout usable in smaller windows ---- */
    @media (max-width: 900px) {
        .oobe {
            gap: 48px;
            padding: 40px 24px;
        }

        .oobe-left,
        .oobe-icon-wrap,
        .oobe-vrcx-logo,
        .oobe-icon-svg {
            width: 100px;
            height: 100px;
        }

        .oobe-content {
            width: min(440px, calc(100vw - 200px));
        }
    }

    @media (max-width: 640px) {
        .oobe-left {
            display: none;
        }
    }
</style>
