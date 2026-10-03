#!/usr/bin/env bun
// Signing for the Exact app's device archive, from the credentials EAS hands
// a custom build (`eas.job.secrets.buildCredentials`: per Xcode target, a
// base64 .mobileprovision and a base64 .p12 with its password).
//
//   bun exact/ci/signing.mjs <credentials.json> <state dir>
//
// Picks the application target (the shortest bundle id, as EAS does: the Expo
// app's widget extension shares its prefix), imports its certificate into a
// fresh keychain on the search list, and prints shell assignments for
// EXACT_IDENTITY (the certificate's SHA-1), EXACT_PROFILE and EXACT_CI_APP_ID.
// EXACT_CI_BUNDLE_ID names another target's bundle id instead.
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [credentialsPath, stateDir] = process.argv.slice(2);
if (!credentialsPath || !stateDir) {
  console.error('usage: bun exact/ci/signing.mjs <credentials.json> <state dir>');
  process.exit(2);
}
mkdirSync(stateDir, { recursive: true });

const run = (cmd, args, { input, quiet = false } = {}) => {
  const r = spawnSync(cmd, args, { input, encoding: input instanceof Uint8Array ? undefined : 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) {
    const err = (r.stderr ?? '').toString().trim();
    throw new Error(`${cmd} ${quiet ? '…' : args.join(' ')} failed (${r.status ?? r.error?.message})${err ? `: ${err}` : ''}`);
  }
  return r.stdout;
};

/** The fields of a provisioning profile used here. (plutil can't convert a
 * profile to JSON: it holds dates and data, so each field is extracted.) */
function decodeProfile(bytes) {
  const plist = resolve(stateDir, 'profile.plist');
  writeFileSync(plist, run('security', ['cms', '-D'], { input: bytes }));
  const get = (path) => {
    const r = spawnSync('plutil', ['-extract', path, 'raw', '-o', '-', plist], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : undefined;
  };
  const count = (path) => Number(get(path) ?? 0); // raw on an array is its length
  return {
    Name: get('Name'),
    UUID: get('UUID'),
    ExpirationDate: get('ExpirationDate'),
    TeamIdentifier: [get('TeamIdentifier.0')],
    Entitlements: { 'application-identifier': get('Entitlements.application-identifier') },
    ProvisionedDevices: { length: count('ProvisionedDevices') },
    // raw on data is its base64
    DeveloperCertificates: Array.from({ length: count('DeveloperCertificates') }, (_, i) => get(`DeveloperCertificates.${i}`)),
  };
}

const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));
const targets = Object.entries(credentials).map(([target, c]) => {
  const profileBytes = Buffer.from(c.provisioningProfileBase64, 'base64');
  const profile = decodeProfile(profileBytes);
  const team = profile.TeamIdentifier?.[0];
  const appId = profile.Entitlements?.['application-identifier'] ?? '';
  const bundleId = appId.startsWith(`${team}.`) ? appId.slice(team.length + 1) : appId;
  return { target, c, profileBytes, profile, team, bundleId };
});
if (!targets.length) throw new Error('the build has no iOS credentials (is the profile internal distribution with remote credentials?)');
for (const t of targets) console.error(`signing: target ${t.target}: ${t.bundleId} (${t.profile.Name}, team ${t.team}, expires ${t.profile.ExpirationDate}, ${t.profile.ProvisionedDevices?.length ?? 0} devices)`);
const wanted = process.env.EXACT_CI_BUNDLE_ID;
const chosen = wanted
  ? targets.find((t) => t.bundleId === wanted)
  : [...targets].sort((a, b) => a.bundleId.length - b.bundleId.length || a.bundleId.localeCompare(b.bundleId))[0];
if (!chosen) throw new Error(`no credentials for ${wanted}; have ${targets.map((t) => t.bundleId).join(', ')}`);
if (chosen.bundleId.includes('*')) throw new Error(`the profile for ${chosen.target} is a wildcard (${chosen.bundleId}); name the bundle id with EXACT_CI_BUNDLE_ID`);

// The profile's certificates, by SHA-1: the identity must be one of them.
const allowed = new Set((chosen.profile.DeveloperCertificates ?? []).map((der) =>
  createHash('sha1').update(Buffer.from(der, 'base64')).digest('hex').toUpperCase()));

const profilePath = resolve(stateDir, 'adhoc.mobileprovision');
writeFileSync(profilePath, chosen.profileBytes);
const p12Path = resolve(stateDir, 'distribution.p12');
writeFileSync(p12Path, Buffer.from(chosen.c.distributionCertificate.dataBase64, 'base64'), { mode: 0o600 });

const keychain = resolve(stateDir, 'exact-ci.keychain-db');
const password = randomBytes(16).toString('hex');
spawnSync('security', ['delete-keychain', keychain]);
run('security', ['create-keychain', '-p', password, keychain], { quiet: true });
run('security', ['set-keychain-settings', '-lut', '21600', keychain]);
run('security', ['unlock-keychain', '-p', password, keychain], { quiet: true });
run('security', ['import', p12Path, '-k', keychain, '-f', 'pkcs12', '-P', chosen.c.distributionCertificate.password ?? '',
  '-T', '/usr/bin/codesign', '-T', '/usr/bin/security'], { quiet: true });
run('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k', password, keychain], { quiet: true });
// codesign finds identities through the user search list.
const current = run('security', ['list-keychains', '-d', 'user']).split('\n').map((l) => l.trim().replace(/^"|"$/g, '')).filter(Boolean);
if (!current.includes(keychain)) run('security', ['list-keychains', '-d', 'user', '-s', keychain, ...current]);

const identities = run('security', ['find-identity', '-v', '-p', 'codesigning', keychain]);
const sha1 = [...identities.matchAll(/^\s*\d+\)\s+([0-9A-F]{40})\s+"(.+)"$/gm)].map(([, h, name]) => ({ h, name })).find(({ h }) => allowed.has(h));
if (!sha1) {
  throw new Error(`no valid code signing identity in the imported certificate matches the profile ${chosen.profile.Name}:\n${identities}`);
}
console.error(`signing: ${chosen.bundleId} with "${sha1.name}" (${sha1.h}), profile ${chosen.profile.Name} (${chosen.profile.UUID})`);

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
console.log([
  `export EXACT_IDENTITY=${q(sha1.h)}`,
  `export EXACT_PROFILE=${q(profilePath)}`,
  `export EXACT_CI_APP_ID=${q(chosen.bundleId)}`,
  `export EXACT_CI_KEYCHAIN=${q(keychain)}`,
].join('\n'));
