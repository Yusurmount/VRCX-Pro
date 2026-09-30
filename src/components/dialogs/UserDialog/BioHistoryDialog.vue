<template>
    <Dialog
        :open="props.visible"
        @update:open="
            (open) => {
                if (!open) close();
            }
        ">
        <DialogContent class="x-dialog sm:max-w-175 translate-y-0" style="top: 8vh" :show-close-button="false">
            <DialogHeader>
                <DialogTitle>{{ t('dialog.user.bio_history.header') }}</DialogTitle>
            </DialogHeader>

            <div v-if="versions.length > 0" class="flex items-end gap-2">
                <div class="min-w-0 flex-1">
                    <span class="block text-xs text-muted-foreground">{{
                        t('dialog.user.bio_history.old_version')
                    }}</span>
                    <Select :model-value="String(oldIndex)" @update:modelValue="(v) => (oldIndex = Number(v))">
                        <SelectTrigger size="sm" class="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="(version, i) in versions" :key="i" :value="String(i)">
                                {{ versionLabel(version) }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div class="min-w-0 flex-1">
                    <span class="block text-xs text-muted-foreground">{{
                        t('dialog.user.bio_history.new_version')
                    }}</span>
                    <Select :model-value="String(newIndex)" @update:modelValue="(v) => (newIndex = Number(v))">
                        <SelectTrigger size="sm" class="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="(version, i) in versions" :key="i" :value="String(i)">
                                {{ versionLabel(version) }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div class="max-h-80 min-h-16 overflow-auto rounded-md border">
                <div v-if="versions.length === 0" class="p-3 text-xs text-muted-foreground">
                    {{ t('dialog.user.bio_history.no_history') }}
                </div>
                <div v-else-if="diffOps.length === 0" class="p-3 text-xs text-muted-foreground">
                    {{ t('dialog.user.bio_history.no_changes') }}
                </div>
                <table v-else class="w-full border-collapse font-mono text-xs leading-5">
                    <tbody>
                        <tr v-for="(op, i) in diffOps" :key="i" class="bio-history-row" :data-type="op.type">
                            <td class="w-10 select-none border-r px-1.5 text-right text-muted-foreground">
                                {{ op.oldLine ?? '' }}
                            </td>
                            <td class="w-10 select-none border-r px-1.5 text-right text-muted-foreground">
                                {{ op.newLine ?? '' }}
                            </td>
                            <td class="w-5 select-none px-1 text-center font-bold">
                                {{ op.type === 'equal' ? ' ' : op.type === 'add' ? '+' : '-' }}
                            </td>
                            <td class="whitespace-pre-wrap break-words px-1.5">{{ op.text }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <DialogFooter>
                <Button variant="secondary" @click="close">{{ t('dialog.user.bio_history.close') }}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import {
        Select,
        SelectContent,
        SelectItem,
        SelectTrigger,
        SelectValue
    } from '@/components/ui/select';
    import { Button } from '@/components/ui/button';
    import { computed, ref, watch } from 'vue';
    import { useI18n } from 'vue-i18n';

    import { buildBioVersions, computeLineDiff, formatDateFilter } from '../../../shared/utils';
    import { database } from '../../../services/database';

    const props = defineProps({
        visible: {
            type: Boolean,
            required: true
        },
        userId: {
            type: String,
            default: ''
        },
        currentBio: {
            type: String,
            default: ''
        }
    });

    const emit = defineEmits(['update:visible']);

    const { t } = useI18n();

    const versions = ref([]);
    const oldIndex = ref(0);
    const newIndex = ref(0);

    const diffOps = computed(() => {
        const oldVersion = versions.value[oldIndex.value];
        const newVersion = versions.value[newIndex.value];
        if (!oldVersion || !newVersion) {
            return [];
        }
        return computeLineDiff(oldVersion.bio, newVersion.bio);
    });

    /**
     * @param {{ bio: string, createdAt: string|null, isCurrent: boolean }} version
     */
    function versionLabel(version) {
        if (version.isCurrent) {
            return t('dialog.user.bio_history.current');
        }
        if (!version.createdAt) {
            return '-';
        }
        return formatDateFilter(version.createdAt, 'long');
    }

    async function loadVersions() {
        let records = [];
        try {
            records = props.userId ? await database.getRecentBioChangesForUser(props.userId, 50) : [];
        } catch {
            records = [];
        }
        versions.value = buildBioVersions(records ?? [], props.currentBio);
        const last = Math.max(versions.value.length - 1, 0);
        newIndex.value = last;
        oldIndex.value = Math.max(last - 1, 0);
    }

    function close() {
        emit('update:visible', false);
    }

    watch(
        () => props.visible,
        (open) => {
            if (open) {
                loadVersions();
            }
        }
    );
</script>

<style scoped>
    .bio-history-row[data-type='del'] {
        background-color: rgba(255, 0, 0, 0.12);
        color: #d32f2f;
    }

    .bio-history-row[data-type='add'] {
        background-color: rgba(76, 255, 80, 0.14);
        color: rgb(35, 188, 35);
    }
</style>
