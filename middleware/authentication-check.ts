export default defineNuxtRouteMiddleware((to, from) => {
  const user = useDirectusUser();
  const { loggedIn } = useUserSession();

  // `!user.value` also covers `null` after logout (the previous `=== undefined`
  // check let logged-out users keep navigating to protected pages).
  if (!user.value && !loggedIn.value) {
    return navigateTo({
      path: "/login",
      query: {
        redir: to.path,
      },
    });
  }
});
