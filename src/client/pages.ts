/**
 * Page registry. Explicit imports work identically in the Bun server
 * runtime and the Bun.build client bundle (Bun 1.3 removed
 * `import.meta.glob`). Keys use the `./pages/<Name>.svelte` convention
 * that `resolve()` builds from the Inertia component name.
 */
import type { Component } from "svelte";
import Activity from "./pages/Activity.svelte";
import Admin from "./pages/Admin.svelte";
import Billing from "./pages/Billing.svelte";
import Dashboard from "./pages/Dashboard.svelte";
import ForgotPassword from "./pages/ForgotPassword.svelte";
import Login from "./pages/Login.svelte";
import Media from "./pages/Media.svelte";
import NotFound from "./pages/NotFound.svelte";
import Permissions from "./pages/Permissions.svelte";
import Profile from "./pages/Profile.svelte";
import Register from "./pages/Register.svelte";
import ResetPassword from "./pages/ResetPassword.svelte";
import Roles from "./pages/Roles.svelte";
import Settings from "./pages/Settings.svelte";
import Users from "./pages/Users.svelte";

type PageModule = { default: Component<any> };

export const pages: Record<string, PageModule> = {
	"./pages/Activity.svelte": { default: Activity },
	"./pages/Admin.svelte": { default: Admin },
	"./pages/Billing.svelte": { default: Billing },
	"./pages/Dashboard.svelte": { default: Dashboard },
	"./pages/ForgotPassword.svelte": { default: ForgotPassword },
	"./pages/Login.svelte": { default: Login },
	"./pages/Media.svelte": { default: Media },
	"./pages/NotFound.svelte": { default: NotFound },
	"./pages/Permissions.svelte": { default: Permissions },
	"./pages/Profile.svelte": { default: Profile },
	"./pages/Register.svelte": { default: Register },
	"./pages/ResetPassword.svelte": { default: ResetPassword },
	"./pages/Roles.svelte": { default: Roles },
	"./pages/Settings.svelte": { default: Settings },
	"./pages/Users.svelte": { default: Users },
};

/** Fallback for unknown component names — never resolve to undefined. */
export const notFoundPage: PageModule = pages["./pages/NotFound.svelte"] ?? {
	default: NotFound,
};
