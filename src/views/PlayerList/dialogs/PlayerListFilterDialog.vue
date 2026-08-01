<template>
    <Dialog :open="open" @update:open="handleOpenChange">
        <DialogContent class="sm:max-w-3xl">
            <DialogHeader>
                <DialogTitle>{{ t('view.player_list.filter.title') }}</DialogTitle>
            </DialogHeader>

            <!-- Presets bar -->
            <div class="flex flex-wrap items-center gap-2 pb-1">
                <Select :model-value="selectedPresetId" @update:modelValue="applyPreset">
                    <SelectTrigger class="w-60">
                        <SelectValue :placeholder="t('view.player_list.filter.preset_placeholder')" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem v-for="preset in presets" :key="preset.id" :value="preset.id">
                            {{ preset.name }}
                        </SelectItem>
                    </SelectContent>
                </Select>
                <Button size="sm" variant="outline" @click="savePreset">
                    <Save class="size-4" />
                    {{ t('view.player_list.filter.save_preset') }}
                </Button>
                <Button size="sm" variant="outline" :disabled="!selectedPresetId" @click="deletePreset">
                    <Trash2 class="size-4" />
                    {{ t('view.player_list.filter.delete_preset') }}
                </Button>
                <Button size="sm" variant="outline" class="ml-auto" @click="resetWorkingState">
                    <RotateCcw class="size-4" />
                    {{ t('view.player_list.filter.reset') }}
                </Button>
            </div>

            <ScrollArea class="h-[60vh] pr-3">
                <div class="flex flex-col gap-4">
                    <!-- 1. Relationship -->
                    <div class="rounded-md border p-3">
                        <div class="flex items-center gap-2">
                            <Checkbox :id="'plf-relationship'" v-model="state.relationship.enabled" />
                            <span
                                class="cursor-pointer select-none text-sm font-medium"
                                @click="state.relationship.enabled = !state.relationship.enabled"
                                >{{ t('view.player_list.filter.relationship') }}</span
                            >
                        </div>
                        <div v-if="state.relationship.enabled" class="mt-2 flex flex-wrap items-center gap-4 pl-6">
                            <label class="flex items-center gap-2 text-sm">
                                <Checkbox v-model="state.relationship.friends" />
                                {{ t('view.player_list.filter.friends') }}
                            </label>
                            <label class="flex items-center gap-2 text-sm">
                                <Checkbox v-model="state.relationship.nonFriends" />
                                {{ t('view.player_list.filter.non_friends') }}
                            </label>
                        </div>
                    </div>

                    <!-- 2. Level -->
                    <div class="rounded-md border p-3">
                        <div class="flex items-center gap-2">
                            <Checkbox :id="'plf-level'" v-model="state.level.enabled" />
                            <span
                                class="cursor-pointer select-none text-sm font-medium"
                                @click="state.level.enabled = !state.level.enabled"
                                >{{ t('view.player_list.filter.level') }}</span
                            >
                        </div>
                        <div v-if="state.level.enabled" class="mt-2 grid grid-cols-3 gap-2 pl-6">
                            <label
                                v-for="option in levelOptions"
                                :key="option.key"
                                class="flex items-center gap-2 text-sm">
                                <Checkbox v-model="state.level.levels[option.key]" />
                                {{ option.label }}
                            </label>
                        </div>
                    </div>

                    <!-- 3. Keyword -->
                    <div class="rounded-md border p-3">
                        <div class="flex items-center gap-2">
                            <Checkbox :id="'plf-keyword'" v-model="state.keyword.enabled" />
                            <span
                                class="cursor-pointer select-none text-sm font-medium"
                                @click="state.keyword.enabled = !state.keyword.enabled"
                                >{{ t('view.player_list.filter.keyword') }}</span
                            >
                        </div>
                        <div v-if="state.keyword.enabled" class="mt-2 flex flex-col gap-2 pl-6">
                            <div class="flex flex-wrap items-center gap-4">
                                <label class="flex items-center gap-2 text-sm">
                                    <Checkbox v-model="state.keyword.searchName" />
                                    {{ t('view.player_list.filter.search_name') }}
                                </label>
                                <label class="flex items-center gap-2 text-sm">
                                    <Checkbox v-model="state.keyword.searchBio" />
                                    {{ t('view.player_list.filter.search_bio') }}
                                </label>
                            </div>
                            <Input
                                v-model="state.keyword.text"
                                :placeholder="t('view.player_list.filter.keyword_placeholder')"
                                class="max-w-80" />
                        </div>
                    </div>

                    <!-- 4. Groups -->
                    <div class="rounded-md border p-3">
                        <div class="flex items-center gap-2">
                            <Checkbox :id="'plf-groups'" v-model="state.groups.enabled" />
                            <span
                                class="cursor-pointer select-none text-sm font-medium"
                                @click="state.groups.enabled = !state.groups.enabled"
                                >{{ t('view.player_list.filter.groups') }}</span
                            >
                        </div>
                        <div v-if="state.groups.enabled" class="mt-2 flex flex-col gap-2 pl-6">
                            <div class="flex items-center gap-2">
                                <span class="text-xs text-muted-foreground">{{ t('view.player_list.filter.group_combine') }}</span>
                                <Select v-model="state.groups.combine" class="w-44">
                                    <SelectTrigger size="sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="AND">{{ t('view.player_list.filter.group_combine_and') }}</SelectItem>
                                        <SelectItem value="OR">{{ t('view.player_list.filter.group_combine_or') }}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div
                                v-for="(cond, index) in state.groups.conditions"
                                :key="index"
                                class="flex items-center gap-2">
                                <label class="flex items-center gap-2 text-sm">
                                    <Checkbox v-model="cond.joined" />
                                    <span class="w-16 shrink-0">
                                        {{ cond.joined ? t('view.player_list.filter.group_joined') : t('view.player_list.filter.group_not_joined') }}
                                    </span>
                                </label>
                                <div class="min-w-0 flex-1">
                                    <Popover v-model:open="cond._open">
                                        <PopoverTrigger as-child>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                class="w-full justify-between"
                                                role="combobox">
                                                <span class="truncate">
                                                    {{ cond.groupName || t('view.player_list.filter.group_search_placeholder') }}
                                                </span>
                                                <ChevronsUpDown class="size-4 shrink-0 opacity-60" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent class="w-[--reka-popover-trigger-width] p-2">
                                            <Input
                                                v-model="cond._search"
                                                :placeholder="t('view.player_list.filter.group_search_placeholder')"
                                                class="mb-2"
                                                @input="onGroupSearchInput(cond)" />
                                            <div class="max-h-56 overflow-auto">
                                                <button
                                                    v-for="group in getGroupResults(cond)"
                                                    :key="group.id"
                                                    type="button"
                                                    class="flex w-full cursor-pointer flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                                                    @click="selectGroup(cond, group)">
                                                    <span class="w-full truncate">{{ group.name }}</span>
                                                    <span class="text-xs opacity-60"
                                                        >{{ group.shortCode }}.{{ group.discriminator }}</span
                                                    >
                                                </button>
                                                <div v-if="!getGroupResults(cond)?.length" class="p-2 text-sm opacity-60">
                                                    {{ t('view.player_list.filter.group_no_results') }}
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    class="size-7 shrink-0"
                                    :title="t('view.player_list.filter.group_remove')"
                                    @click="removeGroupCondition(index)">
                                    <X class="size-4" />
                                </Button>
                            </div>

                            <Button size="sm" variant="outline" class="self-start" @click="addGroupCondition">
                                <Plus class="size-4" />
                                {{ t('view.player_list.filter.group_add') }}
                            </Button>
                        </div>
                    </div>

                    <!-- 5. Mutual friends -->
                    <div class="rounded-md border p-3">
                        <div class="flex items-center gap-2">
                            <Checkbox :id="'plf-mutual'" v-model="state.mutual.enabled" />
                            <span
                                class="cursor-pointer select-none text-sm font-medium"
                                @click="state.mutual.enabled = !state.mutual.enabled"
                                >{{ t('view.player_list.filter.mutual') }}</span
                            >
                        </div>
                        <div v-if="state.mutual.enabled" class="mt-2 pl-6">
                            <p class="mb-2 text-xs text-muted-foreground">{{ t('view.player_list.filter.mutual_any') }}</p>
                            <VirtualCombobox
                                v-model="state.mutual.targetUserId"
                                :groups="friendPickerGroups"
                                :placeholder="t('view.player_list.filter.mutual_target_placeholder')"
                                :search-placeholder="t('view.player_list.filter.mutual_target_placeholder')"
                                clearable
                                close-on-select
                                deselect-on-reselect>
                                <template #item="{ item, selected }">
                                    <div class="flex w-full items-center p-1.5 text-[13px]">
                                        <template v-if="item.user">
                                            <img
                                                class="mr-2.5 inline-block size-8 flex-none rounded-full object-cover"
                                                :src="userImage(item.user)"
                                                loading="lazy" />
                                        </template>
                                        <span class="flex-1 truncate" :style="item.user?.$userColour ? { color: item.user.$userColour } : {}">
                                            {{ item.label }}
                                        </span>
                                        <Check :class="['ml-auto size-4 shrink-0', selected ? 'opacity-100' : 'opacity-0']" />
                                    </div>
                                </template>
                            </VirtualCombobox>
                        </div>
                    </div>

                    <!-- 6. Room history -->
                    <div class="rounded-md border p-3">
                        <div class="flex items-center gap-2">
                            <Checkbox :id="'plf-room-history'" v-model="state.roomHistory.enabled" />
                            <span
                                class="cursor-pointer select-none text-sm font-medium"
                                @click="state.roomHistory.enabled = !state.roomHistory.enabled"
                                >{{ t('view.player_list.filter.room_history') }}</span
                            >
                        </div>
                        <div v-if="state.roomHistory.enabled" class="mt-2 flex flex-col gap-3 pl-6">
                            <!-- first join -->
                            <div class="flex items-start gap-2">
                                <Checkbox v-model="state.roomHistory.firstJoin.enabled" class="mt-1" />
                                <div class="flex flex-col gap-1.5">
                                    <span class="text-sm font-medium">{{ t('view.player_list.filter.first_join') }}</span>
                                    <div
                                        v-if="state.roomHistory.firstJoin.enabled"
                                        class="flex flex-wrap items-center gap-2">
                                        <span class="text-xs text-muted-foreground">{{ t('view.player_list.filter.first_join_from') }}</span>
                                        <Input
                                            type="datetime-local"
                                            v-model="state.roomHistory.firstJoin.from"
                                            class="h-8 w-48" />
                                        <span class="text-xs text-muted-foreground">{{ t('view.player_list.filter.first_join_to') }}</span>
                                        <Input
                                            type="datetime-local"
                                            v-model="state.roomHistory.firstJoin.to"
                                            class="h-8 w-48" />
                                    </div>
                                </div>
                            </div>
                            <!-- session count -->
                            <div class="flex items-start gap-2">
                                <Checkbox v-model="state.roomHistory.sessionCount.enabled" class="mt-1" />
                                <div class="flex flex-col gap-1.5">
                                    <span class="text-sm font-medium">{{ t('view.player_list.filter.session_count') }}</span>
                                    <div v-if="state.roomHistory.sessionCount.enabled" class="flex flex-wrap items-center gap-2">
                                        <Select v-model="state.roomHistory.sessionCount.comparison" class="w-20">
                                            <SelectTrigger size="sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="gte">{{ t('view.player_list.filter.comparison_gte') }}</SelectItem>
                                                <SelectItem value="eq">{{ t('view.player_list.filter.comparison_eq') }}</SelectItem>
                                                <SelectItem value="lte">{{ t('view.player_list.filter.comparison_lte') }}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            type="number"
                                            min="1"
                                            v-model.number="state.roomHistory.sessionCount.count"
                                            class="h-8 w-20" />
                                        <span class="text-xs text-muted-foreground">{{ t('view.player_list.filter.session_count_unit') }}</span>
                                    </div>
                                </div>
                            </div>
                            <!-- online duration -->
                            <div class="flex items-start gap-2">
                                <Checkbox v-model="state.roomHistory.onlineDuration.enabled" class="mt-1" />
                                <div class="flex flex-col gap-1.5">
                                    <span class="text-sm font-medium">{{ t('view.player_list.filter.online_duration') }}</span>
                                    <div
                                        v-if="state.roomHistory.onlineDuration.enabled"
                                        class="flex flex-wrap items-center gap-2">
                                        <span class="text-xs text-muted-foreground">{{ t('view.player_list.filter.duration_min') }}</span>
                                        <Input
                                            type="number"
                                            min="0"
                                            v-model.number="state.roomHistory.onlineDuration.minMinutes"
                                            class="h-8 w-20" />
                                        <span class="text-xs text-muted-foreground">{{ t('view.player_list.filter.duration_max') }}</span>
                                        <Input
                                            type="number"
                                            min="0"
                                            v-model.number="state.roomHistory.onlineDuration.maxMinutes"
                                            class="h-8 w-20" />
                                        <span class="text-xs text-muted-foreground">{{ t('view.player_list.filter.duration_unit') }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 7. Platform -->
                    <div class="rounded-md border p-3">
                        <div class="flex items-center gap-2">
                            <Checkbox :id="'plf-platform'" v-model="state.platform.enabled" />
                            <span
                                class="cursor-pointer select-none text-sm font-medium"
                                @click="state.platform.enabled = !state.platform.enabled"
                                >{{ t('view.player_list.filter.platform') }}</span
                            >
                        </div>
                        <div v-if="state.platform.enabled" class="mt-2 flex flex-wrap items-center gap-4 pl-6">
                            <label v-for="option in platformOptions" :key="option.key" class="flex items-center gap-2 text-sm">
                                <Checkbox v-model="state.platform.platforms[option.key]" />
                                {{ option.label }}
                            </label>
                        </div>
                    </div>
                </div>
            </ScrollArea>

            <DialogFooter>
                <Button variant="secondary" @click="handleOpenChange(false)">{{ t('view.player_list.filter.cancel') }}</Button>
                <Button @click="applyFilters">{{ t('view.player_list.filter.apply') }}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { computed, ref, watch } from 'vue';
    import { Check, ChevronsUpDown, Plus, RotateCcw, Save, Trash2, X } from 'lucide-vue-next';
    import { useI18n } from 'vue-i18n';

    import { Button } from '@/components/ui/button';
    import { Checkbox } from '@/components/ui/checkbox';
    import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { VirtualCombobox } from '@/components/ui/virtual-combobox';
    import { useUserDisplay } from '@/composables/useUserDisplay';
    import { useFriendStore, useModalStore } from '@/stores';
    import configRepository from '@/services/config';
    import {
        cloneFilterState,
        createDefaultFilterState,
        createPreset
    } from '../playerListFilters';

    const props = defineProps({
        open: { type: Boolean, required: true },
        initialState: { type: Object, required: true },
        // Deduplicated list of groups the players in the room have joined.
        groupSearchList: { type: Array, default: () => [] }
    });

    const emit = defineEmits(['update:open', 'apply']);

    const { t } = useI18n();
    const modalStore = useModalStore();
    const friendStore = useFriendStore();
    const { userImage } = useUserDisplay();

    const PRESET_KEY = 'playerListFilterPresets';

    const state = ref(cloneFilterState(props.initialState ?? createDefaultFilterState()));
    const presets = ref([]);
    const selectedPresetId = ref('');

    watch(
        () => props.open,
        async (value) => {
            if (!value) return;
            state.value = cloneFilterState(props.initialState ?? createDefaultFilterState());
            selectedPresetId.value = '';
            presets.value = (await configRepository.getArray(PRESET_KEY, [])) ?? [];
        },
        { immediate: true }
    );

    const levelOptions = computed(() => [
        { key: 'Visitor', label: t('settings.general.user_colors.trust_levels.visitor') },
        { key: 'NewUser', label: t('settings.general.user_colors.trust_levels.new_user') },
        { key: 'User', label: t('settings.general.user_colors.trust_levels.user') },
        { key: 'Known', label: t('settings.general.user_colors.trust_levels.known_user') },
        { key: 'Trusted', label: t('settings.general.user_colors.trust_levels.trusted_user') },
        { key: 'Unknown', label: t('view.player_list.filter.level_unknown') }
    ]);

    const platformOptions = computed(() => [
        { key: 'pc', label: t('view.player_list.filter.platform_pc') },
        { key: 'android', label: t('view.player_list.filter.platform_android') },
        { key: 'ios', label: t('view.player_list.filter.platform_ios') },
        { key: 'unknown', label: t('view.player_list.filter.platform_unknown') }
    ]);

    const friendPickerGroups = computed(() => {
        const items = [];
        for (const friend of friendStore.friends.values()) {
            if (!friend?.id) continue;
            const user = friend?.ref ?? null;
            const displayName = user?.displayName ?? friend?.name ?? String(friend.id);
            items.push({ value: String(friend.id), label: displayName, search: displayName, user });
        }
        items.sort((a, b) => a.label.localeCompare(b.label));
        return [{ key: 'friends', label: t('view.player_list.filter.friends'), items }];
    });

    function sanitizedState() {
        const clone = cloneFilterState(state.value);
        for (const cond of clone?.groups?.conditions ?? []) {
            delete cond._open;
            delete cond._search;
        }
        return clone;
    }

    function handleOpenChange(value) {
        emit('update:open', value);
    }

    function applyFilters() {
        emit('apply', sanitizedState());
        handleOpenChange(false);
    }

    function resetWorkingState() {
        state.value = createDefaultFilterState();
        selectedPresetId.value = '';
    }

    async function savePresets() {
        await configRepository.setArray(PRESET_KEY, presets.value);
    }

    async function savePreset() {
        const result = await modalStore.prompt({
            title: t('view.player_list.filter.preset_name_title'),
            description: t('view.player_list.filter.preset_name_description'),
            pattern: /^[\s\S]{1,50}$/,
            errorMessage: t('view.player_list.filter.preset_name_invalid')
        });
        if (!result.ok) return;
        const name = (result.value ?? '').trim();
        if (!name) return;
        const preset = createPreset(name, sanitizedState());
        presets.value.push(preset);
        selectedPresetId.value = preset.id;
        await savePresets();
    }

    async function deletePreset() {
        const preset = presets.value.find((p) => p.id === selectedPresetId.value);
        if (!preset) return;
        const result = await modalStore.confirm({
            title: t('view.player_list.filter.delete_preset_title'),
            description: t('view.player_list.filter.delete_preset_message', { name: preset.name })
        });
        if (!result.ok) return;
        presets.value = presets.value.filter((p) => p.id !== preset.id);
        selectedPresetId.value = '';
        await savePresets();
    }

    function applyPreset(id) {
        selectedPresetId.value = id;
        const preset = presets.value.find((p) => p.id === id);
        if (!preset) return;
        state.value = cloneFilterState(preset.filter);
        emit('apply', cloneFilterState(preset.filter));
    }

    function addGroupCondition() {
        state.value.groups.conditions.push({
            groupId: '',
            groupName: '',
            joined: true,
            _open: false,
            _search: ''
        });
    }

    function removeGroupCondition(index) {
        state.value.groups.conditions.splice(index, 1);
    }

    /**
     * Offer the deduplicated groups the players in the room have joined,
     * filtered by the search box input (group name / short code).
     */
    function getGroupResults(cond) {
        const query = (cond._search ?? '').trim().toLowerCase();
        const groups = props.groupSearchList ?? [];
        if (!query) {
            return groups;
        }
        return groups.filter(
            (group) =>
                (group.name ?? '').toLowerCase().includes(query) ||
                (group.shortCode ?? '').toLowerCase().includes(query) ||
                (group.discriminator ?? '').toLowerCase().includes(query)
        );
    }

    function onGroupSearchInput(cond) {
        // no-op, the getter is reactive
    }

    function selectGroup(cond, group) {
        cond.groupId = group.id;
        cond.groupName = group.name;
        cond._open = false;
        cond._search = '';
    }
</script>
