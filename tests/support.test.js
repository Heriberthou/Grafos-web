import {test} from 'node:test';
import assert from 'node:assert/strict';
import {supportConnections,principalGraph,insertSupport,solve,validate,length} from '../dist/graph.js';

function fixture(){
 const nodes={};
 for(const [id,type,lat,lng] of [['A','principal',0,0],['B','principal',0,.003],['C','principal',.002,.002],['D','principal',.003,.002],['S','support',0,.001],['T','support',0,.002]])nodes[id]={id,name:id,type,coordinates:{lat,lng}};
 const edges={};
 for(const [id,a,b] of [['as','A','S'],['st','S','T'],['tb','T','B'],['tc','T','C'],['cd','C','D']]){
  const geometry=[nodes[a].coordinates,nodes[b].coordinates];edges[id]={id,source:a,target:b,geometry,weight:length(geometry)};
 }
 return {nodes,edges};
}
test('apoyo cuenta principales únicos a través de otros apoyos y se detiene en destinos',()=>{
 const g=fixture(), connections=supportConnections(g,'S');
 assert.deepEqual(new Set(connections.map(c=>c.target)),new Set(['A','B','C']));
 const b=connections.find(c=>c.target==='B');
 assert.deepEqual(b.edges,['st','tb']);assert.ok(Math.abs(b.weight-(g.edges.st.weight+g.edges.tb.weight))<1e-8);
});
test('grafo abstracto oculta apoyos, suma metros y no salta principales',()=>{
 const g=fixture(),r=principalGraph(g);
 assert.deepEqual(Object.keys(r.nodes),['A','B','C','D']);
 const edge=(a,b)=>Object.values(r.edges).find(e=>new Set([e.source,e.target]).has(a)&&new Set([e.source,e.target]).has(b));
 assert.ok(edge('A','B'));assert.ok(edge('A','C'));assert.ok(edge('B','C'));assert.ok(edge('C','D'));assert.equal(edge('A','D'),undefined);
 assert.equal(Object.keys(r.edges).length,4);
 assert.ok(Math.abs(edge('A','B').weight-solve(g,'A','B').distance)<1e-8);
 for(const a of Object.keys(r.nodes))for(const b of Object.keys(r.nodes)){
  assert.ok(Math.abs(solve(g,a,b).distance-solve(r,a,b).distance)<1e-8);
  assert.ok(Math.abs(solve(g,a,b).distance-solve(g,a,b,'A*').distance)<1e-8);
 }
});
test('ciclos entre apoyos no repiten nodos y alternativas conservan menor distancia',()=>{
 const g=fixture();g.nodes.U={id:'U',type:'support',name:'U',coordinates:{lat:.002,lng:.001}};
 for(const [id,a,b] of [['su','S','U'],['ut','U','T']]){const geometry=[g.nodes[a].coordinates,g.nodes[b].coordinates];g.edges[id]={id,source:a,target:b,geometry,weight:length(geometry)};}
 const c=supportConnections(g,'S');assert.equal(c.length,3);assert.deepEqual(c.find(c=>c.target==='B').edges,['st','tb']);
 for(const algo of ['Dijkstra','A*','BFS','DFS']){const r=solve(g,'A','B',algo);assert.equal(new Set(r.nodes).size,r.nodes.length);assert.equal(new Set(r.edges).size,r.edges.length);}
 const dfs=solve(g,'A','B','DFS'),abstract=principalGraph(g,dfs),active=Object.values(abstract.edges).filter(e=>e.active);
 assert.equal(active.length,1);assert.equal(active[0].weight,dfs.distance);assert.deepEqual(active[0].physicalEdges,dfs.edges);
});
test('insertar apoyo divide caminos coincidentes, conserva curvas y conecta cruces explícitos',()=>{
 const g={nodes:{},edges:{}};
 for(const [id,lat,lng] of [['A',0,0],['B',0,.002],['C',-.001,.001],['D',.001,.001]])g.nodes[id]={id,name:id,coordinates:{lat,lng}};
 for(const [id,a,b] of [['ab','A','B'],['cd','C','D']]){const geometry=[g.nodes[a].coordinates,g.nodes[b].coordinates];g.edges[id]={id,source:a,target:b,geometry,weight:length(geometry)};}
 assert.equal(solve(g,'A','C').found,false);
 const original=Object.values(g.edges).reduce((s,e)=>s+e.weight,0);let i=0;
 const {node,splitCount}=insertSupport(g,{lat:0,lng:.001},'Cruce',()=>`new${i++}`);
 assert.equal(splitCount,2);assert.equal(node.type,'support');assert.equal(Object.keys(g.edges).length,4);
 assert.ok(Math.abs(Object.values(g.edges).reduce((s,e)=>s+e.weight,0)-original)<1e-6);
 assert.equal(supportConnections(g,node.id).length,4);assert.equal(solve(g,'A','C').found,true);
 assert.throws(()=>insertSupport(g,node.coordinates,'Duplicado'));
});
test('subdividir polilínea conserva vértices y distancia total',()=>{
 const g=fixture();const e=g.edges.as;e.geometry.splice(1,0,{lat:.001,lng:.0005});e.weight=length(e.geometry);const before=e.weight;let i=0;
 const {node}=insertSupport(g,{lat:.001,lng:.0005},'Curva',()=>`curve${i++}`);
 const parts=Object.values(g.edges).filter(e=>e.source===node.id||e.target===node.id);
 assert.equal(parts.length,2);assert.ok(Math.abs(parts.reduce((s,e)=>s+e.weight,0)-before)<1e-8);
});
test('tipos persisten en JSON y documentos anteriores siguen siendo principales',()=>{
 const g=fixture();delete g.nodes.A.type;const restored=validate(JSON.parse(JSON.stringify(g)));
 assert.equal(restored.nodes.A.type,'principal');assert.equal(restored.nodes.S.type,'support');
 g.nodes.A.type='invalid';assert.throws(()=>validate(g));
});
test('componentes solo de apoyos y apoyos aislados no inventan conexiones',()=>{
 const g=fixture();delete g.edges.as;delete g.edges.tb;delete g.edges.tc;
 assert.deepEqual(supportConnections(g,'S'),[]);assert.equal(Object.keys(principalGraph(g).edges).length,1);
});
