import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {zipSync} from 'fflate';
const files=['manifest.json','popup.html','popup.js','style.css','content.js','README.txt'];
const entries={};for(const file of files)entries[file]=new Uint8Array(await readFile(new URL('../extensions/profile-mapper/'+file,import.meta.url)));
await mkdir(new URL('../public/downloads/',import.meta.url),{recursive:true});
await writeFile(new URL('../public/downloads/xrp-profile-mapper.zip',import.meta.url),zipSync(entries));
