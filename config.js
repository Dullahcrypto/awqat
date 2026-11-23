// Awqat configuration.
window.AWQAT_CONFIG = {
  // Cloudflare worker (news, videos, AI scan, payment check)
  WORKER_URL: "https://awqat.abdvllhalimii.workers.dev",
  // Turn on once ANTHROPIC_API_KEY is set on the worker
  AI_ENABLED: false,
  // Plans
  FREE_SNAPS_PER_DAY: 3,
  LIFETIME_PRICE_NGN: 2000,
  // Paystack PUBLIC key (pk_live_... or pk_test_...). Leave empty until you have Paystack.
  // The SECRET key never goes here: set PAYSTACK_SECRET_KEY on the Cloudflare worker.
  PAYSTACK_PUBLIC_KEY: ""
};
