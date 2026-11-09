// Read-only evidence extraction from a retained SQLite backup. No engine imports.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function exportAudit(source, destination, { sourceCommit = null } = {}) {
  if(resolve(source)===resolve(destination)) throw Error('Audit output must be a different file');
  const db=new DatabaseSync(source,{readOnly:true});
  try {
    const row=db.prepare('SELECT state FROM game WHERE id=1').get();
    if(!row) throw Error('No committed event state');
    const state=JSON.parse(row.state);
    if(!state.snapshot || !['finale','awards','closed'].includes(state.phase)) throw Error('Capture requires a frozen event in finale, awards or closed');
    if(state.contentHash!==state.snapshot.contentHash || state.seed!==state.snapshot.seed) throw Error('Frozen snapshot does not match event identity');
    if(!state.requests || typeof state.requests!=='object') throw Error('Accepted-request journal unavailable');
    const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
    const evidence={
      label:'Read-only extraction of committed frozen event and accepted requests; contains participant data, excludes session/invitation tables',
      sourceCommit,
      contentHash:state.contentHash,seed:state.seed,snapshotAt:state.snapshot.at,
      capturedAt:new Date().toISOString(),phase:state.phase,
      snapshotHashAlgorithm:'SHA256(JSON.stringify(snapshot)) UTF8',snapshotHash:hash(state.snapshot),
      requestsHash:hash(state.requests),snapshot:state.snapshot,requests:state.requests,operationalAudit:state.audit,
    };
    writeFileSync(destination,JSON.stringify(evidence,null,2)+'\n',{flag:'wx',mode:0o600});
    return {snapshotHash:evidence.snapshotHash,requestsHash:evidence.requestsHash,phase:evidence.phase};
  } finally {db.close();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [source,destination,sourceCommit]=process.argv.slice(2);
  if(!source||!destination) throw Error('Usage: node scripts/export-audit.mjs BACKUP.sqlite NEW-JOURNAL.json [SOURCE_COMMIT]');
  console.log(JSON.stringify(exportAudit(source,destination,{sourceCommit:sourceCommit||null})));
}
