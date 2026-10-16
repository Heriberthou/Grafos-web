import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeVersions,initialSelection,defaultRelease} from '../dist/imagery.js';
const catalog=JSON.parse(readFileSync(new URL('../dist/wayback-catalog.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
const versions=normalizeVersions(catalog);
test('catálogo real contiene 2023 y plantillas Leaflet con orden z/y/x',()=>{
 assert.equal(versions.length,catalog.versions.length);
 assert.ok(versions.some(v=>v.date===defaultRelease));
 for(const v of versions){assert.match(v.template,/\/\d+\/\{z\}\/\{y\}\/\{x\}$/);assert.ok(v.date>='2020-01-01'&&v.date<='2025-12-31');}
});
test('primera apertura selecciona la versión configurada y respeta preferencias',()=>{
 assert.deepEqual(initialSelection(versions,null),{base:'historical',release:defaultRelease});
 assert.deepEqual(initialSelection(versions,{base:'satellite',release:'2023-11-01'}),{base:'satellite',release:'2023-11-01'});
 assert.deepEqual(initialSelection(versions,{base:'invalid',release:'1900-01-01'}),{base:'historical',release:defaultRelease});
});
test('catálogo rechaza URLs ajenas y fechas fuera del intervalo',()=>{
 assert.deepEqual(normalizeVersions({versions:[{date:'2023-12-07',url:'https://example.com'},{...catalog.versions[0],date:'1990-01-01'}]}),[]);
});
