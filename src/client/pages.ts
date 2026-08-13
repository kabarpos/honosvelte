/**
 * Page registry. Explicit imports work identically in the Bun server
 * runtime and the Bun.build client bundle (Bun 1.3 removed
 * `import.meta.glob`). Keys use the `./pages/<Name>.svelte` convention
 * that `resolve()` builds from the Inertia component name.
 */
import type { Component } from "svelte";
import Activity from "./pages/Activity.svelte";
import About from "./pages/About.svelte";
import Billing from "./pages/Billing.svelte";
import Contact from "./pages/Contact.svelte";
import ContactInbox from "./pages/ContactInbox.svelte";
import Dashboard from "./pages/Dashboard.svelte";
import Email from "./pages/Email.svelte";
import EmailTemplate from "./pages/EmailTemplate.svelte";
import ForgotPassword from "./pages/ForgotPassword.svelte";
import Landing from "./pages/Landing.svelte";
import Login from "./pages/Login.svelte";
import Media from "./pages/Media.svelte";
import NotFound from "./pages/NotFound.svelte";
import NotificationCenter from "./pages/NotificationCenter.svelte";
import Permissions from "./pages/Permissions.svelte";
import Profile from "./pages/Profile.svelte";
import Register from "./pages/Register.svelte";
import ResetPassword from "./pages/ResetPassword.svelte";
import Roles from "./pages/Roles.svelte";
import Services from "./pages/Services.svelte";
import Settings from "./pages/Settings.svelte";
import Users from "./pages/Users.svelte";
import WhatsApp from "./pages/WhatsApp.svelte";
import WhatsAppTemplate from "./pages/WhatsAppTemplate.svelte";

type PageModule = { default: Component<any> };

export const pages: Record<string, PageModule> = {
	"./pages/Activity.svelte": { default: Activity },
	"./pages/About.svelte": { default: About },
	"./pages/Billing.svelte": { default: Billing },
	"./pages/Contact.svelte": { default: Contact },
	"./pages/ContactInbox.svelte": { default: ContactInbox },
	"./pages/Dashboard.svelte": { default: Dashboard },
	"./pages/Email.svelte": { default: Email },
	"./pages/EmailTemplate.svelte": { default: EmailTemplate },
	"./pages/ForgotPassword.svelte": { default: ForgotPassword },
	"./pages/Landing.svelte": { default: Landing },
	"./pages/Login.svelte": { default: Login },
	"./pages/Media.svelte": { default: Media },
	"./pages/NotFound.svelte": { default: NotFound },
	"./pages/NotificationCenter.svelte": { default: NotificationCenter },
	"./pages/Permissions.svelte": { default: Permissions },
	"./pages/Profile.svelte": { default: Profile },
	"./pages/Register.svelte": { default: Register },
	"./pages/ResetPassword.svelte": { default: ResetPassword },
	"./pages/Roles.svelte": { default: Roles },
	"./pages/Services.svelte": { default: Services },
	"./pages/Settings.svelte": { default: Settings },
	"./pages/Users.svelte": { default: Users },
	"./pages/WhatsApp.svelte": { default: WhatsApp },
	"./pages/WhatsAppTemplate.svelte": { default: WhatsAppTemplate },
};

/** Fallback for unknown component names — never resolve to undefined. */
export const notFoundPage: PageModule = pages["./pages/NotFound.svelte"] ?? {
	default: NotFound,
};
