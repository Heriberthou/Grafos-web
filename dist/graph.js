export function distance(a,b){const r=Math.PI/180,dl=(b.lat-a.lat)*r,dg=(b.lng-a.lng)*r;const h=Math.sin(dl/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dg/2)**2;return 6371008.8*2*Math.asin(Math.sqrt(Math.min(1,h)));}
export function length(points){return points.slice(1).reduce((s,p,i)=>s+distance(points[i],p),0);}
export const isSupport = node => node.type === 'support';

// Stop at principal nodes: a connection must not silently pass through another destination.
export function supportConnections(graph, start) {
 const adjacency = Object.fromEntries(Object.keys(graph.nodes).map(id => [id, []]));
 for (const e of Object.values(graph.edges)) {
  adjacency[e.source].push({id:e.target, edge:e});
  adjacency[e.target].push({id:e.source, edge:e});
 }
 if (!adjacency[start]) return [];
 const costs = {[start]:0}, previous = {}, settled = new Set(), queue = [start], connections = [];
 while (queue.length) {
  queue.sort((a,b) => costs[a]-costs[b]);
  const current = queue.shift();
  if (settled.has(current)) continue;
  settled.add(current);
  if (current !== start && !isSupport(graph.nodes[current])) {
   const nodes = [current], edges = []; let cursor = current;
   while (cursor !== start) { edges.push(previous[cursor].edge); cursor = previous[cursor].node; nodes.push(cursor); }
   connections.push({target:current, weight:costs[current], nodes:nodes.reverse(), edges:edges.reverse()});
   continue;
  }
  for (const {id,edge} of adjacency[current]) {
   const next = costs[current] + edge.weight;
   if (settled.has(id) || next >= (costs[id] ?? Infinity)) continue;
   costs[id] = next; previous[id] = {node:current,edge:edge.id}; queue.push(id);
  }
 }
 return connections;
}

export function principalGraph(graph, route = null) {
 const nodes = Object.fromEntries(Object.entries(graph.nodes).filter(([,n]) => !isSupport(n)));
 const edges = {};
 const pairId = (a,b) => JSON.stringify([a,b].sort());
 for (const id of Object.keys(nodes)) {
  for (const c of supportConnections(graph,id)) {
   const key = pairId(id,c.target);
   if (!edges[key] || c.weight < edges[key].weight) edges[key] = {id:key,source:id,target:c.target,weight:c.weight,physicalEdges:c.edges,via:c.nodes.slice(1,-1)};
  }
 }
 // BFS/DFS may use a longer physical alternative. Display its actual cost when highlighted.
 if (route?.found) {
  let start = 0;
  for (let i = 1; i < route.nodes.length; i++) {
   if (!nodes[route.nodes[i]]) continue;
   const a = route.nodes[start], b = route.nodes[i], key = pairId(a,b);
   const physicalEdges = route.edges.slice(start,i);
   edges[key] = {id:key,source:a,target:b,weight:physicalEdges.reduce((sum,id)=>sum+graph.edges[id].weight,0),physicalEdges,via:route.nodes.slice(start+1,i),active:true};
   start = i;
  }
 }
 return {nodes,edges};
}

// Project onto each polyline segment locally; weights still use geodesic distance.
export function nearestPoint(geometry, point) {
 let best = null;
 const cos = Math.cos(point.lat*Math.PI/180);
 for (let i=0;i<geometry.length-1;i++) {
  const a=geometry[i],b=geometry[i+1],x=(b.lng-a.lng)*cos,y=b.lat-a.lat;
  const t=Math.max(0,Math.min(1,((point.lng-a.lng)*cos*x+(point.lat-a.lat)*y)/(x*x+y*y||1)));
  const coordinates={lat:a.lat+t*(b.lat-a.lat),lng:a.lng+t*(b.lng-a.lng)};
  const gap=distance(point,coordinates);
  if(!best||gap<best.gap)best={coordinates,gap,index:i};
 }
 return best;
}

export function insertSupport(graph, coordinates, name, idFactory = () => crypto.randomUUID(), snapMeters = 1) {
 let snapped = coordinates, nearest = null;
 for (const edge of Object.values(graph.edges)) {
  const p=nearestPoint(edge.geometry,coordinates);
  if(p && p.gap<=snapMeters && (!nearest||p.gap<nearest.gap))nearest=p;
 }
 if(nearest)snapped=nearest.coordinates;
 const existing=Object.values(graph.nodes).find(n=>distance(n.coordinates,snapped)<0.1);
 if(existing)throw Error('Ya existe un nodo en este punto. Conecta el camino a ese nodo o cambia su tipo.');
 const id=idFactory(), node={id,name,type:'support',coordinates:{...snapped}};
 const splits=[];
 for (const edge of Object.values(graph.edges)) {
  const p=nearestPoint(edge.geometry,snapped);
  if(!p||p.gap>snapMeters||distance(edge.geometry[0],snapped)<0.1||distance(edge.geometry.at(-1),snapped)<0.1)continue;
  splits.push({edge,p});
 }
 graph.nodes[id]=node;
 for(const {edge,p} of splits) {
  const left=[...edge.geometry.slice(0,p.index+1),{...snapped}];
  const right=[{...snapped},...edge.geometry.slice(p.index+1)];
  delete graph.edges[edge.id];
  for(const [source,target,geometry] of [[edge.source,id,left],[id,edge.target,right]]) {
   const edgeId=idFactory();graph.edges[edgeId]={id:edgeId,source,target,geometry,weight:length(geometry)};
  }
 }
 return {node,splitCount:splits.length};
}
export function solve(graph,start,end,algorithm='Dijkstra'){
 const t=performance.now(),adj=Object.fromEntries(Object.keys(graph.nodes).map(id=>[id,[]]));
 for(const e of Object.values(graph.edges)){adj[e.source].push({id:e.target,e});adj[e.target].push({id:e.source,e});}
 if(!adj[start]||!adj[end])throw Error('Selecciona un origen y un destino válidos.');
 const frontier=[start],seen=new Set(),discovered=new Set([start]),cost={[start]:0},prev={},visited=[];
 const h=id=>algorithm==='A*'?distance(graph.nodes[id].coordinates,graph.nodes[end].coordinates):0;
 while(frontier.length){if(algorithm==='Dijkstra'||algorithm==='A*')frontier.sort((a,b)=>(cost[a]+h(a))-(cost[b]+h(b)));const u=algorithm==='DFS'?frontier.pop():frontier.shift();if(seen.has(u))continue;seen.add(u);visited.push(u);if(u===end)break;
 for(const {id:v,e} of adj[u]){if(seen.has(v))continue;const c=cost[u]+e.weight;if(algorithm==='BFS'||algorithm==='DFS'){if(discovered.has(v))continue;discovered.add(v);}else if(c>=(cost[v]??Infinity))continue;cost[v]=c;prev[v]={node:u,edge:e.id};frontier.push(v);}}
 const found=seen.has(end),nodes=[],edges=[];if(found){let u=end;nodes.push(u);while(u!==start){edges.push(prev[u].edge);u=prev[u].node;nodes.push(u);}nodes.reverse();edges.reverse();}
 return {algorithm,found,nodes,edges,visited,distance:found?cost[end]:null,time:performance.now()-t};
}
export function validate(input){
 if(!input||typeof input.nodes!=='object'||!input.nodes||Array.isArray(input.nodes)||typeof input.edges!=='object'||!input.edges||Array.isArray(input.edges))throw Error('El JSON debe contener objetos nodes y edges.');
 if(Object.keys(input.nodes).length>2000||Object.keys(input.edges).length>10000)throw Error('Máximo 2,000 nodos y 10,000 caminos.');
 const nodes=Object.create(null),edges=Object.create(null);const point=p=>{if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||Math.abs(p.lat)>90||Math.abs(p.lng)>180)throw Error('Coordenadas inválidas.');return {lat:p.lat,lng:p.lng};};
 for(const [id,n] of Object.entries(input.nodes)){if(!n||n.id!==id||!id||['__proto__','constructor','prototype'].includes(id)||typeof n.name!=='string'||!n.name.trim()||n.name.length>80)throw Error('Nodo inválido: revisa id y nombre.');if(n.type!==undefined&&!['principal','support'].includes(n.type))throw Error('Tipo de nodo inválido.');nodes[id]={id,name:n.name.trim(),type:n.type??'principal',coordinates:point(n.coordinates)};if(n.ui_position&&Number.isFinite(n.ui_position.x)&&Number.isFinite(n.ui_position.y))nodes[id].ui_position={x:n.ui_position.x,y:n.ui_position.y};}
 for(const [id,e] of Object.entries(input.edges)){if(!e||e.id!==id||!id||['__proto__','constructor','prototype'].includes(id)||!nodes[e.source]||!nodes[e.target]||e.source===e.target||!Array.isArray(e.geometry)||e.geometry.length<2||e.geometry.length>10000)throw Error('Camino inválido: revisa extremos y geometría.');const geometry=e.geometry.map(point);geometry[0]={...nodes[e.source].coordinates};geometry[geometry.length-1]={...nodes[e.target].coordinates};edges[id]={id,source:e.source,target:e.target,geometry,weight:length(geometry)};}
 return {nodes,edges,demo:input.demo===true};
}
export function demoGraph(){const nodes={},edges={};const data=[['Acceso principal',15.86015,-97.0665],['Rectoría',15.8612,-97.0654],['Biblioteca Central',15.862,-97.066],['Edificio A',15.86265,-97.0671],['Laboratorios',15.8617,-97.0678],['Cafetería',15.8608,-97.0672],['Jardín central',15.8613,-97.0664],['Auditorio',15.8625,-97.0652]];data.forEach(([name,lat,lng],i)=>nodes['n'+i]={id:'n'+i,name,coordinates:{lat:lat+(15.8903472222-15.8614),lng:lng+(-97.0754277778-(-97.0664))}});[[0,5],[0,1],[5,4],[5,6],[6,1],[6,2],[4,3],[3,2],[2,7],[1,7],[4,6]].forEach(([a,b],i)=>{const p=nodes['n'+a].coordinates,q=nodes['n'+b].coordinates;const geometry=[p,{lat:(p.lat+q.lat)/2+.00006,lng:(p.lng+q.lng)/2-.00007},q];edges['e'+i]={id:'e'+i,source:'n'+a,target:'n'+b,geometry,weight:length(geometry)};});return {nodes,edges,demo:true};}

// Every distinct simple path omits at least one edge of the first simple path.
export function solveTwo(graph,start,end,algorithm='Dijkstra'){
 const first=solve(graph,start,end,algorithm);
 if(!first.found||!first.edges.length)return [first];
 const candidates=[];
 for(const excluded of first.edges){
  const edges=Object.fromEntries(Object.entries(graph.edges).filter(([id])=>id!==excluded));
  const candidate=solve({...graph,edges},start,end,algorithm);
  if(candidate.found)candidates.push(candidate);
 }
 candidates.sort((a,b)=>algorithm==='BFS'?a.edges.length-b.edges.length||a.distance-b.distance:a.distance-b.distance);
 return candidates.length?[first,candidates[0]]:[first];
}
export function routeGeometry(graph,route){
 return route.edges.flatMap((id,i)=>{
  const edge=graph.edges[id],points=edge.source===route.nodes[i]?edge.geometry:[...edge.geometry].reverse();
  return i?points.slice(1):points;
 });
}
