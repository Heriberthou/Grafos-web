const preferenceKey = 'rutas-pxm-imagery-v1';
export const defaultRelease = '2024-10-10';

export function normalizeVersions(catalog) {
 const versions = new Map();
 for (const item of catalog?.versions ?? []) {
  if (!/^202[0-5]-\d{2}-\d{2}$/.test(item.date) || typeof item.url !== 'string') continue;
  if (!/^https:\/\/wayback\.maptiles\.arcgis\.com\/arcgis\/rest\/services\/World_Imagery\/WMTS\/1\.0\.0\/default028mm\/MapServer\/tile\/\d+\/\{level\}\/\{row\}\/\{col\}$/.test(item.url)) continue;
  versions.set(item.date, {...item, template:item.url.replace('{level}','{z}').replace('{row}','{y}').replace('{col}','{x}')});
 }
 return [...versions.values()].sort((a,b)=>b.date.localeCompare(a.date));
}

export function initialSelection(versions, saved) {
 const release = versions.find(v=>v.date===saved?.release)?.date
  ?? versions.find(v=>v.date===defaultRelease)?.date
  ?? versions.find(v=>v.date.startsWith('2023-'))?.date
  ?? versions[0]?.date;
 return {base:['street','satellite','historical'].includes(saved?.base)?saved.base:'historical',release};
}

export async function setupImagery(map, layers, toast) {
 const $=id=>document.getElementById(id);
 const base=$('basemap'),year=$('imageryYear'),date=$('imageryDate'),status=$('imageryStatus');
 let versions=[],active=layers.satellite,historical=null,currentRelease=null,loaded=false;
 const format=date=>date.split('-').reverse().join('/');
 const note='Fecha de publicación de Esri; la fotografía puede ser anterior. Algunas versiones muestran la misma imagen en esta zona.';
 function save(){try{localStorage.setItem(preferenceKey,JSON.stringify({base:base.value,release:currentRelease}));}catch{/* The map still works when storage is unavailable. */}}
 function updateControls(){
  const history=base.value==='historical';
  $('historyDates').hidden=!history;
  year.disabled=date.disabled=!loaded;
 }
 function fillDates(selected){
  date.replaceChildren();
  for(const version of versions.filter(v=>v.date.startsWith(year.value+'-')))date.add(new Option(format(version.date),version.date));
  if([...date.options].some(o=>o.value===selected))date.value=selected;
 }
 function apply(){
  updateControls();
  let next;
  if(base.value==='historical'){
   const version=versions.find(v=>v.date===date.value);
   if(!version)return;
   currentRelease=version.date;
   if(historical)map.removeLayer(historical);
   next=historical=L.tileLayer(version.template,{maxNativeZoom:18,maxZoom:24,attribution:`World Imagery Wayback (${version.date}) © Esri, Maxar, Earthstar Geographics, and the GIS User Community`});
   let failed=false;
   next.on('tileerror',()=>{
    if(active!==next||failed)return;failed=true;
    status.textContent=`No se pudieron cargar algunas imágenes de ${format(version.date)}. Prueba otra fecha o «Satélite más reciente».`;
    toast('No se pudo cargar parte del mapa histórico. Puedes cambiar la versión.');
   });
   next.on('load',()=>{if(active===next&&!failed)status.textContent=`Versión ${format(version.date)}. ${note}`;});
   status.textContent=`Cargando versión ${format(version.date)}… ${note}`;
  }else{
   next=layers[base.value];
   status.textContent=base.value==='satellite'?'Versión más reciente de Esri. No indica la fecha de captura de la fotografía.':'Plano de OpenStreetMap.';
  }
  if(active)map.removeLayer(active);
  active=next;next.addTo(map);save();
 }
 base.onchange=apply;
 year.onchange=()=>{fillDates();apply();};
 date.onchange=apply;
 try{
  const response=await fetch('./wayback-catalog.json');
  if(!response.ok)throw Error('Catálogo no disponible');
  versions=normalizeVersions(await response.json());
  if(!versions.length)throw Error('Catálogo vacío');
  let saved;try{saved=JSON.parse(localStorage.getItem(preferenceKey));}catch{/* Use default. */}
  const selection=initialSelection(versions,saved);
  year.replaceChildren();
  for(const value of [...new Set(versions.map(v=>v.date.slice(0,4)))])year.add(new Option(value,value));
  currentRelease=selection.release;year.value=currentRelease.slice(0,4);fillDates(currentRelease);
  loaded=true;base.querySelector('[value="historical"]').disabled=false;base.value=selection.base;apply();
 }catch{
  base.value='satellite';updateControls();
  status.textContent='No se pudo abrir el catálogo histórico. Se mantiene el satélite más reciente. Recarga para reintentar.';
 }
}
