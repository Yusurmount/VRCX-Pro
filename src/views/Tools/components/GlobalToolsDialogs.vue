<template>
    <GroupCalendarDialog :visible="groupCalendar" @close="closeDialog('groupCalendar')" />
    <NoteExportDialog :isNoteExportDialogVisible="noteExport" @close="closeDialog('noteExport')" />
    <ExportDiscordNamesDialog v-model:discordNamesDialogVisible="exportDiscordNames" :friends="friends" />
    <DataExportDialog
        v-model:visible="dataExport"
        :title="exportDialogTitle"
        :default-file-name="exportDialogFileName"
        :sheet-name="exportDialogSheetName"
        :get-data="exportDialogGetData" />
    <EditInviteMessageDialog
        v-model:isEditInviteMessagesDialogVisible="editInviteMessages"
        @close="closeDialog('editInviteMessages')" />
    <RegistryBackupDialog />
    <AutoChangeStatusDialog
        :isAutoChangeStatusDialogVisible="autoChangeStatus"
        @close="closeDialog('autoChangeStatus')" />
    <ProfileCompletionDialog :visible="infoCompletion" @close="closeDialog('infoCompletion')" />
</template>

<script setup>
    import { computed } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import { useFriendStore, useToolsStore } from '../../../stores';
    import { exportSources } from '../../../shared/constants/exportSources';

    import DataExportDialog from '../../../components/dialogs/DataExportDialog.vue';

    import AutoChangeStatusDialog from '../dialogs/AutoChangeStatusDialog.vue';
    import ProfileCompletionDialog from '../dialogs/ProfileCompletionDialog.vue';
    import RegistryBackupDialog from '../dialogs/RegistryBackupDialog.vue';

    import EditInviteMessageDialog from '../dialogs/EditInviteMessagesDialog.vue';
    import ExportDiscordNamesDialog from '../dialogs/ExportDiscordNamesDialog.vue';
    import GroupCalendarDialog from '../dialogs/GroupCalendarDialog.vue';
    import NoteExportDialog from '../dialogs/NoteExportDialog.vue';

    const { t } = useI18n();
    const { friends } = storeToRefs(useFriendStore());
    const toolsStore = useToolsStore();
    const {
        activeExportSource,
        autoChangeStatus,
        dataExport,
        infoCompletion,
        editInviteMessages,
        exportDiscordNames,
        groupCalendar,
        noteExport
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
