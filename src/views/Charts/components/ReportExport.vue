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

        <div v-if="reportHtmlContent" class="mt-6 rounded-lg border p-4">
            <div class="flex items-center justify-between">
                <div class="min-w-0">
                    <span class="text-sm font-medium">{{ t('view.charts.report_export.report_ready') }}</span>
                    <p v-if="savedFilePath" class="mt-1 truncate text-xs text-muted-foreground">{{ savedFilePath }}</p>
                </div>
                <Button variant="outline" size="sm" @click="saveReport">
                    <Download class="mr-1 size-3" />
                    {{ t('view.charts.report_export.save') }}
                </Button>
            </div>
        </div>
    </div>
</template>

<script setup>
    defineOptions({ name: 'ChartsReportExport' });

    import { ref } from 'vue';
    import { Calendar, Download, FileText, Info, RefreshCcw } from 'lucide-vue-next';
    import { useI18n } from 'vue-i18n';
    import { toast } from 'vue-sonner';

    import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
    import { Button } from '@/components/ui/button';

    import { database } from '@/services/database';
    import { useUserStore } from '@/stores';

    const { t } = useI18n();
    const userStore = useUserStore();

    const isGenerating = ref(false);
    const savedFilePath = ref(null);
    let reportHtmlContent = '';

    async function generateReport(period) {
        isGenerating.value = true;
        savedFilePath.value = null;
        reportHtmlContent = '';

        try {
            const days = period === 'weekly' ? 7 : 30;
            await database.ensureUserContext(userStore.currentUser?.id);
            const [hotWorlds, avatarStats, friendActivity, statusSummary, onlineSummary] = await Promise.all([
                database.getHotWorlds(days, 20),
                database.getAvatarUsageStats(days),
                database.getFriendActivitySummary(days),
                database.getStatusChangeSummary(days),
                database.getOnlineActivitySummary(days)
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
                </table>
                <div style="margin-top:12px">${svgBarChart(hotWorlds.slice(0, 8).map(w => ({ name: w.worldName, value: w.visitCount })), 'value', 'name', '#ef4444')}</div>`
                : `<p style="color:#6b7280;text-align:center;padding:20px">${t('view.charts.report_export.no_data')}</p>`;

            const friendHtml = friendActivity.topFriends.length > 0
                ? `<div style="display:flex;gap:20px;margin-bottom:16px;flex-wrap:wrap">
                    <div style="text-align:center"><div style="font-size:24px;font-weight:600">${friendActivity.totalVisits.toLocaleString()}</div><div style="font-size:12px;color:#6b7280">${t('view.charts.report_export.total_visits')}</div></div>
                    <div style="text-align:center"><div style="font-size:24px;font-weight:600">${friendActivity.uniqueFriends}</div><div style="font-size:12px;color:#6b7280">${t('view.charts.report_export.unique_friends')}</div></div>
                    <div style="text-align:center"><div style="font-size:24px;font-weight:600">${friendActivity.uniqueWorlds}</div><div style="font-size:12px;color:#6b7280">${t('view.charts.report_export.unique_worlds')}</div></div>
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead><tr style="border-bottom:1px solid #e5e7eb">
                        <th style="text-align:left;padding:8px">#</th>
                        <th style="text-align:left;padding:8px">${t('view.charts.report_export.table_friend')}</th>
                        <th style="text-align:right;padding:8px">${t('view.charts.report_export.table_visits')}</th>
                        <th style="text-align:right;padding:8px">${t('view.charts.report_export.table_worlds')}</th>
                    </tr></thead>
                    <tbody>${friendActivity.topFriends.slice(0, 10).map((f, i) =>
                        `<tr style="border-bottom:1px solid #f3f4f6">
                            <td style="padding:8px;color:#6b7280">${i + 1}</td>
                            <td style="padding:8px;font-weight:500">${escapeHtml(f.displayName)}</td>
                            <td style="padding:8px;text-align:right">${f.visitCount}</td>
                            <td style="padding:8px;text-align:right">${f.uniqueWorlds}</td>
                        </tr>`
                    ).join('')}</tbody>
                </table>
                <div style="margin-top:12px">${svgBarChart((friendActivity.topFriends || []).slice(0, 8), 'visitCount', 'displayName', '#6366f1')}</div>`
                : `<p style="color:#6b7280;text-align:center;padding:20px">${t('view.charts.report_export.no_data')}</p>`;

            const statusHtml = (statusSummary.topUsers || []).length > 0 || statusSummary.totalChanges > 0
                ? `<div style="display:flex;gap:20px;margin-bottom:16px;flex-wrap:wrap">
                    <div style="text-align:center"><div style="font-size:24px;font-weight:600">${statusSummary.totalChanges.toLocaleString()}</div><div style="font-size:12px;color:#6b7280">${t('view.charts.report_export.total_status_changes')}</div></div>
                    <div style="text-align:center"><div style="font-size:24px;font-weight:600">${statusSummary.uniqueUsers}</div><div style="font-size:12px;color:#6b7280">${t('view.charts.report_export.unique_users')}</div></div>
                </div>
                <h3 style="font-size:13px;font-weight:500;margin:16px 0 8px;color:#374151">${t('view.charts.report_export.top_players')}</h3>
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead><tr style="border-bottom:1px solid #e5e7eb">
                        <th style="text-align:left;padding:8px">#</th>
                        <th style="text-align:left;padding:8px">${t('view.charts.report_export.table_player')}</th>
                        <th style="text-align:right;padding:8px">${t('view.charts.report_export.table_changes')}</th>
                    </tr></thead>
                    <tbody>${(statusSummary.topUsers || []).slice(0, 10).map((u, i) =>
                        `<tr style="border-bottom:1px solid #f3f4f6">
                            <td style="padding:8px;color:#6b7280">${i + 1}</td>
                            <td style="padding:8px;font-weight:500">${escapeHtml(u.displayName)}</td>
                            <td style="padding:8px;text-align:right">${u.changeCount}</td>
                        </tr>`
                    ).join('')}</tbody>
                </table>
                <div style="margin-top:12px">${svgBarChart((statusSummary.topUsers || []).slice(0, 8), 'changeCount', 'displayName', '#f59e0b')}</div>`
                : `<p style="color:#6b7280;text-align:center;padding:20px">${t('view.charts.report_export.no_data')}</p>`;

            const onlineHtml = onlineSummary.topOnlineFriends.length > 0
                ? `<div style="display:flex;gap:20px;margin-bottom:16px;flex-wrap:wrap">
                    <div style="text-align:center"><div style="font-size:24px;font-weight:600">${onlineSummary.onlineCount.toLocaleString()}</div><div style="font-size:12px;color:#6b7280">${t('view.charts.report_export.online_events')}</div></div>
                    <div style="text-align:center"><div style="font-size:24px;font-weight:600">${onlineSummary.offlineCount.toLocaleString()}</div><div style="font-size:12px;color:#6b7280">${t('view.charts.report_export.offline_events')}</div></div>
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead><tr style="border-bottom:1px solid #e5e7eb">
                        <th style="text-align:left;padding:8px">#</th>
                        <th style="text-align:left;padding:8px">${t('view.charts.report_export.table_friend')}</th>
                        <th style="text-align:right;padding:8px">${t('view.charts.report_export.table_online_count')}</th>
                    </tr></thead>
                    <tbody>${onlineSummary.topOnlineFriends.slice(0, 10).map((f, i) =>
                        `<tr style="border-bottom:1px solid #f3f4f6">
                            <td style="padding:8px;color:#6b7280">${i + 1}</td>
                            <td style="padding:8px;font-weight:500">${escapeHtml(f.displayName)}</td>
                            <td style="padding:8px;text-align:right">${f.onlineCount}</td>
                        </tr>`
                    ).join('')}</tbody>
                </table>
                <div style="margin-top:12px">${svgBarChart((onlineSummary.topOnlineFriends || []).slice(0, 8), 'onlineCount', 'displayName', '#22c55e')}</div>`
                : `<p style="color:#6b7280;text-align:center;padding:20px">${t('view.charts.report_export.no_data')}</p>`;

            const avatarHtml = (avatarStats.topUsers || []).length > 0 || avatarStats.totalChanges > 0
                ? `<div style="margin-bottom:20px">
                    <p style="font-size:13px;color:#6b7280;margin-bottom:8px">${t('view.charts.report_export.total_avatar_changes')}: <strong>${avatarStats.totalChanges}</strong></p>
                    <p style="font-size:13px;color:#6b7280;margin-bottom:8px">${t('view.charts.report_export.self_owned')}: <strong>${avatarStats.selfVsOther.selfOwned}</strong> | ${t('view.charts.report_export.others')}: <strong>${avatarStats.selfVsOther.others}</strong></p>
                </div>
                <h3 style="font-size:13px;font-weight:500;margin:16px 0 8px;color:#374151">${t('view.charts.report_export.top_users')}</h3>
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead><tr style="border-bottom:1px solid #e5e7eb">
                        <th style="text-align:left;padding:8px">#</th>
                        <th style="text-align:left;padding:8px">${t('view.charts.report_export.table_player')}</th>
                        <th style="text-align:right;padding:8px">${t('view.charts.report_export.table_changes')}</th>
                        <th style="text-align:right;padding:8px">${t('view.charts.report_export.table_unique_avatars')}</th>
                    </tr></thead>
                    <tbody>${(avatarStats.topUsers || []).slice(0, 10).map((u, i) =>
                        `<tr style="border-bottom:1px solid #f3f4f6">
                            <td style="padding:8px;color:#6b7280">${i + 1}</td>
                            <td style="padding:8px;font-weight:500">${escapeHtml(u.displayName)}</td>
                            <td style="padding:8px;text-align:right">${u.changeCount}</td>
                            <td style="padding:8px;text-align:right">${u.uniqueAvatars}</td>
                        </tr>`
                    ).join('')}</tbody>
                </table>
                <div style="margin-top:12px">${svgBarChart((avatarStats.topUsers || []).slice(0, 8), 'changeCount', 'displayName', '#8b5cf6')}</div>`
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
            <h2>${t('view.charts.report_export.section_friend_activity')}</h2>
            ${friendHtml}
        </div>

        <div class="section">
            <h2>${t('view.charts.report_export.section_status_changes')}</h2>
            ${statusHtml}
        </div>

        <div class="section">
            <h2>${t('view.charts.report_export.section_online_activity')}</h2>
            ${onlineHtml}
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

            reportHtmlContent = html;
            savedFilePath.value = null;
            toast.success(t('view.charts.report_export.generated'));
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


    function svgBarChart(items, valueKey, labelKey, color = '#6366f1', maxValue = null) {
        if (!items || items.length === 0) return '';
        const max = maxValue || Math.max(...items.map(i => i[valueKey] || 0));
        if (max === 0) return '';
        const barHeight = 20;
        const gap = 6;
        const labelWidth = 140;
        const valueWidth = 50;
        const chartWidth = 300;
        const totalHeight = items.length * (barHeight + gap);
        let svg = `<svg width="100%" viewBox="0 0 ${labelWidth + chartWidth + valueWidth} ${totalHeight}" style="max-width:600px">`;
        items.forEach((item, i) => {
            const y = i * (barHeight + gap);
            const value = item[valueKey] || 0;
            const barWidth = max > 0 ? (value / max) * chartWidth : 0;
            const label = String(item[labelKey] || '').slice(0, 18);
            svg += `<text x="0" y="${y + 14}" font-size="11" fill="#374151">${escapeHtml(label)}</text>`;
            svg += `<rect x="${labelWidth}" y="${y}" width="${barWidth}" height="${barHeight}" rx="3" fill="${color}"/>`;
            svg += `<text x="${labelWidth + barWidth + 6}" y="${y + 14}" font-size="11" fill="#6b7280">${value}</text>`;
        });
        svg += '</svg>';
        return svg;
    }

    async function saveReport() {
        if (!reportHtmlContent) return;
        try {
            const blob = new Blob([reportHtmlContent], { type: 'text/html;charset=utf-8' });
            const buffer = await blob.arrayBuffer();
            const defaultName = `vrcx-report-${new Date().toISOString().slice(0, 10)}.html`;
            const result = await window.platform.saveFileDialog(defaultName);
            if (!result) return;
            await window.platform.writeFile(result, buffer);
            savedFilePath.value = result;
            toast.success(t('view.charts.report_export.saved'), { description: result });
        } catch (error) {
            console.error('Error saving report:', error);
            toast.error(t('view.charts.report_export.error'));
        }
    }

</script>
