<template>
    <div class="mx-auto max-w-[1100px] p-4">
        <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
                <span class="text-lg font-medium">{{ t('view.charts.report_export.header') }}</span>
                <HoverCard>
                    <HoverCardTrigger as-child>
                        <Info class="ml-1 text-xs opacity-70" />
                    </HoverCardTrigger>
                    <HoverCardContent side="bottom" align="start" class="w-75">
                        <div class="text-xs">
                            {{ t('view.charts.report_export.tips.description') }}
                        </div>
                    </HoverCardContent>
                </HoverCard>
            </div>
        </div>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div class="rounded-lg border p-6">
                <div class="mb-4 flex items-center gap-3">
                    <FileText class="size-5 text-muted-foreground" />
                    <h3 class="text-sm font-medium">{{ t('view.charts.report_export.weekly_report') }}</h3>
                </div>
                <p class="mb-4 text-xs text-muted-foreground">
                    {{ t('view.charts.report_export.weekly_description') }}
                </p>
                <Button :disabled="isGenerating" @click="generateReport('weekly')">
                    <RefreshCcw v-if="isGenerating" class="mr-2 size-4 animate-spin" />
                    <Download v-else class="mr-2 size-4" />
                    {{ isGenerating ? t('view.charts.report_export.generating') : t('view.charts.report_export.generate') }}
                </Button>
            </div>

            <div class="rounded-lg border p-6">
                <div class="mb-4 flex items-center gap-3">
                    <Calendar class="size-5 text-muted-foreground" />
                    <h3 class="text-sm font-medium">{{ t('view.charts.report_export.monthly_report') }}</h3>
                </div>
                <p class="mb-4 text-xs text-muted-foreground">
                    {{ t('view.charts.report_export.monthly_description') }}
                </p>
                <Button :disabled="isGenerating" @click="generateReport('monthly')">
                    <RefreshCcw v-if="isGenerating" class="mr-2 size-4 animate-spin" />
                    <Download v-else class="mr-2 size-4" />
                    {{ isGenerating ? t('view.charts.report_export.generating') : t('view.charts.report_export.generate') }}
                </Button>
            </div>
        </div>

        <div v-if="generatedReportUrl" class="mt-6 rounded-lg border p-4">
            <div class="mb-3 flex items-center justify-between">
                <span class="text-sm font-medium">{{ t('view.charts.report_export.report_ready') }}</span>
                <div class="flex items-center gap-2">
                    <Button variant="outline" size="sm" @click="openReport">
                        <ExternalLink class="mr-1 size-3" />
                        {{ t('view.charts.report_export.open_report') }}
                    </Button>
                    <Button variant="outline" size="sm" @click="downloadReport">
                        <Download class="mr-1 size-3" />
                        {{ t('view.charts.report_export.download') }}
                    </Button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
    defineOptions({ name: 'ChartsReportExport' });

    import { ref } from 'vue';
    import { Calendar, Download, ExternalLink, FileText, Info, RefreshCcw } from 'lucide-vue-next';
    import { useI18n } from 'vue-i18n';
    import { toast } from 'vue-sonner';

    import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
    import { Button } from '@/components/ui/button';

    import { database } from '@/services/database';

    const { t } = useI18n();

    const isGenerating = ref(false);
    const generatedReportUrl = ref(null);
    const generatedReportBlob = ref(null);

    async function generateReport(period) {
        isGenerating.value = true;
        generatedReportUrl.value = null;
        generatedReportBlob.value = null;

        try {
            const days = period === 'weekly' ? 7 : 30;
            const [hotWorlds, avatarStats] = await Promise.all([
                database.getHotWorlds(days, 20),
                database.getAvatarUsageStats(days)
            ]);

            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10);
            const periodLabel = period === 'weekly'
                ? t('view.charts.report_export.period_weekly')
                : t('view.charts.report_export.period_monthly');

            const worldsHtml = hotWorlds.length > 0
                ? `<table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead><tr style="border-bottom:1px solid #e5e7eb">
                        <th style="text-align:left;padding:8px">#</th>
                        <th style="text-align:left;padding:8px">${t('view.charts.report_export.table_world')}</th>
                        <th style="text-align:right;padding:8px">${t('view.charts.report_export.table_visits')}</th>
                        <th style="text-align:right;padding:8px">${t('view.charts.report_export.table_friends')}</th>
                        <th style="text-align:center;padding:8px">${t('view.charts.report_export.table_trend')}</th>
                    </tr></thead>
                    <tbody>${hotWorlds.slice(0, 15).map((w, i) =>
                        `<tr style="border-bottom:1px solid #f3f4f6">
                            <td style="padding:8px;color:#6b7280">${i + 1}</td>
                            <td style="padding:8px;font-weight:500">${escapeHtml(w.worldName)}</td>
                            <td style="padding:8px;text-align:right">${w.visitCount}</td>
                            <td style="padding:8px;text-align:right">${w.uniqueFriends}</td>
                            <td style="padding:8px;text-align:center">
                                <span style="color:${w.trend === 'rising' ? '#22c55e' : w.trend === 'cooling' ? '#3b82f6' : '#6b7280'}">
                                    ${w.trend === 'rising' ? '\u2191' : w.trend === 'cooling' ? '\u2193' : '\u2192'} ${w.trend}
                                </span>
                            </td>
                        </tr>`
                    ).join('')}</tbody>
                </table>`
                : `<p style="color:#6b7280;text-align:center;padding:20px">${t('view.charts.report_export.no_data')}</p>`;

            const avatarHtml = avatarStats.topAvatars.length > 0
                ? `<div style="margin-bottom:20px">
                    <p style="font-size:13px;color:#6b7280;margin-bottom:8px">${t('view.charts.report_export.total_avatar_changes')}: <strong>${avatarStats.totalChanges}</strong></p>
                    <p style="font-size:13px;color:#6b7280;margin-bottom:8px">${t('view.charts.report_export.self_owned')}: <strong>${avatarStats.selfVsOther.selfOwned}</strong> | ${t('view.charts.report_export.others')}: <strong>${avatarStats.selfVsOther.others}</strong></p>
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead><tr style="border-bottom:1px solid #e5e7eb">
                        <th style="text-align:left;padding:8px">${t('view.charts.report_export.table_avatar')}</th>
                        <th style="text-align:right;padding:8px">${t('view.charts.report_export.table_changes')}</th>
                        <th style="text-align:right;padding:8px">${t('view.charts.report_export.table_users')}</th>
                    </tr></thead>
                    <tbody>${avatarStats.topAvatars.slice(0, 10).map((a) =>
                        `<tr style="border-bottom:1px solid #f3f4f6">
                            <td style="padding:8px;font-weight:500">${escapeHtml(a.avatarName)}</td>
                            <td style="padding:8px;text-align:right">${a.changeCount}</td>
                            <td style="padding:8px;text-align:right">${a.uniqueUsers}</td>
                        </tr>`
                    ).join('')}</tbody>
                </table>`
                : `<p style="color:#6b7280;text-align:center;padding:20px">${t('view.charts.report_export.no_data')}</p>`;

            const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VRCX Pro - ${periodLabel} Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fafafa; color: #111827; padding: 40px 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; }
        .header h1 { font-size: 24px; font-weight: 600; margin-bottom: 4px; }
        .header p { color: #6b7280; font-size: 14px; }
        .section { background: #fff; border-radius: 12px; border: 1px solid #e5e7eb; padding: 24px; margin-bottom: 20px; }
        .section h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
        .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 40px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>VRCX Pro ${periodLabel} Report</h1>
            <p>${t('view.charts.report_export.generated_on')}: ${dateStr}</p>
        </div>

        <div class="section">
            <h2>${t('view.charts.report_export.section_hot_worlds')}</h2>
            ${worldsHtml}
        </div>

        <div class="section">
            <h2>${t('view.charts.report_export.section_avatar_usage')}</h2>
            ${avatarHtml}
        </div>

        <div class="footer">
            Generated by VRCX Pro | ${dateStr}
        </div>
    </div>
</body>
</html>`;

            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            generatedReportBlob.value = blob;
            generatedReportUrl.value = URL.createObjectURL(blob);
            toast.success(t('view.charts.report_export.success'));
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error(t('view.charts.report_export.error'));
        } finally {
            isGenerating.value = false;
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function openReport() {
        if (generatedReportUrl.value) {
            window.open(generatedReportUrl.value, '_blank');
        }
    }

    function downloadReport() {
        if (generatedReportBlob.value) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(generatedReportBlob.value);
            a.download = `vrcx-report-${new Date().toISOString().slice(0, 10)}.html`;
            a.click();
            URL.revokeObjectURL(a.href);
        }
    }
</script>
