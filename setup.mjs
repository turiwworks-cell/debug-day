import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import readline from 'node:readline/promises';
import {fileURLToPath} from 'node:url';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const cli=path.resolve('node_modules/wrangler/bin/wrangler.js');
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
function run(args,input){const result=spawnSync(process.execPath,[cli,...args],{stdio:input===undefined?'inherit':['pipe','inherit','inherit'],input:input===undefined?undefined:input+'\n'});if(result.status!==0)throw Error('Cloudflare command failed. Your existing data was not deleted.');}
try{
 console.log('\nDebug Day · Cloudflare Free + D1\nThis deploys the app and private sync/MCP API to your Cloudflare account.\nNo paid plan or custom domain is needed.\n');
 await rl.question('Press Enter to sign in to Cloudflare in your browser… ');run(['login']);
 let config=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));
 const name=(await rl.question('App name [debug-day]: ')).trim()||'debug-day';if(!/^[a-z][a-z0-9-]{1,49}$/.test(name))throw Error('Use a lowercase name with letters, digits and dashes.');config.name=name;fs.writeFileSync('wrangler.jsonc',JSON.stringify(config,null,2)+'\n');
 if(config.d1_databases[0].database_id==='REPLACE_WITH_YOUR_D1_DATABASE_ID'){
  const has=(await rl.question('Use an existing D1 database? [y/N]: ')).trim().toLowerCase()==='y';
  if(!has){console.log('Creating a free D1 database. Copy the database_id printed below.');run(['d1','create',config.d1_databases[0].database_name,'--no-update-config']);}
  const id=(await rl.question('D1 database_id: ')).trim();if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Invalid database ID');config.d1_databases[0].database_id=id;
  if(has){const dbName=(await rl.question('Existing D1 database name: ')).trim();if(!dbName)throw Error('Database name is required');config.d1_databases[0].database_name=dbName;}
  fs.writeFileSync('wrangler.jsonc',JSON.stringify(config,null,2)+'\n');
 }
 run(['d1','execute',config.d1_databases[0].database_name,'--remote','--file=schema.sql']);
 run(['deploy']);
 const keysFile='PRIVATE-KEYS.txt';
 if(!fs.existsSync(keysFile)){
  const sync=randomBytes(32).toString('hex'),read=randomBytes(32).toString('hex'),write=randomBytes(32).toString('hex');
  fs.writeFileSync(keysFile,'Debug Day private keys — keep outside Git and shared folders.\n\nSYNC_TOKEN='+sync+'\n\nMCP_READ_TOKEN='+read+'\n\nMCP_WRITE_TOKEN='+write+'\n',{mode:0o600});
  run(['secret','put','SYNC_TOKEN'],sync);run(['secret','put','MCP_READ_TOKEN'],read);
  const allow=(await rl.question('Enable MCP editing? Read-only works without it. [y/N]: ')).trim().toLowerCase()==='y';if(allow)run(['secret','put','MCP_WRITE_TOKEN'],write);
  console.log('Private keys saved to PRIVATE-KEYS.txt. They are not included in the public website.');
 }else {const text=fs.readFileSync(keysFile,'utf8'),sync=/SYNC_TOKEN=(\S+)/.exec(text)?.[1],read=/MCP_READ_TOKEN=(\S+)/.exec(text)?.[1],write=/MCP_WRITE_TOKEN=(\S+)/.exec(text)?.[1];if(!sync||!read)throw Error('Existing key file is invalid. Preserve a backup before changing it.');run(['secret','put','SYNC_TOKEN'],sync);run(['secret','put','MCP_READ_TOKEN'],read);if(write&&(await rl.question('Enable MCP editing with the existing write key? [y/N]: ')).trim().toLowerCase()==='y')run(['secret','put','MCP_WRITE_TOKEN'],write);console.log('Existing private keys preserved.');}
 run(['deploy']);
 console.log('\nOpen the workers.dev URL printed above → Settings → Cloud sync.\nEnter that URL and SYNC_TOKEN from PRIVATE-KEYS.txt.\nOn another device, enter the same URL and key and choose “Use cloud data on this device”.\nFor MCP, use /mcp and MCP_READ_TOKEN. Never give the sync key to an AI assistant.\n');
}catch(e){console.error('\n'+e.message);process.exitCode=1;}finally{rl.close();}
