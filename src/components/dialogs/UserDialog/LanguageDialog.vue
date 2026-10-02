<template>
    <Dialog v-model:open="languageDialog.visible">
        <DialogContent class="x-dialog sm:max-w-100">
            <DialogHeader>
                <DialogTitle>{{ t('dialog.language.header') }}</DialogTitle>
            </DialogHeader>

            <div>
                <div class="my-2 mx-0" v-for="item in currentUser.$languages" :key="item.key">
                    <Badge class="mr-1.5" variant="outline">
                        <span
                            class="flags mr-1.5"
                            :class="languageClass(item.key)"
                            style="display: inline-block"></span>
                        {{ item.value }} ({{ item.key.toUpperCase() }})
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            class="ml-2 size-4 p-0 text-current"
                            @click="removeUserLanguage(item.key)">
                            <X class="size-3" />
                        </Button>
                    </Badge>
                </div>
                <Select
                    :model-value="selectedLanguageToAdd"
                    :disabled="
                        languageDialog.loading || (currentUser.$languages && currentUser.$languages.length === 3)
                    "
                    @update:modelValue="handleAddUserLanguage">
                    <SelectTrigger class="mt-3.5" size="sm">
                        <SelectValue :placeholder="t('dialog.language.select_language')" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectItem
                                v-for="item in languageDialog.languages"
                                :key="item.key"
                                :value="item.key"
                                :text-value="item.value">
                                <span
                                    class="flags mr-1.5"
                                    :class="languageClass(item.key)"
                                    style="display: inline-block"></span>
                                {{ item.value }} ({{ item.key.toUpperCase() }})
                            </SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { X } from 'lucide-vue-next';
    import { ref } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
    import { Badge } from '../../ui/badge';
    import { languageClass } from '../../../shared/utils';
    import { useUserStore } from '../../../stores';
    import { userRequest } from '../../../api';

    const { t } = useI18n();

    const { languageDialog, currentUser } = storeToRefs(useUserStore());

    const selectedLanguageToAdd = ref('');

    /**
     *
     * @param language
     */
    function handleAddUserLanguage(language) {
        addUserLanguage(language);
        selectedLanguageToAdd.value = '';
    }

    /**
     *
     * @param language
     */
    function removeUserLanguage(language) {
        if (language !== String(language)) {
            return;
        }
        const D = languageDialog.value;
        D.loading = true;
        userRequest
            .removeUserTags({
                tags: [`language_${language}`]
            })
            .finally(function () {
                D.loading = false;
            });
    }

    /**
     *
     * @param language
     */
    function addUserLanguage(language) {
        if (language !== String(language)) {
            return;
        }
        const D = languageDialog.value;
        D.loading = true;
        userRequest
            .addUserTags({
                tags: [`language_${language}`]
            })
            .finally(function () {
                D.loading = false;
            });
    }
</script>
