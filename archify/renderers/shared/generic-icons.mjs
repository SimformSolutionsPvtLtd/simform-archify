// Simform fork: pick a generic (Lucide) icon for architecture nodes that stand
// for something other than a Microsoft service: a user, an API server, a queue.
//
// Used only when an architecture diagram already shows Microsoft icons and a
// node has no `brand` of its own, so the row of nodes does not look half
// finished. Authors can always name an icon explicitly (`"brand": "queue"`).
// Set SIMFORM_GENERIC_ICONS=off to switch the inference off.

// First match wins, so specific words come before broad ones. Each rule reads
// the node label and id; the sublabel is only consulted when those say nothing.
const RULES = [
  [/\bqueues?\b/, 'generic-queue'],
  [/\b(?:event bus|event broker|message broker|brokers?|topics?|pub\/?sub)\b/, 'generic-event-bus'],
  [/\b(?:event )?(?:streams?|streaming|kafka|kinesis)\b/, 'generic-event-stream'],
  [/\bwebhooks?\b/, 'generic-webhook'],
  [/\b(?:vector (?:db|database|store)|embeddings? store)\b/, 'generic-vector-database'],
  [/\b(?:cache|redis|memcached)\b/, 'generic-cache'],
  [/\b(?:data lake|lakehouse)\b/, 'generic-data-lake'],
  [/\b(?:data )?warehouse\b/, 'generic-data-warehouse'],
  [/\b(?:object storage|blob storage|buckets?|s3)\b/, 'generic-object-storage'],
  [/\b(?:file storage|file share|filesystem)\b/, 'generic-file-storage'],
  [/\b(?:databases?|db|sql|postgres(?:ql)?|mysql|mongo(?:db)?|nosql|data ?stores?)\b/, 'generic-database'],
  [/\b(?:search|elasticsearch|index)\b/, 'generic-search-index'],
  [/\b(?:api gateway|gateway|reverse proxy|proxy|ingress)\b/, 'generic-gateway'],
  [/\bload balancers?\b/, 'generic-load-balancer'],
  [/\b(?:workers?|consumers?|processors?)\b/, 'generic-worker'],
  [/\b(?:schedulers?|cron|timers?)\b/, 'generic-scheduler'],
  [/\bbatch\b/, 'generic-batch-job'],
  [/\b(?:identity|auth|authentication|sso|idp|oauth|login)\b/, 'generic-identity-provider'],
  [/\b(?:secrets?|vault|kms|key store)\b/, 'generic-secrets'],
  [/\b(?:firewall|waf)\b/, 'generic-firewall'],
  [/\b(?:monitoring|metrics|observability|telemetry|apm)\b/, 'generic-monitoring'],
  [/\blog(?:s|ging)?\b/, 'generic-logging'],
  [/\b(?:email|smtp|mail)\b/, 'generic-email'],
  [/\b(?:notifications?|push|alerts?)\b/, 'generic-notification'],
  [/\b(?:sms|chat|messaging)\b/, 'generic-chat'],
  [/\b(?:payments?|billing|checkout|stripe)\b/, 'generic-payments'],
  [/\b(?:analytics|reporting|business intelligence)\b/, 'generic-analytics'],
  [/\b(?:agents?|agentic|copilot)\b/, 'generic-agent'],
  [/\b(?:ml|machine learning|inference|llm)\b/, 'generic-ml-model'],
  [/\b(?:etl|ingest(?:ion)?|data pipeline)\b/, 'generic-etl'],
  [/\b(?:iot|sensors?|devices?)\b/, 'generic-iot-device'],
  [/\b(?:mobile|ios|android)\b/, 'generic-mobile-app'],
  [/\bdesktop\b/, 'generic-desktop-app'],
  [/\b(?:browsers?|spa|web client|web ui|frontend)\b/, 'generic-browser'],
  [/\bdashboards?\b/, 'generic-dashboard'],
  [/\b(?:admins?|administrators?|operators?)\b/, 'generic-admin'],
  [/\b(?:users|customers|clients|visitors|people)\b/, 'generic-users'],
  [/\b(?:user|customer|client|visitor|person)\b/, 'generic-user'],
  [/\b(?:third[- ]party|external|partner)\b/, 'generic-external-api'],
  [/\b(?:micro)?services?\b/, 'generic-microservice'],
  [/\b(?:api|server|backend|app|application)\b/, 'generic-api-server'],
];

// What the node's architecture `type` says when no word does.
const TYPE_FALLBACK = {
  frontend: 'generic-browser',
  backend: 'generic-api-server',
  database: 'generic-database',
  cloud: 'generic-cloud-service',
  security: 'generic-security',
  messagebus: 'generic-queue',
  external: 'generic-external-api',
};

function words(...parts) {
  return parts.filter(Boolean).join(' ').toLocaleLowerCase('en-US').replace(/[_-]+/g, ' ');
}

export function genericIconsEnabled() {
  return (process.env.SIMFORM_GENERIC_ICONS || '').toLowerCase() !== 'off';
}

/** Catalogue id of the generic icon that best stands for `node`, or null. */
export function inferGenericIcon(node) {
  for (const text of [words(node.label, node.id), words(node.sublabel)]) {
    if (!text) continue;
    for (const [pattern, id] of RULES) {
      if (pattern.test(text)) return id;
    }
  }
  return TYPE_FALLBACK[node.type] || null;
}
