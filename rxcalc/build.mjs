import { cp, mkdir, rm } from 'node:fs/promises';
const files = ['index.html','styles.css','app.js','engine.js','catalogue.js','catalogue-selection.js', 'workflow.js','dental-systemic.js','dental-topicals.js','human-regimens.js','human-regimen-engine.js','product-search.js','dental-output.js','regimens.js','regimen-engine.js','equine-nsaids.js','equine-antiparasitics.js','manifest.webmanifest','sw.js','icons','.nojekyll'];
await rm(new URL('./dist/',import.meta.url),{recursive:true,force:true});
await mkdir(new URL('./dist/',import.meta.url),{recursive:true});
for (const file of files) await cp(new URL(file,import.meta.url),new URL(`dist/${file}`,import.meta.url),{recursive:true});
console.log('RxCalc static build ready in dist/');
