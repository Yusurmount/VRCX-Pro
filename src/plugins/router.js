import { createRouter, createWebHashHistory } from 'vue-router';

import { watchState } from '../services/watchState';
import { isOobeCompleted } from '../services/oobe';

import MainLayout from '../views/Layout/MainLayout.vue';

const routes = [
    {
        path: '/login',
        name: 'login',
        component: () => import('./../views/Login/Login.vue'),
        meta: { public: true }
    },
    {
        path: '/oobe',
        name: 'oobe',
        component: () => import('./../views/OOBE/OOBE.vue'),
        meta: { public: true }
    },
    {
        path: '/',
        component: MainLayout,
        meta: { requiresAuth: true },
        children: [
            { path: '', redirect: { name: 'feed' } },
            { path: 'feed', name: 'feed', component: () => import('./../views/Feed/Feed.vue') },
            {
                path: 'friends-locations',
                name: 'friends-locations',
                component: () => import('./../views/FriendsLocations/FriendsLocations.vue')
            },
            { path: 'game-log', name: 'game-log', component: () => import('./../views/GameLog/GameLog.vue') },
            { path: 'player-list', name: 'player-list', component: () => import('./../views/PlayerList/PlayerList.vue') },
            { path: 'search', name: 'search', component: () => import('./../views/Search/Search.vue') },
            {
                path: 'dashboard/:id',
                name: 'dashboard',
                component: () => import('./../views/Dashboard/Dashboard.vue'),
                props: true,
                meta: { navKey: 'dashboard' }
            },
            {
                path: 'favorites/friends',
                name: 'favorite-friends',
                component: () => import('./../views/Favorites/FavoritesFriend.vue')
            },
            {
                path: 'favorites/worlds',
                name: 'favorite-worlds',
                component: () => import('./../views/Favorites/FavoritesWorld.vue')
            },
            {
                path: 'favorites/avatars',
                name: 'favorite-avatars',
                component: () => import('./../views/Favorites/FavoritesAvatar.vue')
            },
            {
                path: 'social/friend-log',
                name: 'friend-log',
                component: () => import('./../views/FriendLog/FriendLog.vue')
            },
            {
                path: 'social/moderation',
                name: 'moderation',
                component: () => import('./../views/Moderation/Moderation.vue')
            },
            {
                path: 'my-avatars',
                name: 'my-avatars',
                component: () => import('./../views/MyAvatars/MyAvatars.vue')
            },
            {
                path: 'notification',
                name: 'notification',
                component: () => import('./../views/Notifications/Notification.vue')
            },
            {
                path: 'social/friend-list',
                name: 'friend-list',
                component: () => import('./../views/FriendList/FriendList.vue')
            },
            {
                path: 'charts',
                name: 'charts',
                redirect: { name: 'charts-instance' }
            },
            {
                path: 'charts/instance',
                name: 'charts-instance',
                component: () =>
                    import('./../views/Charts/components/InstanceActivity.vue')
            },
            {
                path: 'charts/mutual',
                name: 'charts-mutual',
                component: () =>
                    import('./../views/Charts/components/MutualFriends.vue')
            },
            {
                path: 'charts/hot-worlds',
                name: 'charts-hot-worlds',
                component: () =>
                    import('./../views/Charts/components/HotWorlds.vue')
            },
            {
                path: 'charts/two-person',
                name: 'charts-two-person',
                component: () =>
                    import('./../views/Charts/components/TwoPersonRelationship.vue')
            },
            {
                path: 'charts/timeline',
                name: 'charts-timeline',
                component: () =>
                    import('./../views/Charts/components/RelationshipTimeline.vue')
            },
            { path: 'tools', name: 'tools', component: () => import('./../views/Tools/Tools.vue') },
            {
                path: 'tools/gallery',
                name: 'gallery',
                component: () => import('./../views/Tools/Gallery.vue'),
                meta: { navKeys: ['tool-gallery', 'tools'] }
            },
            {
                path: 'tools/screenshot-metadata',
                name: 'screenshot-metadata',
                component: () => import('./../views/Tools/ScreenshotMetadata.vue'),
                meta: { navKeys: ['tool-screenshot-metadata', 'tools'] }
            },
            {
                path: 'settings',
                name: 'settings',
                component: () => import('./../views/Settings/Settings.vue'),
                meta: { navKey: 'manage', hidesActiveMenuItem: true }
            }
        ]
    }
];

export const router = createRouter({
    history: createWebHashHistory(),
    // @ts-ignore
    routes
});

export function initRouter(app) {
    app.use(router);
}

router.beforeEach(async (to) => {
    if (to.path === '/social') {
        return false;
    }

    // First-run gate: users must finish the OOBE wizard before entering the app.
    if (to.name !== 'oobe' && to.name !== 'login') {
        if (!watchState.isLoggedIn && !(await isOobeCompleted())) {
            return { name: 'oobe' };
        }
    }

    if (to.name === 'login' && watchState.isLoggedIn) {
        return { name: 'feed' };
    }

    const requiresAuth = to.matched.some((record) => record.meta?.requiresAuth);
    if (requiresAuth && !watchState.isLoggedIn) {
        const redirect = to.fullPath;
        if (redirect && redirect !== '/feed') {
            return { name: 'login', query: { redirect } };
        }
        return { name: 'login' };
    }

    return true;
});
