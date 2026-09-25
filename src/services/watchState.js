import { reactive } from 'vue';
const watchState = reactive({
    isAuthenticated: false,
    isLoggedIn: false,
    isFriendsLoaded: false,
    isFavoritesLoaded: false
});

export { watchState };
