import { cp, mkdir, rm } from 'node:fs/promises';
const files = ['index.html','theme-init.js','styles.css','app.js','viewport-layout.js','catalogue-motion.js','select-menu.js','patient-picker.js','wheel-motion.js','wheel-feedback.js','patient-picker-model.js','patient-picker.css','engine.js','catalogue.js','catalogue-selection.js', 'workflow.js','dental-systemic.js','dental-topicals.js','human-regimens.js','human-regimen-engine.js','product-search.js', 'tablet-doses.js','dental-output.js','regimens.js','regimen-engine.js','equine-nsaids.js','equine-antiparasitics.js','manifest.webmanifest','sw.js','icons','.nojekyll'];
await rm(new URL('./dist/',import.meta.url),{recursive:true,force:true});
await mkdir(new URL('./dist/',import.meta.url),{recursive:true});
for (const file of files) await cp(new URL(file,import.meta.url),new URL(`dist/${file}`,import.meta.url),{recursive:true});
console.log('RxCalc static build ready in dist/');
