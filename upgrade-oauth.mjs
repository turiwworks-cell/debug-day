// Run from the existing installed project. Keeps D1 ID, private keys and data.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
try {
 const file='wrangler.jsonc',original=fs.readFileSync(file,'utf8'),config=JSON.parse(original);
 if(!config.d1_databases?.some(db=>db.binding==='DB'&&/^[0-9a-f-]{36}$/i.test(db.database_id)))throw Error('Use this updater inside your already-installed Debug Day folder, with its existing D1 database_id.');
 const cli=path.resolve('node_modules/wrangler/bin/wrangler.js');if(!fs.existsSync(cli))throw Error('Wrangler is missing. Use the original installed project folder.');
 if(!fs.existsSync('src/oauth.js'))throw Error('Copy the updated src folder and schema.sql here first.');
 config.assets.run_worker_first=[...new Set([...(config.assets.run_worker_first||[]),'/api/*','/mcp','/oauth/*','/.well-known/*'])];
 if(!fs.existsSync('wrangler.pre-oauth.jsonc'))fs.writeFileSync('wrangler.pre-oauth.jsonc',original);
 fs.writeFileSync(file,JSON.stringify(config,null,2)+'\n');
 function run(args){const r=spawnSync(process.execPath,[cli,...args],{stdio:'inherit'});if(r.status!==0)throw Error('Update stopped. Your keys and planner data are preserved. Resolve the error and run this updater again.');}
 console.log('Adding OAuth tables to the existing database. No planner tables or private keys will be replaced.');
 run(['d1','execute',config.d1_databases.find(db=>db.binding==='DB').database_name,'--remote','--file=schema.sql']);
 run(['deploy']);
 console.log('\nOAuth upgrade complete. Existing Claude connections still use the same keys.\nIn ChatGPT use the same /mcp URL with OAuth. On the Debug Day consent page choose Read and edit, then paste MCP_WRITE_TOKEN privately.\n');
}catch(e){console.error(e.message);process.exitCode=1;}
