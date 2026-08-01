<template>
    <div class="flex flex-col gap-10 py-2">
        <SettingsGroup :title="t('view.settings.advanced.advanced.vrchat_settings.header')">
            <SettingsItem
                :label="t('view.settings.advanced.advanced.relaunch_vrchat.header')"
                :description="t('view.settings.advanced.advanced.relaunch_vrchat.description')">
                <Switch :model-value="relaunchVRChatAfterCrash" @update:modelValue="setRelaunchVRChatAfterCrash" />
            </SettingsItem>

            <SettingsItem
                :label="t('view.settings.advanced.advanced.vrchat_quit_fix.header')"
                :description="t('view.settings.advanced.advanced.vrchat_quit_fix.description')">
                <Switch :model-value="vrcQuitFix" @update:modelValue="setVrcQuitFix" />
            </SettingsItem>

            <SettingsItem
                :label="t('view.settings.advanced.advanced.auto_cache_management.header')"
                :description="t('view.settings.advanced.advanced.auto_cache_management.description')">
                <Switch :model-value="autoSweepVRChatCache" @update:modelValue="setAutoSweepVRChatCache" />
            </SettingsItem>

            <SettingsItem
                :label="t('view.settings.advanced.advanced.self_invite.header')"
                :description="t('view.settings.advanced.advanced.self_invite.description')">
                <Switch :model-value="selfInviteOverride" @update:modelValue="setSelfInviteOverride" />
            </SettingsItem>
        </SettingsGroup>

        <SettingsGroup :title="t('view.settings.advanced_groups.security.header')">
            <SettingsItem
                :label="t('view.settings.advanced.advanced.primary_password.header')"
                :description="t('view.settings.advanced.advanced.primary_password.description')">
                <Switch
                    :model-value="enablePrimaryPassword"
                    :disabled="!enablePrimaryPassword"
                    @update:modelValue="enablePrimaryPasswordChange" />
            </SettingsItem>
        </SettingsGroup>

        <SettingsGroup :title="t('view.settings.general.logging.header')">
            <SettingsItem :label="t('view.settings.advanced.advanced.cache_debug.udon_exception_logging')">
                <Switch :model-value="udonExceptionLogging" @update:modelValue="setUdonExceptionLogging" />
            </SettingsItem>

            <SettingsItem :label="t('view.settings.general.logging.resource_load')">
                <Switch :model-value="logResourceLoad" @update:modelValue="setLogResourceLoad" />
            </SettingsItem>

            <SettingsItem :label="t('view.settings.general.logging.empty_avatar')">
                <Switch :model-value="logEmptyAvatars" @update:modelValue="setLogEmptyAvatars" />
            </SettingsItem>

            <SettingsItem :label="t('view.settings.general.logging.auto_login_delay')">
                <Switch :model-value="autoLoginDelayEnabled" @update:modelValue="setAutoLoginDelayEnabled" />
            </SettingsItem>

            <SettingsItem
                v-if="autoLoginDelayEnabled"
                :label="t('view.settings.general.logging.auto_login_delay_button')">
                <Button size="sm" variant="outline" @click="promptAutoLoginDelaySeconds">
                    {{ t('view.settings.general.logging.auto_login_delay_button') }}
                </Button>
            </SettingsItem>
        </SettingsGroup>

        <template v-if="!isLinux">
            <SettingsGroup :title="t('view.settings.advanced.advanced.app_launcher.header')">
                <SettingsItem :label="t('view.settings.advanced.advanced.app_launcher.folder')">
                    <Button size="sm" variant="outline" @click="openShortcutFolder()">{{
                        t('view.settings.advanced.advanced.app_launcher.folder')
                    }}</Button>
                </SettingsItem>

                <SettingsItem
                    :label="t('view.settings.advanced.advanced.remote_database.enable')"
                    :description="t('view.settings.advanced.advanced.app_launcher.folder_tooltip')">
                    <Switch :model-value="enableAppLauncher" @update:modelValue="setEnableAppLauncher" />
                </SettingsItem>

                <SettingsItem :label="t('view.settings.advanced.advanced.app_launcher.auto_close')">
                    <Switch
                        :model-value="enableAppLauncherAutoClose"
                        @update:modelValue="setEnableAppLauncherAutoClose" />
                </SettingsItem>

                <SettingsItem :label="t('view.settings.advanced.advanced.app_launcher.run_process_once')">
                    <Switch
                        :model-value="enableAppLauncherRunProcessOnce"
                        @update:modelValue="setEnableAppLauncherRunProcessOnce" />
                </SettingsItem>
            </SettingsGroup>
        </template>

        <SettingsGroup :title="t('view.settings.advanced.advanced.launch_commands.header')">
            <SettingsItem
                :label="t('view.settings.advanced.advanced.launch_commands.show_confirmation_on_switch_avatar_enable')"
                :description="
                    t('view.settings.advanced.advanced.launch_commands.show_confirmation_on_switch_avatar_tooltip')
                ">
                <Switch
                    :model-value="showConfirmationOnSwitchAvatar"
                    @update:modelValue="setShowConfirmationOnSwitchAvatar" />
            </SettingsItem>

            <div class="flex gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    @click="
                        openExternalLink(
                            'https://github.com/Yusurmount/VRCX-Pro/wiki/Launch-parameters-&-VRCX.json'
                        )
                    "
                    >{{ t('view.settings.advanced.advanced.launch_commands.docs') }}</Button
                >
                <Button
                    size="sm"
                    variant="outline"
                    @click="openExternalLink('https://github.com/Myrkie/open-in-vrcx')"
                    >{{ t('view.settings.advanced.advanced.launch_commands.website_userscript') }}</Button
                >
            </div>
        </SettingsGroup>

        <SettingsGroup :title="t('view.settings.advanced.advanced.cache_debug.header')">
            <div class="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" @click="clearVRCXCache">{{
                    t('view.settings.advanced.advanced.cache_debug.clear_cache')
                }}</Button>
                <Button size="sm" variant="outline" @click="promptAutoClearVRCXCacheFrequency">{{
                    t('view.settings.advanced.advanced.cache_debug.auto_clear_cache')
                }}</Button>
                <Button size="sm" variant="outline" @click="refreshCacheSize">{{
                    t('view.settings.advanced.advanced.cache_debug.refresh_cache')
                }}</Button>
            </div>

            <SettingsItem
                :label="`${t('view.settings.advanced.advanced.cache_debug.disable_gamelog')} ${t('view.settings.advanced.advanced.cache_debug.disable_gamelog_notice')}`">
                <Switch :model-value="gameLogDisabled" @update:modelValue="disableGameLogDialog()" />
            </SettingsItem>

            <div class="flex flex-col gap-1 text-sm">
                <span
                    >{{ t('view.settings.advanced.advanced.cache_debug.user_cache') }}
                    <span v-text="cacheSize.cachedUsers"></span
                ></span>
                <span
                    >{{ t('view.settings.advanced.advanced.cache_debug.world_cache') }}
                    <span v-text="cacheSize.cachedWorlds"></span
                ></span>
                <span
                    >{{ t('view.settings.advanced.advanced.cache_debug.avatar_cache') }}
                    <span v-text="cacheSize.cachedAvatars"></span
                ></span>
                <span
                    >{{ t('view.settings.advanced.advanced.cache_debug.group_cache') }}
                    <span v-text="cacheSize.cachedGroups"></span
                ></span>
                <span
                    >{{ t('view.settings.advanced.advanced.cache_debug.avatar_name_cache') }}
                    <span v-text="cacheSize.cachedAvatarNames"></span
                ></span>
                <span
                    >{{ t('view.settings.advanced.advanced.cache_debug.instance_cache') }}
                    <span v-text="cacheSize.cachedInstances"></span
                ></span>
            </div>

            <SettingsItem :label="t('view.settings.advanced.advanced.cache_debug.show_console')">
                <Button size="sm" variant="outline" @click="showConsole">{{
                    t('view.settings.advanced.advanced.cache_debug.show_console')
                }}</Button>
            </SettingsItem>
        </SettingsGroup>

        <SettingsGroup :title="t('view.settings.advanced_groups.database.header')">
            <SettingsItem :label="t('view.settings.advanced.advanced.sqlite_table_size.refresh')">
                <Button size="sm" variant="outline" @click="getSqliteTableSizes">{{
                    t('view.settings.advanced.advanced.sqlite_table_size.refresh')
                }}</Button>
            </SettingsItem>

            <div class="flex flex-col gap-1 text-sm">
                <span
                    >{{ t('view.settings.advanced.advanced.sqlite_table_size.gps') }}
                    <span v-text="sqliteTableSizes.gps"></span
                ></span>
                <span
                    >{{ t('view.settings.advanced.advanced.sqlite_table_size.status') }}
                    <span v-text="sqliteTableSizes.status"></span
                ></span>
                <span
                    >{{ t('view.settings.advanced.advanced.sqlite_table_size.bio') }}
                    <span v-text="sqliteTableSizes.bio"></span
                ></span>
                <span
                    >{{ t('view.settings.advanced.advanced.sqlite_table_size.avatar') }}
                    <span v-text="sqliteTableSizes.avatar"></span
                ></span>
                <span
                    >{{ t('view.settings.advanced.advanced.sqlite_table_size.online_offline') }}
                    <span v-text="sqliteTableSizes.onlineOffline"></span
                ></span>
                <span
                    >{{ t('view.settings.advanced.advanced.sqlite_table_size.friend_log_history') }}
                    <span v-text="sqliteTableSizes.friendLogHistory"></span
                ></span>
                <span
                    >{{ t('view.settings.advanced.advanced.sqlite_table_size.notification') }}
                    <span v-text="sqliteTableSizes.notification"></span
                ></span>
                <span
                    >{{ t('view.settings.advanced.advanced.sqlite_table_size.location') }}
                    <span v-text="sqliteTableSizes.location"></span
                ></span>
                <span
                    >{{ t('view.settings.advanced.advanced.sqlite_table_size.join_leave') }}
                    <span v-text="sqliteTableSizes.joinLeave"></span
                ></span>
                <span
                    >{{ t('view.settings.advanced.advanced.sqlite_table_size.portal_spawn') }}
                    <span v-text="sqliteTableSizes.portalSpawn"></span
                ></span>
                <span
                    >{{ t('view.settings.advanced.advanced.sqlite_table_size.video_play') }}
                    <span v-text="sqliteTableSizes.videoPlay"></span
                ></span>
                <span
                    >{{ t('view.settings.advanced.advanced.sqlite_table_size.event') }}
                    <span v-text="sqliteTableSizes.event"></span
                ></span>
            </div>

            <SettingsItem
                :label="t('view.settings.advanced.advanced.db_export.button')"
                :description="t('view.settings.advanced.advanced.db_export.description')">
                <Button size="sm" variant="outline" :disabled="exportInProgress" @click="confirmExport">
                    <Download class="h-4 w-4 mr-1" />
                    {{ t('view.settings.advanced.advanced.db_export.button') }}
                </Button>
            </SettingsItem>

            <SettingsItem
                :label="t('view.settings.advanced.advanced.db_import.button')"
                :description="t('view.settings.advanced.advanced.db_import.description')">
                <Button size="sm" variant="outline" :disabled="importInProgress" @click="confirmImport">
                    <Upload class="h-4 w-4 mr-1" />
                    {{ t('view.settings.advanced.advanced.db_import.button') }}
                </Button>
            </SettingsItem>

            <SettingsItem :label="t('view.settings.advanced.advanced.db_reset.button')">
                <Button
                    size="sm"
                    variant="destructive"
                    :disabled="resetInProgress"
                    @click="isResetDialogVisible = true">
                    <Trash2 class="h-4 w-4 mr-1" />
                    {{ t('view.settings.advanced.advanced.db_reset.button') }}
                </Button>
            </SettingsItem>
        </SettingsGroup>

        <SettingsGroup :title="t('view.settings.advanced.advanced.database_cleanup.header')">
            <SettingsItem
                :label="t('view.settings.advanced.advanced.database_cleanup.auto_cleanup')"
                :description="t('view.settings.advanced.advanced.database_cleanup.auto_cleanup_description')">
                <Select :model-value="avatarAutoCleanup" @update:modelValue="setAvatarAutoCleanup">
                    <SelectTrigger class="w-36">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectItem value="Off">{{
                                t('view.settings.advanced.advanced.database_cleanup.auto_cleanup_off')
                            }}</SelectItem>
                            <SelectItem value="30">{{
                                t('view.settings.advanced.advanced.database_cleanup.auto_cleanup_30')
                            }}</SelectItem>
                            <SelectItem value="90">{{
                                t('view.settings.advanced.advanced.database_cleanup.auto_cleanup_90')
                            }}</SelectItem>
                            <SelectItem value="180">{{
                                t('view.settings.advanced.advanced.database_cleanup.auto_cleanup_180')
                            }}</SelectItem>
                            <SelectItem value="365">{{
                                t('view.settings.advanced.advanced.database_cleanup.auto_cleanup_365')
                            }}</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </SettingsItem>

            <SettingsItem :label="t('view.settings.advanced.advanced.database_cleanup.purge_button')">
                <Button size="sm" variant="outline" @click="isPurgeDialogVisible = true">
                    <Trash2 class="h-4 w-4 mr-1" />
                    {{ t('view.settings.advanced.advanced.database_cleanup.purge') }}
                </Button>
            </SettingsItem>
        </SettingsGroup>

        <Dialog
            :open="isPurgeDialogVisible"
            @update:open="
                (open) => {
                    if (!open) isPurgeDialogVisible = false;
                }
            ">
            <DialogContent class="x-dialog sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{{
                        t('view.settings.advanced.advanced.database_cleanup.purge_confirm_title')
                    }}</DialogTitle>
                </DialogHeader>

                <Alert variant="warning" class="mb-3">
                    <TriangleAlert />
                    <AlertDescription>
                        {{ t('view.settings.advanced.advanced.database_cleanup.purge_confirm_alert') }}
                    </AlertDescription>
                </Alert>

                <div class="flex flex-col gap-1 text-sm text-muted-foreground mb-3">
                    <p>{{ t('view.settings.advanced.advanced.database_cleanup.purge_confirm_description_1') }}</p>
                    <p>{{ t('view.settings.advanced.advanced.database_cleanup.purge_confirm_description_2') }}</p>
                    <p>{{ t('view.settings.advanced.advanced.database_cleanup.purge_confirm_description_3') }}</p>
                </div>

                <SettingsItem :label="t('view.settings.advanced.advanced.database_cleanup.purge_older_than')">
                    <Select v-model="selectedPurgePeriod">
                        <SelectTrigger class="w-36">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value="180">{{
                                    t('view.settings.advanced.advanced.database_cleanup.purge_option_180')
                                }}</SelectItem>
                                <SelectItem value="365">{{
                                    t('view.settings.advanced.advanced.database_cleanup.purge_option_365')
                                }}</SelectItem>
                                <SelectItem value="730">{{
                                    t('view.settings.advanced.advanced.database_cleanup.purge_option_730')
                                }}</SelectItem>
                                <SelectItem value="all">{{
                                    t('view.settings.advanced.advanced.database_cleanup.purge_option_all')
                                }}</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </SettingsItem>

                <DialogFooter>
                    <Button variant="outline" size="sm" @click="isPurgeDialogVisible = false">
                        {{ t('confirm.cancel_button') }}
                    </Button>
                    <Button size="sm" variant="destructive" :disabled="purgeInProgress" @click="handlePurge">
                        <Trash2 class="h-4 w-4 mr-1" />
                        {{ t('view.settings.advanced.advanced.database_cleanup.purge_confirm_button') }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- Export Progress Dialog -->
        <Dialog
            :open="isExportDialogVisible"
            @update:open="
                (open) => {
                    if (!open) isExportDialogVisible = false;
                }
            ">
            <DialogContent class="x-dialog sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{{ t('view.settings.advanced.advanced.db_export.confirm_title') }}</DialogTitle>
                </DialogHeader>
                <div class="flex flex-col gap-4 py-2">
                    <template v-if="exportPhase === 'confirm'">
                        <Alert variant="warning" class="mb-2">
                            <TriangleAlert class="h-4 w-4" />
                            <AlertDescription>
                                {{ t('view.settings.advanced.advanced.db_export.confirm_not_encrypted') }}
                            </AlertDescription>
                        </Alert>
                        <p class="text-sm text-muted-foreground">
                            {{ t('view.settings.advanced.advanced.db_export.confirm_message') }}
                        </p>
                    </template>
                    <template v-else-if="exportPhase === 'in_progress'">
                        <p class="text-sm">
                            {{
                                t('view.settings.advanced.advanced.db_export.exporting', {
                                    current: exportProgress.current,
                                    total: exportProgress.total
                                })
                            }}
                        </p>
                        <div class="w-full bg-secondary rounded-full h-2">
                            <div
                                class="bg-primary h-2 rounded-full transition-all"
                                :style="{ width: exportProgress.percent + '%' }"></div>
                        </div>
                    </template>
                    <template v-else-if="exportPhase === 'done'">
                        <Alert variant="default" class="mb-2 border-green-500/50">
                            <AlertDescription>
                                {{ t('view.settings.advanced.advanced.db_export.success', { path: exportResult }) }}
                            </AlertDescription>
                        </Alert>
                    </template>
                    <template v-else-if="exportPhase === 'error'">
                        <Alert variant="destructive" class="mb-2">
                            <AlertDescription>
                                {{ t('view.settings.advanced.advanced.db_export.error', { error: exportError }) }}
                            </AlertDescription>
                        </Alert>
                    </template>
                </div>
                <DialogFooter>
                    <template v-if="exportPhase === 'confirm'">
                        <Button variant="outline" size="sm" @click="isExportDialogVisible = false">
                            {{ t('confirm.cancel_button') }}
                        </Button>
                        <Button size="sm" @click="handleExport">
                            <Download class="h-4 w-4 mr-1" />
                            {{ t('view.settings.advanced.advanced.db_export.button') }}
                        </Button>
                    </template>
                    <template v-else-if="exportPhase === 'in_progress'">
                        <Button variant="outline" size="sm" disabled>
                            {{
                                t('view.settings.advanced.advanced.db_export.exporting', {
                                    current: exportProgress.current,
                                    total: exportProgress.total
                                })
                            }}
                        </Button>
                    </template>
                    <template v-else>
                        <Button variant="outline" size="sm" @click="isExportDialogVisible = false">
                            {{ t('confirm.cancel_button') }}
                        </Button>
                    </template>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- Import Dialog -->
        <Dialog
            :open="isImportDialogVisible"
            @update:open="
                (open) => {
                    if (!open) isImportDialogVisible = false;
                }
            ">
            <DialogContent class="x-dialog sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        <template v-if="importPhase === 'strategy'">
                            {{ t('view.settings.advanced.advanced.db_import.strategy_title') }}
                        </template>
                        <template v-else-if="importPhase === 'confirm'">
                            {{ t('view.settings.advanced.advanced.db_import.confirm_title') }}
                        </template>
                        <template v-else-if="importPhase === 'reading' || importPhase === 'importing'">
                            {{ t('view.settings.advanced.advanced.db_import.progress_title') }}
                        </template>
                        <template v-else-if="importPhase === 'report'">
                            {{ t('view.settings.advanced.advanced.db_import.report_title') }}
                        </template>
                        <template v-else>
                            {{ t('view.settings.advanced.advanced.db_import.confirm_title') }}
                        </template>
                    </DialogTitle>
                </DialogHeader>

                <div class="flex flex-col gap-4 py-2">
                    <!-- Strategy Selection Phase -->
                    <template v-if="importPhase === 'strategy'">
                        <p class="text-sm text-muted-foreground">
                            {{ t('view.settings.advanced.advanced.db_import.strategy_description') }}
                        </p>

                        <div class="space-y-4">
                            <!-- Existing data strategy -->
                            <div class="space-y-2">
                                <Label class="text-sm font-medium">
                                    {{ t('view.settings.advanced.advanced.db_import.strategy_conflict_label') }}
                                </Label>
                                <RadioGroup v-model="conflictStrategy" class="grid gap-2">
                                    <div
                                        class="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                                        :class="conflictStrategy === 'overwrite' ? 'border-primary' : ''">
                                        <RadioGroupItem id="conflict-overwrite" value="overwrite" />
                                        <div class="flex flex-col gap-1">
                                            <Label for="conflict-overwrite" class="text-sm font-medium cursor-pointer">
                                                {{ t('view.settings.advanced.advanced.db_import.strategy_overwrite') }}
                                            </Label>
                                            <p class="text-xs text-muted-foreground">
                                                {{
                                                    t(
                                                        'view.settings.advanced.advanced.db_import.strategy_overwrite_desc'
                                                    )
                                                }}
                                            </p>
                                        </div>
                                    </div>
                                    <div
                                        class="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                                        :class="conflictStrategy === 'skip' ? 'border-primary' : ''">
                                        <RadioGroupItem id="conflict-skip" value="skip" />
                                        <div class="flex flex-col gap-1">
                                            <Label for="conflict-skip" class="text-sm font-medium cursor-pointer">
                                                {{
                                                    t(
                                                        'view.settings.advanced.advanced.db_import.strategy_skip_existing'
                                                    )
                                                }}
                                            </Label>
                                            <p class="text-xs text-muted-foreground">
                                                {{
                                                    t(
                                                        'view.settings.advanced.advanced.db_import.strategy_skip_existing_desc'
                                                    )
                                                }}
                                            </p>
                                        </div>
                                    </div>
                                </RadioGroup>
                            </div>

                            <!-- New data strategy -->
                            <div class="space-y-2">
                                <Label class="text-sm font-medium">
                                    {{ t('view.settings.advanced.advanced.db_import.strategy_new_label') }}
                                </Label>
                                <RadioGroup v-model="newDataStrategy" class="grid gap-2">
                                    <div
                                        class="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                                        :class="newDataStrategy === 'add' ? 'border-primary' : ''">
                                        <RadioGroupItem id="new-add" value="add" />
                                        <div class="flex flex-col gap-1">
                                            <Label for="new-add" class="text-sm font-medium cursor-pointer">
                                                {{ t('view.settings.advanced.advanced.db_import.strategy_add') }}
                                            </Label>
                                            <p class="text-xs text-muted-foreground">
                                                {{ t('view.settings.advanced.advanced.db_import.strategy_add_desc') }}
                                            </p>
                                        </div>
                                    </div>
                                    <div
                                        class="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                                        :class="newDataStrategy === 'skip' ? 'border-primary' : ''">
                                        <RadioGroupItem id="new-skip" value="skip" />
                                        <div class="flex flex-col gap-1">
                                            <Label for="new-skip" class="text-sm font-medium cursor-pointer">
                                                {{ t('view.settings.advanced.advanced.db_import.strategy_skip_new') }}
                                            </Label>
                                            <p class="text-xs text-muted-foreground">
                                                {{
                                                    t(
                                                        'view.settings.advanced.advanced.db_import.strategy_skip_new_desc'
                                                    )
                                                }}
                                            </p>
                                        </div>
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>
                    </template>

                    <!-- File Reading Phase -->
                    <template v-else-if="importPhase === 'reading'">
                        <p class="text-sm">{{ t('view.settings.advanced.advanced.db_import.reading') }}</p>
                        <Spinner class="h-5 w-5 mx-auto" />
                    </template>

                    <!-- Confirmation Phase -->
                    <template v-else-if="importPhase === 'confirm'">
                        <Alert variant="default" class="mb-2 border-blue-500/50">
                            <AlertDescription class="text-sm">
                                {{ t('view.settings.advanced.advanced.db_import.confirm_message') }}
                            </AlertDescription>
                        </Alert>

                        <div class="rounded-md border p-3 space-y-2 text-sm">
                            <div class="flex justify-between">
                                <span class="text-muted-foreground">{{
                                    t('view.settings.advanced.advanced.db_import.summary_tables')
                                }}</span>
                                <span class="font-medium">{{ importFileSummary?.tableCount }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-muted-foreground">{{
                                    t('view.settings.advanced.advanced.db_import.summary_records')
                                }}</span>
                                <span class="font-medium">{{ importFileSummary?.totalRecords }}</span>
                            </div>
                            <div class="border-t pt-2 mt-2">
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">{{
                                        t('view.settings.advanced.advanced.db_import.strategy_conflict_label')
                                    }}</span>
                                    <span class="font-medium">{{
                                        conflictStrategy === 'overwrite'
                                            ? t('view.settings.advanced.advanced.db_import.strategy_overwrite')
                                            : t('view.settings.advanced.advanced.db_import.strategy_skip_existing')
                                    }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">{{
                                        t('view.settings.advanced.advanced.db_import.strategy_new_label')
                                    }}</span>
                                    <span class="font-medium">{{
                                        newDataStrategy === 'add'
                                            ? t('view.settings.advanced.advanced.db_import.strategy_add')
                                            : t('view.settings.advanced.advanced.db_import.strategy_skip_new')
                                    }}</span>
                                </div>
                            </div>
                        </div>
                    </template>

                    <!-- Importing Phase -->
                    <template v-else-if="importPhase === 'importing'">
                        <p class="text-sm">
                            {{
                                t('view.settings.advanced.advanced.db_import.importing', {
                                    progress: Math.round(importProgressPercent)
                                })
                            }}
                        </p>
                        <div class="w-full bg-secondary rounded-full h-2">
                            <div
                                class="bg-primary h-2 rounded-full transition-all"
                                :style="{ width: importProgressPercent + '%' }"></div>
                        </div>
                    </template>

                    <!-- Report Phase -->
                    <template v-else-if="importPhase === 'report'">
                        <Alert variant="default" class="mb-2 border-green-500/50">
                            <AlertDescription>
                                {{
                                    t('view.settings.advanced.advanced.db_import.success', {
                                        importedCount: importReport.overwritten + importReport.added,
                                        tablesProcessed: importReport.tables.length
                                    })
                                }}
                            </AlertDescription>
                        </Alert>

                        <div class="rounded-md border p-3 space-y-2 text-sm">
                            <div class="flex justify-between text-green-600 dark:text-green-400">
                                <span>{{ t('view.settings.advanced.advanced.db_import.report_overwritten') }}</span>
                                <span class="font-medium">{{ importReport.overwritten }}</span>
                            </div>
                            <div class="flex justify-between text-blue-600 dark:text-blue-400">
                                <span>{{ t('view.settings.advanced.advanced.db_import.report_added') }}</span>
                                <span class="font-medium">{{ importReport.added }}</span>
                            </div>
                            <div
                                v-if="importReport.skippedExisting > 0"
                                class="flex justify-between text-muted-foreground">
                                <span>{{
                                    t('view.settings.advanced.advanced.db_import.report_skipped_existing')
                                }}</span>
                                <span class="font-medium">{{ importReport.skippedExisting }}</span>
                            </div>
                            <div v-if="importReport.skippedNew > 0" class="flex justify-between text-muted-foreground">
                                <span>{{ t('view.settings.advanced.advanced.db_import.report_skipped_new') }}</span>
                                <span class="font-medium">{{ importReport.skippedNew }}</span>
                            </div>
                            <div class="border-t pt-2 flex justify-between font-medium">
                                <span>{{ t('view.settings.advanced.advanced.db_import.report_total') }}</span>
                                <span>{{ importReport.totalProcessed }}</span>
                            </div>
                        </div>

                        <!-- Per-table breakdown -->
                        <details class="text-sm">
                            <summary class="cursor-pointer text-muted-foreground hover:text-foreground">
                                {{ t('view.settings.advanced.advanced.db_import.report_details') }}
                            </summary>
                            <div class="mt-2 max-h-48 overflow-y-auto space-y-1">
                                <div
                                    v-for="t in importReport.tables"
                                    :key="t.tableName"
                                    class="flex justify-between text-xs py-1 px-2 rounded hover:bg-muted">
                                    <span class="truncate max-w-[180px]" :title="t.tableName">{{ t.tableName }}</span>
                                    <span class="shrink-0">
                                        <span
                                            v-if="t.overwritten > 0"
                                            class="text-green-600 dark:text-green-400 ml-1"
                                            :title="t('view.settings.advanced.advanced.db_import.report_overwritten')"
                                            >+{{ t.overwritten }}O</span
                                        >
                                        <span
                                            v-if="t.added > 0"
                                            class="text-blue-600 dark:text-blue-400 ml-1"
                                            :title="t('view.settings.advanced.advanced.db_import.report_added')"
                                            >+{{ t.added }}A</span
                                        >
                                        <span
                                            v-if="t.skippedExisting > 0"
                                            class="text-muted-foreground ml-1"
                                            :title="
                                                t('view.settings.advanced.advanced.db_import.report_skipped_existing')
                                            "
                                            >-{{ t.skippedExisting }}SE</span
                                        >
                                        <span
                                            v-if="t.skippedNew > 0"
                                            class="text-muted-foreground ml-1"
                                            :title="t('view.settings.advanced.advanced.db_import.report_skipped_new')"
                                            >-{{ t.skippedNew }}SN</span
                                        >
                                    </span>
                                </div>
                            </div>
                        </details>
                    </template>

                    <!-- Error Phase -->
                    <template v-else-if="importPhase === 'error'">
                        <Alert variant="destructive" class="mb-2">
                            <AlertDescription>
                                {{ t('view.settings.advanced.advanced.db_import.error', { error: importError }) }}
                            </AlertDescription>
                        </Alert>
                    </template>
                </div>

                <DialogFooter>
                    <!-- Strategy: show Select file + Cancel -->
                    <template v-if="importPhase === 'strategy'">
                        <Button variant="outline" size="sm" @click="isImportDialogVisible = false">
                            {{ t('confirm.cancel_button') }}
                        </Button>
                        <Button size="sm" @click="handleImportFileSelect">
                            <Upload class="h-4 w-4 mr-1" />
                            {{ t('view.settings.advanced.advanced.db_import.select_file') }}
                        </Button>
                    </template>

                    <!-- Reading: disabled -->
                    <template v-else-if="importPhase === 'reading'">
                        <Button variant="outline" size="sm" disabled>
                            {{ t('view.settings.advanced.advanced.db_import.reading') }}
                        </Button>
                    </template>

                    <!-- Confirm: back + start import -->
                    <template v-else-if="importPhase === 'confirm'">
                        <Button variant="outline" size="sm" @click="backToStrategy">
                            {{ t('common.actions.back') }}
                        </Button>
                        <Button size="sm" @click="handleImport">
                            <Upload class="h-4 w-4 mr-1" />
                            {{ t('view.settings.advanced.advanced.db_import.button') }}
                        </Button>
                    </template>

                    <!-- Importing: disabled -->
                    <template v-else-if="importPhase === 'importing'">
                        <Button variant="outline" size="sm" disabled>
                            {{
                                t('view.settings.advanced.advanced.db_import.importing', {
                                    progress: Math.round(importProgressPercent)
                                })
                            }}
                        </Button>
                    </template>

                    <!-- Report: close -->
                    <template v-else-if="importPhase === 'report'">
                        <Button variant="outline" size="sm" @click="isImportDialogVisible = false">
                            {{ t('confirm.cancel_button') }}
                        </Button>
                    </template>

                    <!-- Error: close -->
                    <template v-else>
                        <Button variant="outline" size="sm" @click="isImportDialogVisible = false">
                            {{ t('confirm.cancel_button') }}
                        </Button>
                    </template>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- Reset Database Dialog -->
        <Dialog
            :open="isResetDialogVisible"
            @update:open="
                (open) => {
                    if (!open) isResetDialogVisible = false;
                }
            ">
            <DialogContent class="x-dialog sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {{ t('view.settings.advanced.advanced.db_reset.warning_title') }}
                    </DialogTitle>
                </DialogHeader>

                <template v-if="resetPhase === 'confirm'">
                    <Alert variant="destructive" class="mb-3">
                        <TriangleAlert />
                        <AlertDescription>
                            {{ t('view.settings.advanced.advanced.db_reset.warning_alert') }}
                        </AlertDescription>
                    </Alert>

                    <div class="flex flex-col gap-2 text-sm text-muted-foreground mb-3">
                        <p>{{ t('view.settings.advanced.advanced.db_reset.warning_description') }}</p>
                        <p>{{ t('view.settings.advanced.advanced.db_reset.warning_items') }}</p>
                        <p class="font-semibold text-destructive">
                            {{ t('view.settings.advanced.advanced.db_reset.warning_confirmation') }}
                        </p>
                    </div>

                    <div class="space-y-2 mb-3">
                        <Label class="text-sm">
                            {{
                                t('view.settings.advanced.advanced.db_reset.input_label', {
                                    required: confirmationRequiredText
                                })
                            }}
                        </Label>
                        <Input
                            v-model="resetConfirmInput"
                            :placeholder="t('view.settings.advanced.advanced.db_reset.input_placeholder')"
                            :class="resetInputError ? 'border-destructive' : ''" />
                        <p v-if="resetInputError" class="text-xs text-destructive">
                            {{ t('view.settings.advanced.advanced.db_reset.input_error') }}
                        </p>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" @click="isResetDialogVisible = false">
                            {{ t('confirm.cancel_button') }}
                        </Button>
                        <Button size="sm" variant="destructive" @click="handleResetDatabase">
                            <Trash2 class="h-4 w-4 mr-1" />
                            {{ t('view.settings.advanced.advanced.db_reset.button') }}
                        </Button>
                    </DialogFooter>
                </template>

                <template v-else-if="resetPhase === 'in_progress'">
                    <div class="flex flex-col gap-4 py-4 items-center">
                        <Spinner class="h-6 w-6" />
                        <p class="text-sm text-muted-foreground">
                            {{ t('view.settings.advanced.advanced.db_reset.in_progress') }}
                        </p>
                    </div>
                </template>

                <template v-else-if="resetPhase === 'error'">
                    <Alert variant="destructive" class="mb-3">
                        <TriangleAlert />
                        <AlertDescription>
                            {{ t('view.settings.advanced.advanced.db_reset.error', { error: resetError }) }}
                        </AlertDescription>
                    </Alert>
                    <DialogFooter>
                        <Button variant="outline" size="sm" @click="isResetDialogVisible = false">
                            {{ t('confirm.cancel_button') }}
                        </Button>
                    </DialogFooter>
                </template>
            </DialogContent>
        </Dialog>

        <SettingsGroup :title="t('view.settings.advanced_groups.diagnostics.header')">
            <SettingsItem :label="t('view.profile.game_info.online_users')">
                <div class="flex items-center gap-2">
                    <span v-if="visits !== null" class="text-sm text-muted-foreground">{{
                        t('view.profile.game_info.user_online', { count: visits })
                    }}</span>
                    <Button size="sm" variant="outline" @click="getVisits">{{ t('common.actions.refresh') }}</Button>
                </div>
            </SettingsItem>

            <SettingsItem :label="t('view.profile.config_json')">
                <div class="flex items-center gap-2">
                    <Button size="sm" variant="outline" @click="refreshConfigTreeData()">{{
                        t('common.actions.refresh')
                    }}</Button>
                    <Button
                        v-if="Object.keys(configTreeData).length > 0"
                        size="sm"
                        variant="outline"
                        @click="configTreeData = {}"
                        >{{ t('common.actions.clear') }}</Button
                    >
                </div>
            </SettingsItem>
            <vue-json-pretty
                v-if="Object.keys(configTreeData).length > 0"
                :data="configTreeData"
                :deep="2"
                :theme="isDarkMode ? 'dark' : 'light'"
                :height="800"
                :dynamic-height="false"
                virtual
                show-icon />
        </SettingsGroup>

        <template v-if="branch === 'Nightly'">
            <SettingsGroup :title="t('view.settings.advanced_groups.nightly.header')">
                <SettingsItem
                    :label="t('view.settings.advanced.advanced.anonymous_error_reporting.header')"
                    :description="t('view.settings.advanced.advanced.anonymous_error_reporting.description')">
                    <Switch :model-value="sentryErrorReporting" @update:modelValue="setSentryErrorReporting()" />
                </SettingsItem>
            </SettingsGroup>
        </template>

        <RegistryBackupDialog />
        <PhotonSettings v-if="photonLoggingEnabled" />
    </div>
</template>

<script setup>
    import { Trash2, TriangleAlert, Download, Upload } from 'lucide-vue-next';
    import { computed, reactive, ref } from 'vue';
    import { toast } from 'vue-sonner';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Switch } from '@/components/ui/switch';
    import { Label } from '@/components/ui/label';
    import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
    import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Alert, AlertDescription } from '@/components/ui/alert';
    import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Spinner } from '@/components/ui/spinner';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import VueJsonPretty from 'vue-json-pretty';

    import {
        useAdvancedSettingsStore,
        useAppearanceSettingsStore,
        useAuthStore,
        useAvatarStore,
        useGeneralSettingsStore,
        useGroupStore,
        useInstanceStore,
        usePhotonStore,
        useUiStore,
        useUserStore,
        useVRCXUpdaterStore,
        useWorldStore
    } from '@/stores';
    import { authRequest, queryRequest } from '@/api';
    import { disableGameLogDialog } from '@/coordinators/gameLogCoordinator';
    import { clearVRCXCache } from '@/coordinators/vrcxCoordinator';
    import { openExternalLink } from '@/shared/utils';
    import { exportDatabaseData, readImportFile, executeImport } from '@/services/database/exportImport';

    import PhotonSettings from '../PhotonSettings.vue';
    import RegistryBackupDialog from '../../../Tools/dialogs/RegistryBackupDialog.vue';
    import SettingsGroup from '../SettingsGroup.vue';
    import SettingsItem from '../SettingsItem.vue';

    const { t } = useI18n();

    const advancedSettingsStore = useAdvancedSettingsStore();
    const { enablePrimaryPasswordChange } = useAuthStore();
    const { cachedConfig } = storeToRefs(useAuthStore());
    const { showConsole } = useUiStore();

    const generalSettingsStore = useGeneralSettingsStore();
    const { udonExceptionLogging, logResourceLoad, logEmptyAvatars, autoLoginDelayEnabled } =
        storeToRefs(generalSettingsStore);
    const {
        setUdonExceptionLogging,
        setLogResourceLoad,
        setLogEmptyAvatars,
        setAutoLoginDelayEnabled,
        promptAutoLoginDelaySeconds
    } = generalSettingsStore;

    const { cachedUsers } = useUserStore();
    const { cachedWorlds } = useWorldStore();
    const { cachedAvatars, cachedAvatarNames } = useAvatarStore();
    const { cachedGroups } = useGroupStore();
    const { cachedInstances } = useInstanceStore();

    const { photonLoggingEnabled } = storeToRefs(usePhotonStore());
    const vrcxUpdaterStore = useVRCXUpdaterStore();
    const { branch } = storeToRefs(vrcxUpdaterStore);

    const { isDarkMode } = storeToRefs(useAppearanceSettingsStore());

    const {
        enablePrimaryPassword,
        relaunchVRChatAfterCrash,
        vrcQuitFix,
        autoSweepVRChatCache,
        selfInviteOverride,
        enableAppLauncher,
        enableAppLauncherAutoClose,
        enableAppLauncherRunProcessOnce,
        showConfirmationOnSwitchAvatar,
        gameLogDisabled,
        sqliteTableSizes,
        avatarAutoCleanup,
        purgeInProgress,
        sentryErrorReporting
    } = storeToRefs(advancedSettingsStore);

    const {
        setRelaunchVRChatAfterCrash,
        setVrcQuitFix,
        setAutoSweepVRChatCache,
        setSelfInviteOverride,
        setEnableAppLauncher,
        setEnableAppLauncherAutoClose,
        setEnableAppLauncherRunProcessOnce,
        setShowConfirmationOnSwitchAvatar,
        getSqliteTableSizes,
        setAvatarAutoCleanup,
        purgeAvatarFeedData,
        promptAutoClearVRCXCacheFrequency,
        setSentryErrorReporting
    } = advancedSettingsStore;

    const configTreeData = ref({});
    const visits = ref(null);
    const selectedPurgePeriod = ref('180');
    const isPurgeDialogVisible = ref(false);

    // Database Export/Import state
    const isExportDialogVisible = ref(false);
    const exportPhase = ref('confirm'); // 'confirm' | 'in_progress' | 'done' | 'error'
    const exportInProgress = ref(false);
    const exportProgress = reactive({ current: 0, total: 1, percent: 0 });
    const exportResult = ref('');
    const exportError = ref('');

    const isImportDialogVisible = ref(false);
    const importPhase = ref('confirm'); // 'strategy' | 'confirm' | 'reading' | 'importing' | 'report' | 'error'
    const importInProgress = ref(false);
    const importProgressPercent = ref(0);

    // Import strategy options
    const conflictStrategy = ref('overwrite'); // 'overwrite' | 'skip'
    const newDataStrategy = ref('add'); // 'add' | 'skip'

    // Import file data (cached between phases)
    const importDataCache = ref(null);
    const importFileSummary = ref(null);

    // Import result
    const importReport = reactive({
        overwritten: 0,
        added: 0,
        skippedExisting: 0,
        skippedNew: 0,
        totalProcessed: 0,
        tables: []
    });
    const importError = ref('');

    // Database Reset state
    const isResetDialogVisible = ref(false);
    const resetPhase = ref('confirm'); // 'confirm' | 'in_progress' | 'error'
    const resetInProgress = ref(false);
    const resetConfirmInput = ref('');
    const resetInputError = ref(false);
    const resetError = ref('');
    const confirmationRequiredText = computed(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}${m}${d}+我确认`;
    });

    const userStore = useUserStore();

    const cacheSize = reactive({
        cachedUsers: 0,
        cachedWorlds: 0,
        cachedAvatars: 0,
        cachedGroups: 0,
        cachedAvatarNames: 0,
        cachedInstances: 0
    });

    const isLinux = computed(() => LINUX);

    function handlePurge() {
        const days = selectedPurgePeriod.value === 'all' ? null : parseInt(selectedPurgePeriod.value, 10);
        isPurgeDialogVisible.value = false;
        purgeAvatarFeedData(days);
    }

    /**
     * Open export confirmation dialog
     */
    function confirmExport() {
        exportPhase.value = 'confirm';
        exportResult.value = '';
        exportError.value = '';
        exportProgress.current = 0;
        exportProgress.total = 1;
        exportProgress.percent = 0;
        isExportDialogVisible.value = true;
    }

    /**
     * Execute database export
     */
    async function handleExport() {
        const userId = userStore.currentUser?.id || '';
        exportPhase.value = 'in_progress';
        exportInProgress.value = true;

        const result = await exportDatabaseData(userId, (current, total) => {
            exportProgress.current = current;
            exportProgress.total = total;
            exportProgress.percent = total > 0 ? Math.round((current / total) * 100) : 0;
        });

        exportInProgress.value = false;

        if (result.success) {
            exportPhase.value = 'done';
            exportResult.value = result.path;
            toast.success(t('view.settings.advanced.advanced.db_export.success', { path: result.path }));
        } else if (result.error === 'cancelled') {
            isExportDialogVisible.value = false;
            toast(t('view.settings.advanced.advanced.db_export.error_cancelled'));
        } else {
            exportPhase.value = 'error';
            exportError.value = result.error;
            toast.error(t('view.settings.advanced.advanced.db_export.error', { error: result.error }));
        }
    }

    /**
     * Open import dialog - starts at strategy selection
     */
    function confirmImport() {
        importPhase.value = 'strategy';
        importProgressPercent.value = 0;
        conflictStrategy.value = 'overwrite';
        newDataStrategy.value = 'add';
        importDataCache.value = null;
        importFileSummary.value = null;
        importReport.overwritten = 0;
        importReport.added = 0;
        importReport.skippedExisting = 0;
        importReport.skippedNew = 0;
        importReport.totalProcessed = 0;
        importReport.tables = [];
        importError.value = '';
        isImportDialogVisible.value = true;
    }

    /**
     * Read and validate import file, then show confirmation
     */
    async function handleImportFileSelect() {
        const userId = userStore.currentUser?.id || '';
        importPhase.value = 'reading';

        try {
            const result = await readImportFile(userId);

            if (result.success) {
                importDataCache.value = result.data;
                importFileSummary.value = result.summary;
                importPhase.value = 'confirm';
            } else if (result.error === 'cancelled') {
                isImportDialogVisible.value = false;
                toast(t('view.settings.advanced.advanced.db_import.error_cancelled'));
            } else {
                importError.value = result.error;
                importPhase.value = 'error';
                toast.error(t('view.settings.advanced.advanced.db_import.error', { error: result.error }));
            }
        } catch (e) {
            console.error('[Import] readImportFile threw:', e);
            importError.value = e.message || String(e);
            importPhase.value = 'error';
            toast.error(t('view.settings.advanced.advanced.db_import.error', { error: importError.value }));
        }
    }

    /**
     * Go back to strategy selection
     */
    function backToStrategy() {
        importPhase.value = 'strategy';
    }

    /**
     * Execute database import with selected strategies
     */
    async function handleImport() {
        if (!importDataCache.value) return;

        importInProgress.value = true;
        importPhase.value = 'importing';

        const result = await executeImport(
            importDataCache.value,
            { conflictStrategy: conflictStrategy.value, newDataStrategy: newDataStrategy.value },
            (state) => {
                if (state.phase === 'importing') {
                    importProgressPercent.value = state.progress * 100;
                }
            }
        );

        importInProgress.value = false;

        if (result.success) {
            importPhase.value = 'report';
            importReport.overwritten = result.report.overwritten;
            importReport.added = result.report.added;
            importReport.skippedExisting = result.report.skippedExisting;
            importReport.skippedNew = result.report.skippedNew;
            importReport.totalProcessed = result.report.totalProcessed;
            importReport.tables = result.report.tables;
            toast.success(
                t('view.settings.advanced.advanced.db_import.success', {
                    importedCount: result.report.overwritten + result.report.added,
                    tablesProcessed: result.tablesProcessed
                })
            );
        } else if (result.error === 'cancelled') {
            isImportDialogVisible.value = false;
            toast(t('view.settings.advanced.advanced.db_import.error_cancelled'));
        } else {
            importPhase.value = 'error';
            importError.value = result.error;
            toast.error(t('view.settings.advanced.advanced.db_import.error', { error: result.error }));
        }
    }

    /**
     * Execute database reset - drops all user data tables and reinitializes the database.
     * Requires the user to type the confirmation text "YYYYMMDD+我确认".
     */
    async function handleResetDatabase() {
        // Validate confirmation input
        const expectedText = confirmationRequiredText.value;
        if (resetConfirmInput.value !== expectedText) {
            resetInputError.value = true;
            return;
        }
        resetInputError.value = false;

        resetPhase.value = 'in_progress';
        resetInProgress.value = true;

        const msgBox = toast.warning(t('view.settings.advanced.advanced.db_reset.in_progress'), { duration: Infinity });

        try {
            // 1. Get all table names from sqlite_master (excluding sqlite_ internal tables)
            const allTables = [];
            await sqliteService.execute((row) => {
                allTables.push(row[0]);
            }, `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);

            // 2. Drop all tables in a transaction
            await database.begin();
            for (const tableName of allTables) {
                await sqliteService.executeNonQuery(`DROP TABLE IF EXISTS "${tableName}"`);
            }
            await database.commit();

            // 3. Vacuum to reclaim space
            await database.vacuum();

            // 4. Re-initialize tables
            const configRepo = window.configRepository;
            await configRepo.init();
            await database.initTables();
            if (userStore.currentUser?.id) {
                await database.initUserTables(userStore.currentUser.id);
            }

            // 5. Log the reset operation
            const resetLog = {
                timestamp: new Date().toISOString(),
                user: userStore.currentUser?.displayName || 'Unknown',
                userId: userStore.currentUser?.id || ''
            };
            await configRepo.setObject('reset_log', resetLog);

            toast.dismiss(msgBox);
            toast.success(t('view.settings.advanced.advanced.db_reset.success'));

            // 6. Close dialog
            resetPhase.value = 'confirm';
            resetConfirmInput.value = '';
            isResetDialogVisible.value = false;
            resetInProgress.value = false;

            // 7. Restart the application
            await new Promise((resolve) => setTimeout(resolve, 1500));
            vrcxUpdaterStore.restartVRCX(false);
        } catch (err) {
            console.error('Database reset failed:', err);
            toast.dismiss(msgBox);
            resetPhase.value = 'error';
            resetError.value = err.message || String(err);
            resetInProgress.value = false;
            toast.error(t('view.settings.advanced.advanced.db_reset.error', { error: resetError.value }));
        }
    }

    /**
     *
     */
    function openShortcutFolder() {
        AppApi.OpenShortcutFolder();
    }

    /**
     *
     */
    function refreshCacheSize() {
        cacheSize.cachedUsers = cachedUsers.size;
        cacheSize.cachedWorlds = cachedWorlds.size;
        cacheSize.cachedAvatars = cachedAvatars.size;
        cacheSize.cachedGroups = cachedGroups.size;
        cacheSize.cachedAvatarNames = cachedAvatarNames.size;
        cacheSize.cachedInstances = cachedInstances.size;
    }

    /**
     *
     */
    async function refreshConfigTreeData() {
        await authRequest.getConfig();
        configTreeData.value = cachedConfig.value;
    }

    /**
     *
     */
    function getVisits() {
        queryRequest.fetch('visits').then((args) => {
            visits.value = args.json;
        });
    }
</script>

