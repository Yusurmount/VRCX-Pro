<template>
    <GroupCalendarDialog :visible="groupCalendar" @close="closeDialog('groupCalendar')" />
    <NoteExportDialog :isNoteExportDialogVisible="noteExport" @close="closeDialog('noteExport')" />
    <ExportDiscordNamesDialog v-model:discordNamesDialogVisible="exportDiscordNames" :friends="friends" />
    <ExportFriendsListDialog v-model:isExportFriendsListDialogVisible="exportFriendsList" :friends="friends" />
    <ExportAvatarsListDialog v-model:isExportAvatarsListDialogVisible="exportAvatarsList" />
    <DataExportDialog
        v-model:visible="dataExport"
        :title="exportDialogTitle"
        :default-file-name="exportDialogFileName"
        :sheet-name="exportDialogSheetName"
        :get-data="exportDialogGetData" />
    <WorldExportDialog v-model:worldExportDialogVisible="worldExport" />
    <AvatarExportDialog v-model:avatarExportDialogVisible="avatarExport" />
    <FriendExportDialog v-model:friendExportDialogVisible="friendExport" />
    <EditInviteMessageDialog
        v-model:isEditInviteMessagesDialogVisible="editInviteMessages"
        @close="closeDialog('editInviteMessages')" />
    <RegistryBackupDialog />
    <AutoChangeStatusDialog
        :isAutoChangeStatusDialogVisible="autoChangeStatus"
        @close="closeDialog('autoChangeStatus')" />
    <ProfileCompletionDialog :visible="infoCompletion" @close="closeDialog('infoCompletion')" />
    <DatabaseManagementDialog :visible="databaseManagement" @close="closeDialog('databaseManagement')" />
</template>

<script setup>
    import { computed } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import { useFriendStore, useToolsStore } from '../../../stores';
    import { exportSources } from '../../../shared/constants/exportSources';

    import DataExportDialog from '../../../components/dialogs/DataExportDialog.vue';

    import AutoChangeStatusDialog from '../dialogs/AutoChangeStatusDialog.vue';
    import DatabaseManagementDialog from '../dialogs/DatabaseManagementDialog.vue';
    import ProfileCompletionDialog from '../dialogs/ProfileCompletionDialog.vue';
    import RegistryBackupDialog from '../dialogs/RegistryBackupDialog.vue';

    import AvatarExportDialog from '../../Favorites/dialogs/AvatarExportDialog.vue';
    import EditInviteMessageDialog from '../dialogs/EditInviteMessagesDialog.vue';
    import ExportAvatarsListDialog from '../dialogs/ExportAvatarsListDialog.vue';
    import ExportDiscordNamesDialog from '../dialogs/ExportDiscordNamesDialog.vue';
    import ExportFriendsListDialog from '../dialogs/ExportFriendsListDialog.vue';
    import FriendExportDialog from '../../Favorites/dialogs/FriendExportDialog.vue';
    import GroupCalendarDialog from '../dialogs/GroupCalendarDialog.vue';
    import NoteExportDialog from '../dialogs/NoteExportDialog.vue';
    import WorldExportDialog from '../../Favorites/dialogs/WorldExportDialog.vue';

    const { t } = useI18n();
    const { friends } = storeToRefs(useFriendStore());
    const toolsStore = useToolsStore();
    const {
        activeExportSource,
        autoChangeStatus,
        avatarExport,
        dataExport,
        databaseManagement,
        friendExport,
        infoCompletion,
        editInviteMessages,
        exportAvatarsList,
        exportDiscordNames,
        exportFriendsList,
        groupCalendar,
        noteExport,
        worldExport
    } = storeToRefs(toolsStore);

    const activeSource = computed(() => exportSources[activeExportSource.value] ?? null);
    const exportDialogTitle = computed(() => (activeSource.value ? t(activeSource.value.titleKey) : ''));
    const exportDialogFileName = computed(() => activeSource.value?.defaultFileName ?? 'data');
    const exportDialogSheetName = computed(() => {
        const source = activeSource.value;
        if (!source) {
            return 'Data';
        }
        return source.sheetNameKey ? t(source.sheetNameKey) : source.sheetName;
    });
    const exportDialogGetData = computed(() => activeSource.value?.getData ?? (() => []));

    const { closeDialog } = toolsStore;
</script>
