/**
 * Plain-English, step-by-step setup guides for the manual (credential-based)
 * integrations. Keyed by integration id. Rendered by <SetupGuide> above each
 * credential form so an admin knows exactly what to click in the other system
 * and what to paste where — no guessing.
 */

export interface GuideStep {
  title: string;
  detail: string;
}

export interface SetupGuide {
  /** Short "what you'll need before you start" checklist. */
  needs: string[];
  /** Numbered steps, in order. */
  steps: GuideStep[];
  /** How long it typically takes. */
  time?: string;
  /** Optional docs link. */
  docUrl?: string;
  docLabel?: string;
}

export const SETUP_GUIDES: Record<string, SetupGuide> = {
  workday: {
    needs: [
      'Workday administrator access',
      'An Integration System User (ISU)',
      'A Report-as-a-Service (RaaS) worker report',
    ],
    time: '~15 min (one-time, done by your Workday admin)',
    docLabel: 'Workday Community: RaaS',
    docUrl: 'https://community.workday.com',
    steps: [
      {
        title: 'Create an Integration System User (ISU)',
        detail:
          'In Workday search "Create Integration System User". Give it a username and password, tick "Do Not Allow UI Sessions", and set a long session timeout. This is the read-only account HeyVacay uses — it never changes anything.',
      },
      {
        title: 'Give the ISU permission to read workers',
        detail:
          'Create an Integration System Security Group (Unconstrained), add the ISU to it, and grant it "Get" access to the Staffing / Workers domain. Then run "Activate Pending Security Policy Changes".',
      },
      {
        title: 'Build a RaaS worker report',
        detail:
          'Create a custom report (type Advanced), data source "All Active Employees". Add columns: Full Name, Work Email, Job Title, and Department (or Cost Center). Under the report\'s Actions → Web Service → View URLs, enable it and copy the JSON URL.',
      },
      {
        title: 'Share the report with the ISU',
        detail:
          'In the report\'s Share settings, share it with the ISU or its security group. A report that isn\'t shared returns no data — this is the #1 cause of an empty import.',
      },
      {
        title: 'Paste the three values below',
        detail:
          'The RaaS JSON URL, the ISU username, and the ISU password. We\'ll pull your roster and import everyone as employees.',
      },
    ],
  },

  ukg: {
    needs: [
      'UKG Pro administrator access',
      'A Web Services service account (username + password)',
      'Your Customer API Key and data-center Service URL',
    ],
    time: '~10 min (one-time, done by your UKG admin)',
    docLabel: 'UKG Pro — Web Services',
    docUrl: 'https://developer.ukg.com',
    steps: [
      {
        title: 'Create a Web Services service account',
        detail:
          'In UKG Pro go to System Configuration → Security → Web Services. Add a service account (username + password) for the integration. Read-only access to employee data is all HeyVacay needs — it never writes back.',
      },
      {
        title: 'Copy your Customer API Key',
        detail:
          'On the same Web Services page (or System Configuration → Security → Service Account Administration), copy your Customer API Key — it usually starts with "US-".',
      },
      {
        title: 'Find your Service URL',
        detail:
          'This is your UKG Pro data-center host, e.g. https://service5.ultipro.com (yours may be service4 / servicet, etc.). It\'s shown in your UKG Pro service configuration or admin welcome email.',
      },
      {
        title: 'Paste the four values below',
        detail:
          'Service URL, Customer API Key, and the service account username + password. We\'ll pull your employee roster (name, work email, title, department) and import everyone as employees.',
      },
    ],
  },

  rippling: {
    needs: ['Rippling admin access'],
    time: '~3 min',
    steps: [
      {
        title: 'Open Rippling API settings',
        detail: 'In Rippling, go to Settings → API / Custom Integrations (or Company Settings → API access).',
      },
      {
        title: 'Create an API key',
        detail: 'Generate a new API key with read access to employees. Copy it — it\'s shown once.',
      },
      { title: 'Paste it below', detail: 'We use it read-only to import your people.' },
    ],
  },

  okta: {
    needs: ['Okta administrator access'],
    time: '~3 min',
    steps: [
      {
        title: 'Open API tokens in Okta',
        detail: 'In the Okta Admin console, go to Security → API → Tokens.',
      },
      {
        title: 'Create a token',
        detail: 'Click "Create Token", name it "HeyVacay", and copy the token (starts with "00…"). It\'s shown only once.',
      },
      {
        title: 'Find your Okta domain',
        detail: 'It\'s the address you sign in at, e.g. yourco.okta.com (no https://).',
      },
      { title: 'Paste the domain + token below', detail: 'Read-only access to your directory.' },
    ],
  },

  bamboohr: {
    needs: ['BambooHR admin access'],
    time: '~3 min',
    steps: [
      {
        title: 'Open API keys in BambooHR',
        detail: 'Click your profile picture (top-right) → "API Keys".',
      },
      {
        title: 'Add a new key',
        detail: 'Click "Add New Key", name it "HeyVacay", and copy the generated key.',
      },
      {
        title: 'Find your subdomain',
        detail: 'It\'s the first part of your BambooHR URL — yourco.bamboohr.com → "yourco".',
      },
      { title: 'Paste the subdomain + key below', detail: 'We read your directory, nothing else.' },
    ],
  },

  netsuite: {
    needs: ['NetSuite administrator access', 'A role with web-services permission'],
    time: '~10 min (one-time)',
    steps: [
      {
        title: 'Turn on the features',
        detail:
          'Setup → Company → Enable Features → SuiteCloud tab. Check "Token-Based Authentication" and "REST Web Services", then Save.',
      },
      {
        title: 'Create an Integration record',
        detail:
          'Setup → Integration → Manage Integrations → New. Name it "HeyVacay", enable Token-Based Authentication, Save. Copy the Consumer Key and Consumer Secret — shown once.',
      },
      {
        title: 'Create an Access Token',
        detail:
          'Setup → Users/Roles → Access Tokens → New. Pick the HeyVacay integration, a user, and a role with posting permission. Save. Copy the Token ID and Token Secret — shown once.',
      },
      {
        title: 'Find your Account ID',
        detail:
          'Setup → Company → Company Information. It looks like 1234567 (or 1234567_SB1 for a sandbox).',
      },
      { title: 'Paste all five values below', detail: 'Account ID + the four token values.' },
    ],
  },

  expensify: {
    needs: ['Expensify admin (Control or Collect plan)'],
    time: '~3 min',
    docLabel: 'Expensify integrations',
    docUrl: 'https://www.expensify.com/tools/integrations/',
    steps: [
      {
        title: 'Open the Expensify API credentials',
        detail: 'Go to Settings → Account → Integrations → Expensify API (or expensify.com/tools/integrations).',
      },
      {
        title: 'Generate credentials',
        detail: 'Create/copy your partnerUserID and partnerUserSecret.',
      },
      { title: 'Paste them below', detail: 'Used to post approved expenses into Expensify.' },
    ],
  },

  ramp: {
    needs: ['Ramp admin access'],
    time: '~5 min',
    steps: [
      {
        title: 'Open Ramp developer settings',
        detail: 'In Ramp, go to Settings → Developer API (Business settings → API).',
      },
      {
        title: 'Create API credentials',
        detail: 'Create a new app / client credentials with read access to transactions and cards. Copy the Client ID and Client Secret.',
      },
      { title: 'Paste them below', detail: 'We import your card transactions as expenses.' },
    ],
  },

  brex: {
    needs: ['Brex admin access'],
    time: '~3 min',
    steps: [
      {
        title: 'Open Brex developer settings',
        detail: 'In the Brex dashboard, go to Settings → Developer → API tokens.',
      },
      {
        title: 'Create a token',
        detail: 'Create a user token with the "transactions" read scope. Copy it — shown once.',
      },
      { title: 'Paste it below', detail: 'We import your card transactions as expenses.' },
    ],
  },

  slack: {
    needs: [
      'Permission to add an app to your Slack workspace',
      'The channel you want travel alerts posted to',
    ],
    time: '~3 min · all you need is an Incoming Webhook URL',
    docLabel: 'Slack: Incoming Webhooks',
    docUrl: 'https://api.slack.com/messaging/webhooks',
    steps: [
      {
        title: 'Start a new Slack app',
        detail:
          'Go to api.slack.com/apps and click "Create New App". In the pop-up, under "From scratch" choose "Pick features", then Continue. (Ignore "AI agent", "Starter app", "Paste a manifest", and the "With a coding agent" box — you don\'t need those.)',
      },
      {
        title: 'Name it and pick your workspace (Step 1 of 4)',
        detail:
          'Name the app e.g. "HeyVacay Enterprise" and choose your Slack workspace, then Continue.',
      },
      {
        title: 'Skip scopes and events (Steps 2 & 3 of 4)',
        detail:
          'These screens ask "What it can do / respond to in Slack?" — a notification webhook needs NONE of them. Leave both empty ("No bot scopes/events yet") and just click Continue on each. This is the part that trips people up: you can safely skip it.',
      },
      {
        title: 'Create the app (Step 4 of 4)',
        detail: 'On "Review your app", click Create. You don\'t need any scopes or events listed.',
      },
      {
        title: 'Turn on Incoming Webhooks',
        detail:
          'In the app you just made, open "Incoming Webhooks" in the left sidebar and toggle "Activate Incoming Webhooks" to On.',
      },
      {
        title: 'Add a webhook to your channel',
        detail:
          'Click "Add New Webhook to Workspace" (at the bottom), choose the channel for travel alerts, and click Allow.',
      },
      {
        title: 'Copy the Webhook URL and paste it below',
        detail:
          'Back on the Incoming Webhooks page, copy the Webhook URL for that channel — it starts with https://hooks.slack.com/services/… — and paste it into the field below. That\'s the only value HeyVacay needs.',
      },
    ],
  },
};

export function guideFor(id: string): SetupGuide | undefined {
  return SETUP_GUIDES[id];
}
