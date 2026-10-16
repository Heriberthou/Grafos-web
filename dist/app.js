import {setupNodeSearch} from './node-search.js';
import {geographicPreview} from './comparison.js';
import {ProjectStore,emptyGraph,libraryKey} from './projects.js';
import {setupImagery} from './imagery.js';
import {solveTwo,routeGeometry,distance,solve,validate,length,isSupport,supportConnections,principalGraph,insertSupport,nearestPoint} from './graph.js';
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let store,activeProject=null,libraryError='',projectAction=null,showArchived=false,hasUnsavedChanges=false;let graph=emptyGraph(),result=null,mode='select',selected=null,draw=null,pending=null,network=null,view='map',editing=false,timer;
let routes=[],routeFilter='both',stepLength=0.6521,clickOrigin=null,animationFrame=null,animationProgress=0;
const routeColors=['#bb8015','#7353c5'];
function toast(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('toast').hidden=true,4500);}
try{store=new ProjectStore(localStorage);if(store.initialize())$('libraryStatus').textContent='Tu grafo anterior se conservó como «Grafo recuperado».';}catch(e){libraryError=e.message;$('libraryStatus').textContent=libraryError;}
if(!window.L||!window.vis){$('modeBanner').hidden=false;$('modeBanner').textContent='No se cargaron las bibliotecas. Comprueba tu conexión y recarga.';throw Error('Libraries unavailable');}
const map=L.map('map',{zoomControl:false,maxZoom:24}).setView([15.8903472222,-97.0754277778],18);L.control.zoom({position:'bottomright'}).addTo(map);L.control.scale({position:'bottomleft',imperial:false}).addTo(map);
const layers={street:L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxNativeZoom:19,maxZoom:24,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}),satellite:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:18,maxZoom:24,attribution:'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'})};layers.satellite.addTo(map);let tileWarning=false;Object.values(layers).forEach(l=>l.on('tileerror',()=>{if(!tileWarning){toast('No se pudo cargar el mapa base. La vista Grafo sigue disponible.');tileWarning=true;}}));
const edgeLayer=L.layerGroup().addTo(map),nodeLayer=L.layerGroup().addTo(map),draftLayer=L.layerGroup().addTo(map),handles=L.layerGroup().addTo(map);
function save(){
 if(!activeProject)return true;
 try{activeProject=store.saveGraph(activeProject.id,graph,activeProject.revision??0);hasUnsavedChanges=false;$('saveStatus').textContent='Guardado automáticamente';return true;}
 catch(e){hasUnsavedChanges=true;$('saveStatus').textContent='Sin guardar · exporta tu grafo';toast('No se pudo guardar: '+e.message);return false;}
}
function changed(){result=null;$('comparison').hidden=true;$('result').innerHTML='<div class="empty-result">◎<h3>Grafo actualizado</h3><p>Calcula una ruta para explorar las conexiones.</p></div>';save();render();}
function weight(points){return window.turf?turf.length(turf.lineString(points.map(p=>[p.lng,p.lat])),{units:'meters'}):length(points);}
let resetSearches=[];
function updateSelects(){for(const id of ['origin','destination']){const previous=$(id).value;$(id).innerHTML=Object.values(graph.nodes).filter(n=>!isSupport(n)).map(n=>`<option value="${esc(n.id)}">${esc(n.name)}</option>`).join('');if(graph.nodes[previous]&&!isSupport(graph.nodes[previous]))$(id).value=previous;}resetSearches.forEach(reset=>reset());for(const id of ['calculate','compare'])$(id).disabled=!Object.values(graph.nodes).some(n=>!isSupport(n));}
function render(){stopAnimation();if(!result){routes=[];$('routeChoices').hidden=true;}updateSelects();$('nodeCount').textContent=Object.values(graph.nodes).filter(n=>!isSupport(n)).length+' / '+Object.values(graph.nodes).filter(isSupport).length;$('edgeCount').textContent=Object.keys(graph.edges).length;$('totalLength').textContent=Math.round(Object.values(graph.edges).reduce((s,e)=>s+e.weight,0)).toLocaleString('es-MX')+' m';document.querySelector('.map-caption small').textContent=activeProject?.name??'Tu proyecto de rutas';edgeLayer.clearLayers();nodeLayer.clearLayers();handles.clearLayers();
 for(const e of Object.values(graph.edges)){const active=result?.edges.includes(e.id),sel=selected?.type==='edge'&&selected.id===e.id;const line=L.polyline(e.geometry,{color:sel?'#3e839c':'#668b68',weight:4,opacity:.9}).addTo(edgeLayer);if(connectionLabel(e.weight))line.bindTooltip(connectionLabel(e.weight),{permanent:true,direction:'center',className:'edge-weight'});line.on('click',event=>{L.DomEvent.stopPropagation(event);if(editing&&mode==='support'){openNode(nearestPoint(e.geometry,event.latlng).coordinates,null,'support');}else if(editing&&(mode==='select'||mode==='shape')){selected={type:'edge',id:e.id};render();inspect();}});if(sel&&editing&&mode==='shape')renderShapeHandles(e,line);}
 for(const n of Object.values(graph.nodes)){const cls=result?.nodes.includes(n.id)?'path':result?.visited.includes(n.id)?'visited':selected?.id===n.id?'selected':'';const marker=L.marker(n.coordinates,{title:n.name,alt:n.name,draggable:editing&&mode==='select',icon:L.divIcon({className:'node-pin '+(isSupport(n)?'support ':'')+cls,iconSize:[18,18],iconAnchor:[9,9]})}).addTo(nodeLayer);const label=document.createElement('span');label.textContent=(isSupport(n)?'◇ ':'')+n.name;marker.bindTooltip(label,{permanent:true,direction:'top',offset:[0,-11]});marker.on('click',ev=>{L.DomEvent.stopPropagation(ev);nodeClick(n.id);});marker.on('dragend',ev=>{const p=ev.target.getLatLng();n.coordinates={lat:p.lat,lng:p.lng};for(const e of Object.values(graph.edges)){if(e.source===n.id)e.geometry[0]={...n.coordinates};if(e.target===n.id)e.geometry[e.geometry.length-1]={...n.coordinates};e.weight=weight(e.geometry);}changed();inspect();});}
 drawRoutes();if(view==='graph')renderNetwork();}
// Geometry handles change only a physical segment, never its endpoint nodes.
function renderShapeHandles(edge,line){
 const commit=()=>{edge.weight=weight(edge.geometry);changed();inspect();};
 edge.geometry.slice(1,-1).forEach((point,index)=>{
  const i=index+1;
  const marker=L.marker(point,{draggable:true,title:`Mover vértice ${i}`,alt:`Mover vértice ${i}`,icon:L.divIcon({className:'geometry-handle',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(handles);
  marker.bindTooltip('Arrastra para moldear · clic para quitar');
  marker.on('drag',event=>{const p=event.target.getLatLng();edge.geometry[i]={lat:p.lat,lng:p.lng};line.setLatLngs(edge.geometry);line.setTooltipContent(`${weight(edge.geometry).toFixed(1)} m`);});
  marker.on('dragend',commit);
  marker.on('click',event=>{L.DomEvent.stopPropagation(event);marker.bindPopup(`<button class="remove-vertex">Quitar este vértice</button>`).openPopup();marker.getPopup().getElement().querySelector('button').onclick=()=>{edge.geometry.splice(i,1);commit();};});
 });
 for(let i=0;i<edge.geometry.length-1;i++){
  const a=edge.geometry[i],b=edge.geometry[i+1],mid={lat:(a.lat+b.lat)/2,lng:(a.lng+b.lng)/2};
  L.marker(mid,{title:'Añadir vértice',alt:'Añadir vértice',icon:L.divIcon({className:'geometry-midpoint',html:'+',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(handles).bindTooltip('Añadir un punto para moldear el camino').on('click',event=>{L.DomEvent.stopPropagation(event);edge.geometry.splice(i+1,0,mid);commit();});
 }
}
function startShaping(id){changeView('map');setMode('shape');if(id){selected={type:'edge',id};render();inspect();}}
function renderNetwork(){
 if(network){const positions=network.getPositions();for(const [id,p] of Object.entries(positions))if(graph.nodes[id])graph.nodes[id].ui_position=p;network.destroy();}
 const reduced=principalGraph(graph,result);
 for(const {route,index} of visibleRoutes()){const r=principalGraph(graph,route);for(const e of Object.values(r.edges).filter(e=>e.active)){delete reduced.edges[e.id];reduced.edges['route'+index+e.id]={...e,id:'route'+index+e.id,routeIndex:index};}}
 const nodes=Object.values(reduced.nodes).map(n=>({id:n.id,label:n.name,...n.ui_position,color:result?.nodes.includes(n.id)?'#f2d479':result?.visited.includes(n.id)?'#bed8df':'#e6efda'}));
 const edges=Object.values(reduced.edges).map(e=>({id:e.id,from:e.source,to:e.target,label:connectionLabel(e.weight),color:e.routeIndex!==undefined?routeColors[e.routeIndex]:'#92aa81',width:e.routeIndex!==undefined?4:2,dashes:e.routeIndex===1,smooth:false}));
 network=new vis.Network($('network'),{nodes,edges},{nodes:{shape:'dot',size:17,borderWidth:2,font:{face:'DM Sans',size:13,color:'#34543e'},color:{border:'#628453',background:'#e6efda'}},edges:{font:{size:10,color:'#748368',strokeWidth:4,strokeColor:'#f7f9f6'},smooth:false},physics:{enabled:!nodes.every(n=>Number.isFinite(n.x)),stabilization:{iterations:180},barnesHut:{springLength:150}},interaction:{hover:true}});
 network.on('click',p=>{if(p.nodes.length)nodeClick(p.nodes[0]);else if(p.edges.length&&editing){
  const e=reduced.edges[p.edges[0]];
  $('inspector').innerHTML=`<h3>${esc(graph.nodes[e.source].name)} → ${esc(graph.nodes[e.target].name)}</h3><p>${e.weight.toFixed(1)} m · ${e.physicalEdges.length} tramos</p><p class="hint">${e.via.length?'Vía '+e.via.map(id=>esc(graph.nodes[id].name)).join(' → '):'Conexión directa'}. Se muestra la alternativa más corta; al calcular una ruta se muestra el recorrido utilizado.</p><button id="inspectPhysical">Ver tramos en el mapa</button>`;
  $('inspectPhysical').onclick=()=>{selected={type:'edge',id:e.physicalEdges[0]};changeView('map');inspect();};
 }});
 network.on('dragEnd',()=>{for(const [id,p] of Object.entries(network.getPositions()))graph.nodes[id].ui_position=p;save();});
 network.on('afterDrawing',drawNetworkTravelers);
 network.once('stabilized',()=>network.setOptions({physics:false}));
}

function nodeClick(id){if(!editing&&$('clickRouting').checked){if(isSupport(graph.nodes[id])){toast('Selecciona un nodo principal.');return;}if(clickOrigin===null){invalidateRoute();clickOrigin=id;$('origin').value=id;resetSearches.forEach(reset=>reset());$('clickHint').textContent='Origen: '+graph.nodes[id].name+'. Ahora selecciona el destino.';}else{$('destination').value=id;clickOrigin=null;calculate();$('clickHint').textContent='Ruta calculada. El siguiente clic inicia otro origen.';}return;}if(editing&&mode==='shape'){toast('Selecciona un tramo del camino. Los nodos permanecen como anclas.');return;}if(editing&&mode==='edge'){if(!draw){draw={source:id,points:[{...graph.nodes[id].coordinates}]};updateDraft();}else if(id!==draw.source){finishEdge(id);}else toast('Elige un nodo de destino diferente.');return;}if(editing){selected={type:'node',id};inspect();render();}else if(isSupport(graph.nodes[id])){setEditing(true);selected={type:'node',id};inspect();render();}else{$('destination').value=id;invalidateRoute();toast('Destino seleccionado: '+graph.nodes[id].name);}}
function setMode(next){mode=next;draw=null;selected=null;draftLayer.clearLayers();handles.clearLayers();$('inspector').innerHTML='';$('finishNode').hidden=true;$('undoVertex').hidden=true;$('shapeEdge').classList.toggle('active',next==='shape');const message=next==='shape'?'Selecciona un camino. Pulsa + para añadir un vértice y arrástralo para moldear el trazo.':next==='support'?'Haz clic sobre un camino o en el mapa para crear un apoyo.':next==='node'?'Haz clic en el mapa para crear un destino.':next==='edge'?'Selecciona el nodo de origen del nuevo camino.':'Selecciona un nodo o camino para editarlo.';$('editHelp').textContent=message;$('modeBanner').textContent=message;$('modeBanner').hidden=next==='select';render();}
function updateDraft(){draftLayer.clearLayers();if(draw)L.polyline(draw.points,{color:'#b49336',weight:4,dashArray:'6 7'}).addTo(draftLayer);$('finishNode').hidden=!draw||draw.points.length<2;$('undoVertex').hidden=!draw||draw.points.length<2;const message='Añade vértices en el mapa; termina haciendo clic en otro nodo.';$('editHelp').textContent=message;$('modeBanner').textContent=message;}
function finishEdge(target){
 const geometry=[...draw.points,{...graph.nodes[target].coordinates}];
 const duplicate=Object.values(graph.edges).some(e=>{
  const points=e.source===draw.source&&e.target===target?e.geometry:e.target===draw.source&&e.source===target?[...e.geometry].reverse():null;
  return points&&points.length===geometry.length&&points.every((p,i)=>Math.abs(p.lat-geometry[i].lat)<1e-10&&Math.abs(p.lng-geometry[i].lng)<1e-10);
 });
 if(duplicate){toast('Este tramo ya existe. Puedes reutilizarlo desde su nodo de apoyo.');setMode('select');return;}
 const id=crypto.randomUUID();graph.edges[id]={id,source:draw.source,target,geometry,weight:weight(geometry)};setMode('select');changed();toast('Camino creado con distancia calculada.');
}
function openNode(coords,id=null,type='principal'){
 pending={coords:{lat:coords.lat,lng:coords.lng},id};$('nodeLabel').value=id?graph.nodes[id].name:type==='support'?'Apoyo '+(Object.values(graph.nodes).filter(isSupport).length+1):'';
 $('nodeKind').value=id?(graph.nodes[id].type??'principal'):type;
 $('dialogTitle').textContent=id?'Editar nodo':type==='support'?'Nuevo apoyo':'Nuevo nodo';$('nodeDialog').showModal();$('nodeLabel').focus();
}
map.on('click',ev=>{if(!editing)return;const p={lat:ev.latlng.lat,lng:ev.latlng.lng};if(mode==='support')openNode(p,null,'support');else if(mode==='node')openNode(p);else if(mode==='edge'&&draw){draw.points.push(p);updateDraft();}else if(mode==='edge')toast('Primero selecciona un nodo de origen.');});
$('nodeForm').onsubmit=ev=>{
 ev.preventDefault();const name=$('nodeLabel').value.trim();if(!name)return;
 const type=$('nodeKind').value;let id=pending.id,splitCount=0;
 try{
  if(id){graph.nodes[id].name=name;graph.nodes[id].type=type;}
  else if(type==='support'){const inserted=insertSupport(graph,pending.coords,name);id=inserted.node.id;splitCount=inserted.splitCount;}
  else{id=crypto.randomUUID();graph.nodes[id]={id,name,type,coordinates:pending.coords};}
 }catch(e){$('nodeLabel').setCustomValidity(e.message);$('nodeLabel').reportValidity();return;}
 const completing=mode==='edge'&&draw&&!pending.id;$('nodeDialog').close();
 if(completing)finishEdge(id);else{setMode('select');changed();}
 if(type==='support'){selected={type:'node',id};inspect();render();toast(splitCount?`Apoyo creado: ${splitCount} caminos divididos en tramos.`:'Apoyo guardado. Conecta sus caminos con «Desde aquí».');}
 pending=null;
};
$('nodeLabel').oninput=()=> $('nodeLabel').setCustomValidity('');
$('nodeDialog').addEventListener('close',()=> $('nodeLabel').setCustomValidity(''));
$('closeDialog').onclick=()=>$('nodeDialog').close();

function inspect(){const item=selected&&(selected.type==='node'?graph.nodes[selected.id]:graph.edges[selected.id]);if(!item){$('inspector').innerHTML='';return;}if(selected.type==='node'){$('inspector').innerHTML=`<h3>${esc(item.name)}</h3><p class="hint">${item.coordinates.lat.toFixed(6)}, ${item.coordinates.lng.toFixed(6)}<br>Arrastra el nodo en el mapa para moverlo.</p><button id="rename">Nombre / tipo</button><button id="fromHere">Desde aquí</button><button id="deleteItem" class="danger">Eliminar nodo</button>`;$('rename').onclick=()=>openNode(item.coordinates,item.id);$('fromHere').onclick=()=>{changeView('map');setMode('edge');nodeClick(item.id);};}else{$('inspector').innerHTML=`<h3>${esc(graph.nodes[item.source].name)} → ${esc(graph.nodes[item.target].name)}</h3><p>${item.weight.toFixed(1)} metros · ${Math.max(0,item.geometry.length-2)} ${item.geometry.length===3?'vértice':'vértices'}</p><p class="hint">${mode==='shape'?'Pulsa + sobre el tramo y arrastra el nuevo cuadrado. Haz clic en un cuadrado para quitarlo. Los extremos principales y de apoyo se conservan.':'Moldea este tramo con puntos intermedios, sin cambiar sus conexiones ni sus nodos de apoyo.'}</p><button id="shapeSelected">${mode==='shape'?'Terminar edición del trazo':'Moldear este camino'}</button><button id="deleteItem" class="danger">Eliminar camino</button>`;$('shapeSelected').onclick=()=>{if(mode==='shape'){setMode('select');}else startShaping(item.id);};}

 if(selected.type==='node'&&isSupport(item)){
  const connections=supportConnections(graph,item.id);
  const adjacent=Object.values(graph.edges).filter(e=>e.source===item.id||e.target===item.id);
  $('inspector').insertAdjacentHTML('beforeend',`<div class="support-details"><h4>${connections.length} principales conectados</h4><p class="hint">Distancia mínima por caminos, pasando solo por apoyos hasta llegar a cada principal.</p>${connections.length?'<ul>'+connections.map(c=>`<li><strong>${esc(graph.nodes[c.target].name)}</strong> · ${c.weight.toFixed(1)} m<small>${c.nodes.map(id=>esc(graph.nodes[id].name)).join(' → ')}</small></li>`).join('')+'</ul>':'<p class="hint">Todavía no llega a ningún nodo principal.</p>'}<h4>${adjacent.length} tramos incidentes</h4><ul>${adjacent.map(e=>{const other=graph.nodes[e.source===item.id?e.target:e.source];return `<li>${isSupport(other)?'◇ Apoyo':'● Principal'}: ${esc(other.name)} · ${e.weight.toFixed(1)} m</li>`;}).join('')}</ul></div>`);
 }
 $('deleteItem').onclick=()=>{if(!confirm(selected.type==='node'?'¿Eliminar este nodo y sus caminos conectados?':'¿Eliminar este camino?'))return;if(selected.type==='node'){delete graph.nodes[item.id];for(const e of Object.values(graph.edges))if(e.source===item.id||e.target===item.id)delete graph.edges[e.id];}else delete graph.edges[item.id];selected=null;changed();inspect();};}
function changeView(next){stopAnimation();view=next;$('map').hidden=next!=='map';$('network').hidden=next!=='graph';$('imageryControls').hidden=next!=='map';$('mapView').classList.toggle('active',next==='map');$('graphView').classList.toggle('active',next==='graph');if(next==='map'){map.invalidateSize();render();}else{if(mode!=='select')setMode('select');renderNetwork();}if(result)playRoutes();}
function setEditing(value){clickOrigin=null;stopAnimation();editing=value;$('routePanel').hidden=value;$('editPanel').hidden=!value;$('routeTab').classList.toggle('active',!value);$('editTab').classList.toggle('active',value);setMode('select');}
function approximateSteps(meters){const steps=Math.round(meters/stepLength);return `≈ ${steps.toLocaleString('es-MX')} ${steps===1?'paso':'pasos'}`;}
function showResult(r){result=r;render();$('result').innerHTML=r.found?`<div class="result-card"><div class="eyebrow">${esc(r.algorithm)} · RUTA ${Math.max(1,routes.indexOf(r)+1)}</div><div class="distance">${r.distance.toFixed(1)} <small>metros</small></div><div class="approximate-steps">${approximateSteps(r.distance)}</div><div class="metrics"><span>${r.time.toFixed(3)} ms</span><span>${r.visited.length} nodos explorados</span></div><ol class="path-list">${r.nodes.filter(id=>!isSupport(graph.nodes[id])).map(id=>`<li>${esc(graph.nodes[id].name)}</li>`).join('')}</ol><details><summary>Recorrido completo con apoyos</summary><p>${r.nodes.map(id=>esc(graph.nodes[id].name)+(isSupport(graph.nodes[id])?' (apoyo)':'')).join(' → ')}</p></details><details><summary>Orden de exploración</summary><p>${r.visited.map(id=>esc(graph.nodes[id].name)).join(' → ')}</p></details>${['BFS','DFS'].includes(r.algorithm)?'<p class="hint">Este recorrido no garantiza la menor distancia en metros.</p>':''}</div>`:'<div class="result-card"><h3>No existe una ruta</h3><p class="hint">Los destinos están desconectados. Añade un camino entre sus componentes.</p></div>';}
function calculate(algorithm=$('algorithm').value){try{routes=solveTwo(graph,$('origin').value,$('destination').value,algorithm);routeFilter='both';showResult(routes[0]);showRouteChoices();playRoutes();return routes[0];}catch(e){toast(e.message);}}
$('calculate').onclick=()=>calculate();
$('compare').onclick=()=>{
 try{
 const results=['Dijkstra','A*','BFS','DFS'].map(a=>solve(graph,$('origin').value,$('destination').value,a));
 const best=results[0],maxDistance=Math.max(1,...results.map(r=>r.distance??0));
 const descriptions={'Dijkstra':'Minimiza la distancia total en metros.','A*':'Minimiza metros usando la distancia al destino como guía.','BFS':'Minimiza el número de tramos, incluidos los apoyos.','DFS':'Explora una rama hasta el fondo; depende del orden de las conexiones.'};
 $('comparison').hidden=false;
 $('comparison').innerHTML=`<details class="comparison-section" open><summary><span>Comparación de algoritmos<small>${esc(graph.nodes[$('origin').value].name)} → ${esc(graph.nodes[$('destination').value].name)}</small></span><span class="fold-chevron" aria-hidden="true">⌄</span></summary><p class="hint">Mismo grafo, origen y destino. Las miniaturas conservan la ubicación y las curvas del mapa. O: origen · D: destino · dorado: recorrido · azul: nodos explorados.</p><div class="algorithm-grid">${results.map((r,i)=>{
 const optimal=r.found&&Math.abs(r.distance-best.distance)<0.000001;
 const extra=r.found?r.distance-best.distance:0;
 return `<article class="algorithm-card"><div class="algorithm-title"><h3>${esc(r.algorithm)}</h3><span class="cost-badge ${optimal?'optimal':''}">${!r.found?'Sin conexión':optimal?'Distancia mínima':'Recorrido alternativo'}</span></div>${geographicPreview(graph,r)}<div class="algorithm-body"><div class="algorithm-distance">${r.found?r.distance.toFixed(1)+' <small>m</small>':'Sin ruta'}</div><p class="algorithm-steps">${r.found?approximateSteps(r.distance):'No se pudo llegar al destino.'}</p><div class="distance-bar" aria-hidden="true"><span style="width:${r.found?r.distance/maxDistance*100:0}%"></span></div><p class="distance-note">${!r.found?'Destinos desconectados':optimal?'Coincide con la menor distancia':'+ '+extra.toFixed(1)+' m frente a la menor distancia'}</p><dl class="algorithm-metrics"><div><dt>Tramos</dt><dd>${r.edges.length}</dd></div><div><dt>Explorados</dt><dd>${r.visited.length} / ${Object.keys(graph.nodes).length}</dd></div><div><dt>Tiempo</dt><dd>${r.time.toFixed(3)} ms</dd></div><div><dt>Apoyos en ruta</dt><dd>${r.nodes.filter(id=>isSupport(graph.nodes[id])).length}</dd></div></dl><button class="primary wide" data-result="${i}" ${r.found?'':'disabled'}>Ver ruta →</button><details class="algorithm-details"><summary>Detalles del recorrido</summary><p>${descriptions[r.algorithm]}</p>${['BFS','DFS'].includes(r.algorithm)?'<p>No garantiza la menor distancia en metros, aunque puede coincidir con ella en este recorrido.</p>':''}<h4>Nodos del recorrido</h4><p>${r.found?r.nodes.map(id=>esc(graph.nodes[id].name)+(isSupport(graph.nodes[id])?' (apoyo)':'')).join(' → '):'Sin ruta'}</p><h4>Orden de exploración</h4><p>${r.visited.map(id=>esc(graph.nodes[id].name)).join(' → ')}</p></details></div></article>`;
 }).join('')}</div><details class="comparison-explanation"><summary>Cómo interpretar esta comparación</summary><p>La referencia de distancia mínima es Dijkstra. La etiqueta «Distancia mínima» indica que el recorrido encontrado alcanza ese mismo costo; no significa que BFS o DFS garanticen ese resultado para cualquier grafo. Los tramos y los nodos explorados incluyen los apoyos.</p><p>El tiempo corresponde a una ejecución de la búsqueda principal y varía entre ejecuciones. No incluye el dibujo, la animación ni el cálculo de la segunda ruta. Un valor de 0.000 ms puede deberse a la resolución del reloj.</p></details></details>`;
 document.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>{
 const r=results[Number(b.dataset.result)];$('algorithm').value=r.algorithm;
 $('algoHint').textContent=descriptions[r.algorithm];routes=solveTwo(graph,$('origin').value,$('destination').value,r.algorithm);routes[0]=r;routeFilter='0';showResult(r);showRouteChoices();
 changeView('map');$('result').scrollIntoView({behavior:'smooth',block:'center'});
 });
 $('algorithm').value='Dijkstra';$('algoHint').textContent=descriptions.Dijkstra;routes=solveTwo(graph,$('origin').value,$('destination').value,'Dijkstra');routes[0]=best;routeFilter='0';showResult(best);showRouteChoices();playRoutes();
 $('comparison').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){toast(e.message);}
};

$('algorithm').onchange=()=>{invalidateRoute();$('algoHint').textContent=({'Dijkstra':'Encuentra la ruta con menor distancia total.','A*':'Usa la distancia geodésica al destino como heurística.','BFS':'Encuentra la ruta con menos tramos (incluidos apoyos), sin optimizar metros.','DFS':'Explora en profundidad; no garantiza una ruta óptima.'})[$('algorithm').value];};
function invalidateRoute(){clickOrigin=null;result=null;$('comparison').hidden=true;$('result').innerHTML='<div class="empty-result"><h3>Selección actualizada</h3><p>Calcula la nueva ruta.</p></div>';render();}
$('origin').onchange=invalidateRoute;$('destination').onchange=invalidateRoute;$('swap').onclick=()=>{const o=$('origin').value;$('origin').value=$('destination').value;$('destination').value=o;invalidateRoute();};
$('routeTab').onclick=()=>setEditing(false);$('editTab').onclick=()=>setEditing(true);$('addNode').onclick=()=>{changeView('map');setMode('node');};$('addSupport').onclick=()=>{changeView('map');setMode('support');};$('addEdge').onclick=()=>{changeView('map');setMode('edge');};$('shapeEdge').onclick=()=>startShaping(selected?.type==='edge'?selected.id:null);$('cancel').onclick=()=>setMode('select');document.addEventListener('keydown',ev=>{if(ev.key==='Escape')setMode('select');});$('finishNode').onclick=()=>openNode({...draw.points[draw.points.length-1]});$('undoVertex').onclick=()=>{draw.points.pop();updateDraft();};$('mapView').onclick=()=>changeView('map');$('graphView').onclick=()=>changeView('graph');
function fit(){const points=Object.values(graph.nodes).map(n=>n.coordinates);if(view==='graph')network?.fit();else if(points.length)map.fitBounds(L.latLngBounds(points),{padding:[70,85],maxZoom:18});}$('fit').onclick=fit;setupImagery(map,layers,toast);
function flushProject(){
 if(!activeProject)return true;
 if(draw&&!confirm('El camino en curso aún no está terminado. ¿Salir y descartarlo?'))return false;
 if(network)for(const [id,p] of Object.entries(network.getPositions()))if(graph.nodes[id])graph.nodes[id].ui_position=p;
 return save();
}
function destroyNetwork(){stopAnimation();if(network){network.destroy();network=null;}}
function showLibrary(){
 if(!flushProject())return;
 destroyNetwork();activeProject=null;result=null;draw=null;mode='select';selected=null;
 $('editor').hidden=true;$('libraryPage').hidden=false;$('export').disabled=true;
 document.title='Rutas PXM · Biblioteca';renderLibrary();window.scrollTo(0,0);
}
function renderLibrary(){
 if(libraryError){$('libraryStatus').textContent=libraryError;return;}
 try{
  const all=store.list(showArchived),query=$('projectSearch').value.trim().toLocaleLowerCase('es');
  const projects=all.filter(p=>p.name.toLocaleLowerCase('es').includes(query));
  $('libraryHeading').textContent=showArchived?'Papelera':'Proyectos guardados';
  $('showProjects').classList.toggle('active',!showArchived);$('showProjects').setAttribute('aria-pressed',String(!showArchived));
  $('showTrash').classList.toggle('active',showArchived);$('showTrash').setAttribute('aria-pressed',String(showArchived));
  $('projectList').innerHTML=projects.length?projects.map(p=>{
   const nodes=Object.values(p.graph.nodes),principals=nodes.filter(n=>!isSupport(n)).length,supports=nodes.length-principals;
   const updated=new Date(p.updatedAt).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'});
   return `<article class="project-card"><div class="project-art" aria-hidden="true"><svg viewBox="0 0 260 95"><path d="M25 65L90 30L165 65L230 25M90 30L230 25M25 65L165 65"/><circle cx="25" cy="65" r="6"/><circle cx="90" cy="30" r="8"/><circle cx="165" cy="65" r="7"/><circle cx="230" cy="25" r="6"/></svg></div><div class="project-card-body"><h3>${esc(p.name)}</h3><p>${principals} principales · ${supports} apoyos · ${Object.keys(p.graph.edges).length} caminos</p><small>Actualizado ${esc(updated)}</small><div class="project-actions">${showArchived?`<button data-project-action="restore" data-id="${esc(p.id)}">Restaurar</button>`:`<button class="primary" data-project-action="open" data-id="${esc(p.id)}" aria-label="Abrir ${esc(p.name)}">Abrir →</button><button data-project-action="rename" data-id="${esc(p.id)}" aria-label="Renombrar ${esc(p.name)}">Renombrar</button><button data-project-action="duplicate" data-id="${esc(p.id)}" aria-label="Duplicar ${esc(p.name)}">Duplicar</button><button class="danger" data-project-action="archive" data-id="${esc(p.id)}" aria-label="Eliminar ${esc(p.name)}">Eliminar</button>`}</div></div></article>`;
  }).join(''):`<div class="library-empty"><span>⌘</span><h3>${query?'Sin coincidencias':showArchived?'La papelera está vacía':'Tu primer grafo empieza aquí'}</h3><p>${query?'Prueba otro nombre.':showArchived?'Los proyectos que elimines se podrán restaurar aquí.':'Pulsa «Nuevo grafo» para colocar tus primeros puntos sobre el mapa.'}</p></div>`;
 }catch(e){$('libraryStatus').textContent=e.message;}
}
function openProject(id){
 try{
  const next=store.get(id);if(!flushProject())return;
  destroyNetwork();activeProject=next;graph=next.graph;result=null;selected=null;draw=null;pending=null;
  $('libraryPage').hidden=true;$('editor').hidden=false;$('export').disabled=false;
  $('projectTitle').textContent=next.name;document.title=next.name+' · Rutas PXM';$('saveStatus').textContent='Guardado automáticamente';
  $('origin').value='';$('destination').value='';$('comparison').hidden=true;
  $('result').innerHTML='<div class="empty-result">◎<h3>Explora tus conexiones</h3><p>Selecciona dos destinos para calcular una ruta.</p></div>';
  changeView('map');setEditing(Object.keys(graph.nodes).length===0);map.invalidateSize();
  if(Object.keys(graph.nodes).length)fit();else map.setView([15.8903472222,-97.0754277778],18);
  window.scrollTo(0,0);
 }catch(e){toast(e.message);}
}
function projectDialog(action,id=null){
 if(libraryError){toast(libraryError);return;}
 projectAction={action,id};const rename=action==='rename';
 $('projectDialogTitle').textContent=rename?'Renombrar proyecto':'Nuevo grafo';
 $('projectDialogHint').textContent=rename?'El nombre cambia; tus nodos y caminos se conservan.':'Comienza con un mapa vacío, sin nodos ni caminos de ejemplo.';
 $('submitProject').textContent=rename?'Guardar nombre':'Crear grafo';
 $('projectLabel').value=rename?store.get(id).name:'';$('projectLabel').setCustomValidity('');
 $('projectDialog').showModal();$('projectLabel').focus();
}
$('projectForm').onsubmit=e=>{
 e.preventDefault();const name=$('projectLabel').value.trim();if(!name){$('projectLabel').setCustomValidity('Escribe el nombre del proyecto.');$('projectLabel').reportValidity();return;}
 try{
  if(projectAction.action==='rename'){store.rename(projectAction.id,name);$('projectDialog').close();renderLibrary();}
  else{if(!flushProject())return;const p=store.create(name);$('projectDialog').close();openProject(p.id);}
 }catch(error){$('projectLabel').setCustomValidity(error.message);$('projectLabel').reportValidity();}
};
$('projectLabel').oninput=()=> $('projectLabel').setCustomValidity('');
$('cancelProject').onclick=()=> $('projectDialog').close();
$('newGraph').onclick=$('newGraphEditor').onclick=()=>projectDialog('create');
$('libraryHome').onclick=$('libraryBack').onclick=showLibrary;
$('showProjects').onclick=()=>{showArchived=false;renderLibrary();};$('showTrash').onclick=()=>{showArchived=true;renderLibrary();};
$('projectSearch').oninput=renderLibrary;
$('projectList').onclick=e=>{
 const button=e.target.closest('[data-project-action]');if(!button)return;
 const {id,projectAction:action}=button.dataset;
 try{
  if(action==='open')openProject(id);
  else if(action==='rename')projectDialog('rename',id);
  else if(action==='duplicate'){store.duplicate(id);renderLibrary();toast('Copia guardada como un proyecto independiente.');}
  else if(action==='archive'){store.archive(id);renderLibrary();toast('Proyecto en la papelera. Puedes restaurarlo.');}
  else if(action==='restore'){store.restore(id);renderLibrary();toast('Proyecto restaurado en Mis grafos.');}
 }catch(error){toast(error.message);}
};
window.addEventListener('beforeunload',e=>{if(hasUnsavedChanges){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',e=>{if(e.key===libraryKey&&!$('libraryPage').hidden)renderLibrary();});
$('export').onclick=()=>{
 if(!activeProject)return;
 const blob=new Blob([JSON.stringify({...graph,projectName:activeProject.name},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=(activeProject.name.replace(/[^a-zA-Z0-9áéíóúñ_-]/g,'-')||'rutas-pxm')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('import').onclick=()=>$('file').click();
$('file').onchange=async()=>{
 const file=$('file').files[0];if(!file)return;
 try{
  if(libraryError)throw Error(libraryError);
  if(file.size>5*1024*1024)throw Error('El archivo supera 5 MB.');
  const input=JSON.parse(await file.text()),next=validate(input);
  if(!flushProject())return;
  const name=(typeof input.projectName==='string'&&input.projectName.trim()?input.projectName:file.name.replace(/\.json$/i,'')).slice(0,80)||'Grafo importado';
  const p=store.create(name,next);openProject(p.id);toast('Importado como un proyecto nuevo. Tus otros grafos se conservaron.');
 }catch(e){toast('No se pudo importar: '+e.message);}finally{$('file').value='';}
};
const travelLayer=L.layerGroup().addTo(map),routeLayer=L.layerGroup().addTo(map);
function connectionLabel(meters){return [ $('weightsMeters').checked?meters.toFixed(1)+' m':'', $('weightsSteps').checked?approximateSteps(meters):'' ].filter(Boolean).join(' · ');}
function visibleRoutes(){return result?routes.map((route,index)=>({route,index})).filter(x=>x.route.found&&(routeFilter==='both'||routeFilter===String(x.index))):[];}
function drawRoutes(){routeLayer.clearLayers();for(const {route,index} of visibleRoutes())L.polyline(routeGeometry(graph,route),{color:routeColors[index],weight:index===0?7:4,dashArray:index===1?'9 7':null,interactive:false}).addTo(routeLayer);}
function stopAnimation(){if(animationFrame!==null)cancelAnimationFrame(animationFrame);animationFrame=null;if(typeof travelLayer!=='undefined')travelLayer.clearLayers();}
function pointAlong(points,fraction){
 if(!points.length)return null;
 const segments=points.slice(1).map((p,i)=>distance(points[i],p)),total=segments.reduce((a,b)=>a+b,0);let remaining=total*fraction;
 for(let i=0;i<segments.length;i++){if(remaining<=segments[i]){const t=segments[i]?remaining/segments[i]:0;return {lat:points[i].lat+(points[i+1].lat-points[i].lat)*t,lng:points[i].lng+(points[i+1].lng-points[i].lng)*t};}remaining-=segments[i];}return points.at(-1);
}
function playRoutes(){
 stopAnimation();animationProgress=0;const started=performance.now();
 const travelers=visibleRoutes().map(({route,index})=>({route,index,points:routeGeometry(graph,route)}));
 for(const t of travelers){if(!t.points.length)t.points=[graph.nodes[t.route.nodes[0]].coordinates];t.marker=L.circleMarker(t.points[0],{radius:t.index?6:10,color:'white',weight:2,fillColor:routeColors[t.index],fillOpacity:1,interactive:false}).addTo(travelLayer);}
 if(!travelers.length)return;
 const tick=now=>{animationProgress=Math.min(1,(now-started)/6000);for(const t of travelers)t.marker.setLatLng(pointAlong(t.points,animationProgress));network?.redraw();if(animationProgress<1)animationFrame=requestAnimationFrame(tick);else animationFrame=null;};animationFrame=requestAnimationFrame(tick);
}
function drawNetworkTravelers(ctx){
 if(!network)return;const positions=network.getPositions();
 for(const {route,index} of visibleRoutes()){
  const ids=route.nodes.filter(id=>!isSupport(graph.nodes[id]));if(!ids.length)continue;
  const progress=animationProgress*Math.max(0,ids.length-1),i=Math.min(Math.floor(progress),ids.length-1),a=positions[ids[i]],b=positions[ids[Math.min(i+1,ids.length-1)]];if(!a||!b)continue;
  const t=progress-i;ctx.beginPath();ctx.arc(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,index?6:9,0,Math.PI*2);ctx.fillStyle=routeColors[index];ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=2;ctx.stroke();
 }
}
function showRouteChoices(){
 $('routeChoices').hidden=!result?.found;if(!result?.found)return;
 $('routeChoices').innerHTML='<div class="route-buttons"><button data-route="both">Ver ambas</button>'+routes.map((r,i)=>`<button data-route="${i}" style="border-bottom:3px solid ${routeColors[i]}">Ruta ${i+1} · ${r.distance.toFixed(1)} m</button>`).join('')+'</div>'+(routes.length<2?'<p role="status">No hay una segunda ruta sin repetir nodos.</p>':'<p class="hint">Ruta 1: dorada · Ruta 2: violeta discontinua. Pueden compartir tramos.</p>')+(['BFS','DFS'].includes(result.algorithm)?'<p class="hint">BFS prioriza menos tramos; DFS explora en profundidad. Estas rutas no garantizan las menores distancias. Usa Dijkstra o A* para obtener las dos más cortas.</p>':'')+'<button id="animateRoutes">▶ Repetir recorrido</button><button id="stopRoutes">Detener</button>';
 document.querySelectorAll('[data-route]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.route===routeFilter));b.onclick=()=>{routeFilter=b.dataset.route;showResult(routes[routeFilter==='both'?0:Number(routeFilter)]);showRouteChoices();playRoutes();};});
 $('animateRoutes').onclick=playRoutes;$('stopRoutes').onclick=stopAnimation;
}
$('clickRouting').onchange=()=>{clickOrigin=null;$('clickHint').hidden=!$('clickRouting').checked;$('clickHint').textContent='Haz clic en el nodo principal de origen y después en el destino.';};
for(const id of ['weightsMeters','weightsSteps'])$(id).onchange=()=>{render();if(result)playRoutes();};
$('stepLength').onchange=()=>{const value=Number($('stepLength').value);if(!Number.isFinite(value)||value<0.0001){$('stepLength').setCustomValidity('Introduce una longitud de al menos 0.0001 m.');$('stepLength').reportValidity();return;}$('stepLength').setCustomValidity('');stepLength=value;$('comparison').hidden=true;if(result){showResult(result);showRouteChoices();}else render();};
$('stepLength').oninput=()=>{ $('stepLength').setCustomValidity('');const value=Number($('stepLength').value);if(Number.isFinite(value)&&value>=0.0001)$('stepLength').onchange();};
resetSearches=['origin','destination'].map(id=>setupNodeSearch($(id)));
render();renderLibrary();document.title='Rutas PXM · Biblioteca';

for(const [buttonId,bodyId,panelId,name] of [
 ['toggleImagery','imageryBody','imageryControls','opciones del mapa'],
 ['toggleWeights','weightsBody','weightControls','pesos de las conexiones']
]){
 $(buttonId).onclick=()=>{
  const collapsed=!$(bodyId).hidden;
  $(bodyId).hidden=collapsed;
  $(panelId).classList.toggle('panel-collapsed',collapsed);
  $(buttonId).setAttribute('aria-expanded',String(!collapsed));
  const label=(collapsed?'Mostrar ':'Ocultar ')+name;
  $(buttonId).setAttribute('aria-label',label);$(buttonId).title=label;
  map.invalidateSize({pan:false});
 };
}
