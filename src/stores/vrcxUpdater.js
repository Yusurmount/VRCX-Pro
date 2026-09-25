import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';

import { logWebRequest } from '../services/appConfig';
import { branches } from '../shared/constants';
import {
    getLatestWhatsNewRelease,
    getWhatsNewRelease,
    normalizeReleaseVersion
} from '../shared/constants/whatsNewReleases';
import {
    compareVersionNumbers,
    normalizeVersion
} from '../shared/utils/version';

import configRepository from '../services/config';

import * as workerTimers from 'worker-timers';

const emptyWhatsNewDialog = () => ({
    visible: false,
    titleKey: '',
    subtitleKey: '',
    items: []
});

export const useVRCXUpdaterStore = defineStore('VRCXUpdater', () => {
    const { t } = useI18n();

    const arch = ref('x64');
    const noUpdater = ref(false);
    const isMacOS = computed(() => navigator.platform.includes('Mac'));

    const appVersion = ref('');
    const autoUpdateVRCX = ref('Auto Download');
    const latestAppVersion = ref('');
    const branch = ref('Stable');
    const vrcxId = ref('');
    const checkingForVRCXUpdate = ref(false);
    const VRCXUpdateDialog = ref({
        visible: false,
        updatePending: false,
        updatePendingIsLatest: false,
        release: '',
        releases: []
    });
    const changeLogDialog = ref({
        visible: false,
        buildName: '',
        changeLog: '',
        loading: false,
        loaded: false
    });
    const whatsNewDialog = ref(emptyWhatsNewDialog());
    const pendingVRCXUpdate = ref(false);
    const pendingVRCXInstall = ref('');
    const updateInProgress = ref(false);
    const updateProgress = ref(0);
    const updateError = ref('');
    const downloadRoute = ref('official');
    const updateToastRelease = ref('');

    async function initVRCXUpdaterSettings() {
        if (true) {
            arch.value = await window.platform.getArch();
            noUpdater.value = await window.platform.getNoUpdater();
            console.log('Architecture:', arch.value);
        }
        if (isMacOS.value) {
            noUpdater.value = true;
        }

        const [VRCX_autoUpdateVRCX, VRCX_id, VRCX_updateRoute] =
            await Promise.all([
                configRepository.getString(
                    'VRCX_autoUpdateVRCX',
                    'Auto Download'
                ),
                configRepository.getString('VRCX_id', ''),
                configRepository.getString('VRCX_updateRoute', 'official')
            ]);

        if (VRCX_autoUpdateVRCX === 'Auto Install') {
            autoUpdateVRCX.value = 'Auto Download';
        } else {
            autoUpdateVRCX.value = VRCX_autoUpdateVRCX;
        }
        if (noUpdater.value) {
            autoUpdateVRCX.value = 'Off';
        }

        appVersion.value = await AppApi.GetVersion();
        vrcxId.value = VRCX_id;
        downloadRoute.value =
            VRCX_updateRoute === 'mirror' ? 'mirror' : 'official';

        await initBranch();
        await loadVrcxId();

        let checkedForUpdatesDuringAnnouncement = false;
        if (await shouldAnnounceCurrentVersion()) {
            const shown = await showWhatsNewDialog();
            if (shown) {
                await markCurrentVersionAsSeen();
            } else if (isRecognizedStableReleaseVersion()) {
                const result = await showChangeLogDialog({ prefetch: true });
                checkedForUpdatesDuringAnnouncement = result.checkedForUpdates;
                if (result.shown) {
                    await markCurrentVersionAsSeen();
                }
            }
        } else {
            await syncCurrentVersionState();
        }
        if (
            autoUpdateVRCX.value !== 'Off' &&
            !checkedForUpdatesDuringAnnouncement
        ) {
            await checkForVRCXUpdate();
        }
    }

    const currentVersion = computed(() =>
        appVersion.value.replace(' (Linux)', '')
    );

    /**
     * @param {string} value
     */
    async function setAutoUpdateVRCX(value) {
        if (value === 'Off') {
            pendingVRCXUpdate.value = false;
        }
        autoUpdateVRCX.value = value;
        await configRepository.setString('VRCX_autoUpdateVRCX', value);
    }
    /**
     * @param {string} value
     */
    function setLatestAppVersion(value) {
        latestAppVersion.value = value;
    }
    /**
     * @param {string} value
     */
    function setBranch(value) {
        branch.value = value;
        configRepository.setString('VRCX_branch', value);
    }

    async function setUpdateRoute(value) {
        if (value !== 'official' && value !== 'mirror') {
            return;
        }
        downloadRoute.value = value;
        await configRepository.setString('VRCX_updateRoute', value);
    }

    function getRoutedUpdateUrl(url) {
        if (downloadRoute.value !== 'mirror') {
            return url;
        }
        try {
            const parsedUrl = new URL(url);
            const supportedHosts = [
                'github.com',
                'raw.githubusercontent.com',
                'objects.githubusercontent.com',
                'release-assets.githubusercontent.com'
            ];
            if (!supportedHosts.includes(parsedUrl.hostname)) {
                return url;
            }
            return `https://gh-proxy.org/${parsedUrl.href}`;
        } catch {
            return url;
        }
    }

    function setUpdateError(message) {
        updateError.value = message;
        VRCXUpdateDialog.value.updatePending = false;
        pendingVRCXInstall.value = '';
    }

    function getErrorMessage(error) {
        return error instanceof Error ? error.message : String(error);
    }

    async function initBranch() {
        if (!appVersion.value) {
            return;
        }
        if (currentVersion.value.includes('VRCX-Pro Nightly')) {
            branch.value = 'Nightly';
        } else {
            branch.value = 'Stable';
        }
        await configRepository.setString('VRCX_branch', branch.value);
    }

    async function hasVersionChanged() {
        const lastVersion = await configRepository.getString(
            'VRCX_lastVRCXVersion',
            ''
        );
        return lastVersion !== currentVersion.value;
    }

    async function markCurrentVersionAsSeen() {
        await configRepository.setString(
            'VRCX_lastVRCXVersion',
            currentVersion.value
        );
    }

    async function syncCurrentVersionState() {
        if (await hasVersionChanged()) {
            await markCurrentVersionAsSeen();
            return true;
        }
        return false;
    }

    async function shouldAnnounceCurrentVersion() {
        if (branch.value !== 'Stable' || !isRecognizedStableReleaseVersion()) {
            return false;
        }
        const lastVersion = await configRepository.getString(
            'VRCX_lastVRCXVersion',
            ''
        );
        return Boolean(lastVersion) && lastVersion !== currentVersion.value;
    }

    function isRecognizedStableReleaseVersion() {
        return Boolean(normalizeReleaseVersion(currentVersion.value));
    }

    /**
     * @returns {Promise<boolean>}
     */
    async function showWhatsNewDialog() {
        const release = getWhatsNewRelease(currentVersion.value);

        if (!release) {
            whatsNewDialog.value = emptyWhatsNewDialog();
            return false;
        }

        whatsNewDialog.value = {
            visible: true,
            titleKey: release.titleKey,
            subtitleKey: release.subtitleKey,
            items: release.items.map((item) => ({ ...item }))
        };

        return true;
    }

    // function showLatestWhatsNewDialog() {
    //     const release = getLatestWhatsNewRelease();

    //     if (!release) {
    //         return false;
    //     }

    //     whatsNewDialog.value = {
    //         visible: true,
    //         titleKey: release.titleKey,
    //         subtitleKey: release.subtitleKey,
    //         items: release.items.map((item) => ({ ...item }))
    //     };

    //     return true;
    // }

    function closeWhatsNewDialog() {
        whatsNewDialog.value.visible = false;
    }

    async function openChangeLogDialogOnly() {
        changeLogDialog.value.visible = true;
        await ensureChangeLogReady();
    }
    async function loadVrcxId() {
        if (!vrcxId.value) {
            vrcxId.value = crypto.randomUUID();
            await configRepository.setString('VRCX_id', vrcxId.value);
        }
    }
    function getAssetOfInterest(assets) {
        let downloadUrl = '';
        let hashString = '';
        let size = 0;
        for (const asset of assets) {
            if (asset.state !== 'uploaded') {
                continue;
            }
            if (
                WINDOWS &&
                asset.name.endsWith('.exe') &&
                (asset.content_type === 'application/x-msdownload' ||
                    asset.content_type === 'application/x-msdos-program')
            ) {
                downloadUrl = asset.browser_download_url;
                if (asset.digest && asset.digest.startsWith('sha256:')) {
                    hashString = asset.digest.replace('sha256:', '');
                }
                size = asset.size;
                break;
            }
            if (
                LINUX &&
                asset.name.endsWith(`${arch.value}.AppImage`) &&
                asset.content_type === 'application/octet-stream'
            ) {
                downloadUrl = asset.browser_download_url;
                if (asset.digest && asset.digest.startsWith('sha256:')) {
                    hashString = asset.digest.replace('sha256:', '');
                }
                size = asset.size;
                break;
            }
        }
        return { downloadUrl, hashString, size };
    }
    async function checkForVRCXUpdate() {
        if (noUpdater.value) {
            return false;
        }
        await loadBranchVersions();
        applyLatestVersionState();
        return true;
    }

    function applyLatestVersionState() {
        const latestVersionName = VRCXUpdateDialog.value.release;
        if (latestVersionName) {
            latestAppVersion.value = latestVersionName;
            const comparison = compareVersionNumbers(
                currentVersion.value,
                latestVersionName
            );
            pendingVRCXUpdate.value =
                comparison === null
                    ? normalizeVersion(currentVersion.value) !==
                      normalizeVersion(latestVersionName)
                    : comparison < 0;
        }
    }
    async function showVRCXUpdateDialog() {
        VRCXUpdateDialog.value.visible = true;
        changeLogDialog.value.loading = true;
        try {
            await loadBranchVersions();
        } finally {
            changeLogDialog.value.loading = false;
        }
        return true;
    }

    async function loadBranchVersions() {
        const D = VRCXUpdateDialog.value;
        const url = branches[branch.value].urlReleases;
        checkingForVRCXUpdate.value = true;
        updateError.value = '';
        let response;
        let json;
        try {
            response = await webApiService.execute({
                url,
                method: 'GET',
                headers: {
                    'VRCX-ID': vrcxId.value
                }
            });
            json = JSON.parse(response.data);
        } catch (error) {
            console.error('Failed to check for VRCX update', error);
            updateError.value = t('message.vrcx_updater.failed', {
                message: getErrorMessage(error)
            });
            toast.error(updateError.value);
            return;
        } finally {
            checkingForVRCXUpdate.value = false;
        }
        if (response.status !== 200) {
            updateError.value = t('message.vrcx_updater.failed', {
                message: `${response.status} ${response.data}`
            });
            toast.error(updateError.value);
            return;
        }
        logWebRequest('[EXTERNAL GET]', url, `(${response.status})`, json);
        const releases = [];
        if (typeof json !== 'object' || json === null || json.message) {
            updateError.value = t('message.vrcx_updater.failed', {
                message:
                    json?.message || t('message.vrcx_updater.invalid_releases')
            });
            toast.error(updateError.value);
            return;
        }
        for (const release of json) {
            if (release.prerelease) {
                continue;
            }
            assetLoop: for (const asset of release.assets) {
                if (asset.state === 'uploaded') {
                    releases.push(release);
                    break assetLoop;
                }
            }
        }
        D.releases = releases;
        const latestRelease =
            releases.length > 0
                ? releases[0]
                : json.length > 0
                  ? json[0]
                  : null;
        D.release = latestRelease
            ? latestRelease.tag_name || latestRelease.name
            : '';
        VRCXUpdateDialog.value.updatePendingIsLatest = false;
        if (D.release === pendingVRCXInstall.value) {
            // update already downloaded and latest version
            VRCXUpdateDialog.value.updatePending = true;
            VRCXUpdateDialog.value.updatePendingIsLatest = true;
        } else {
            VRCXUpdateDialog.value.updatePending = false;
        }
        if (latestRelease) {
            changeLogDialog.value.buildName =
                latestRelease.name || latestRelease.tag_name || '';
            changeLogDialog.value.changeLog =
                typeof latestRelease.body === 'string'
                    ? latestRelease.body
                    : '';
            changeLogDialog.value.loaded = true;
        }
        setBranch(branch.value);
    }
    async function downloadVRCXUpdate(
        downloadUrl,
        hashString,
        size,
        releaseName
    ) {
        if (updateInProgress.value) {
            return;
        }
        updateError.value = '';
        pendingVRCXInstall.value = '';
        VRCXUpdateDialog.value.updatePending = false;
        try {
            updateInProgress.value = true;
            updateProgress.value = 0;
            const started = await AppApi.DownloadUpdate(
                getRoutedUpdateUrl(downloadUrl),
                hashString,
                size
            );
            if (!started) {
                throw new Error(
                    t('message.vrcx_updater.download_start_failed')
                );
            }

            while (updateInProgress.value) {
                const status = await AppApi.GetUpdateStatus();
                updateProgress.value = status.progress;
                if (!updateInProgress.value) {
                    return;
                }

                if (status.state === 'complete') {
                    pendingVRCXInstall.value = releaseName;
                    VRCXUpdateDialog.value.updatePending = true;
                    VRCXUpdateDialog.value.updatePendingIsLatest =
                        VRCXUpdateDialog.value.release === releaseName;
                    return;
                }
                if (status.state === 'error') {
                    throw new Error(
                        status.error ||
                            t('message.vrcx_updater.download_start_failed')
                    );
                }
                if (status.state === 'canceled') {
                    updateProgress.value = 0;
                    return;
                }
                if (status.state === 'idle') {
                    throw new Error(
                        t('message.vrcx_updater.download_start_failed')
                    );
                }

                await new Promise((resolve) =>
                    workerTimers.setTimeout(resolve, 250)
                );
            }
        } catch (err) {
            console.error(err);
            const message = t('message.vrcx_updater.download_failed', {
                message: getErrorMessage(err)
            });
            setUpdateError(message);
            toast.error(message);
        } finally {
            updateInProgress.value = false;
            if (updateError.value) {
                updateProgress.value = 0;
            }
        }
    }

    async function downloadSelectedVRCXUpdate() {
        if (updateInProgress.value) {
            return;
        }
        let matchingReleaseFound = false;
        for (const release of VRCXUpdateDialog.value.releases) {
            if (
                (release.tag_name || release.name) !==
                VRCXUpdateDialog.value.release
            ) {
                continue;
            }
            matchingReleaseFound = true;
            const { downloadUrl, hashString, size } = getAssetOfInterest(
                release.assets
            );
            if (!downloadUrl) {
                setUpdateError(t('message.vrcx_updater.no_compatible_asset'));
                toast.error(updateError.value);
                return;
            }
            const releaseName = release.tag_name || release.name;
            await downloadVRCXUpdate(
                downloadUrl,
                hashString,
                size,
                releaseName
            );
            break;
        }
        if (!matchingReleaseFound) {
            setUpdateError(t('message.vrcx_updater.no_compatible_asset'));
            toast.error(updateError.value);
        }
    }
    async function showChangeLogDialog(options = {}) {
        const { prefetch = false } = options;

        if (prefetch) {
            const loaded = await ensureChangeLogReady();
            if (!loaded) {
                return { shown: false, checkedForUpdates: true };
            }
            changeLogDialog.value.visible = true;
            return { shown: true, checkedForUpdates: true };
        }

        changeLogDialog.value.visible = true;
        void ensureChangeLogReady();
        return { shown: true, checkedForUpdates: true };
    }

    async function ensureChangeLogReady() {
        if (changeLogDialog.value.loaded) {
            return true;
        }
        changeLogDialog.value.loading = true;
        try {
            await loadBranchVersions();
            if (!noUpdater.value) {
                applyLatestVersionState();
            }
            return changeLogDialog.value.loaded;
        } finally {
            changeLogDialog.value.loading = false;
        }
    }
    async function restartVRCX(isUpgrade) {
        updateError.value = '';
        try {
            if (!LINUX) {
                const started = await AppApi.RestartApplication(isUpgrade);
                if (!started) {
                    throw new Error(
                        t('message.vrcx_updater.install_start_failed')
                    );
                }
                window.platform.quitApplication();
            } else {
                await window.platform.restartApp();
            }
        } catch (err) {
            const message = t('message.vrcx_updater.install_failed', {
                message: getErrorMessage(err)
            });
            updateError.value = message;
            toast.error(message);
        }
    }
    function updateProgressText() {
        if (updateProgress.value === 100) {
            return t('message.vrcx_updater.checking_hash');
        }
        return `${updateProgress.value}%`;
    }
    async function cancelUpdate() {
        try {
            await AppApi.CancelUpdate();
        } catch (err) {
            const message = t('message.vrcx_updater.cancel_failed', {
                message: getErrorMessage(err)
            });
            updateError.value = message;
            toast.error(message);
        } finally {
            updateInProgress.value = false;
            updateProgress.value = 0;
            pendingVRCXInstall.value = '';
            VRCXUpdateDialog.value.updatePending = false;
        }
    }

    initVRCXUpdaterSettings();

    return {
        appVersion,
        autoUpdateVRCX,
        latestAppVersion,
        branch,
        currentVersion,
        vrcxId,
        checkingForVRCXUpdate,
        VRCXUpdateDialog,
        changeLogDialog,
        whatsNewDialog,
        pendingVRCXUpdate,
        pendingVRCXInstall,
        updateInProgress,
        updateProgress,
        updateError,
        downloadRoute,
        noUpdater,

        setAutoUpdateVRCX,
        setUpdateRoute,
        setBranch,

        showWhatsNewDialog,
        closeWhatsNewDialog,
        openChangeLogDialogOnly,
        checkForVRCXUpdate,
        loadBranchVersions,
        downloadSelectedVRCXUpdate,
        showVRCXUpdateDialog,
        showChangeLogDialog,
        restartVRCX,
        updateProgressText,
        cancelUpdate
    };
});
