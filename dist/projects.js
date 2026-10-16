import {validate} from './graph.js';
export const libraryKey='rutas-pxm-projects-v1';
export const legacyKey='umar-atlas-v1';
export const emptyGraph=()=>({nodes:{},edges:{},demo:false});
const copy=value=>JSON.parse(JSON.stringify(value));
function nameOf(name){if(typeof name!=='string'||!name.trim()||name.trim().length>80)throw Error('Escribe un nombre de entre 1 y 80 caracteres.');return name.trim();}

export class ProjectStore {
 constructor(storage){this.storage=storage;}
 read(){
  const raw=this.storage.getItem(libraryKey);
  if(raw===null)return {version:1,projects:[]};
  let data;try{data=JSON.parse(raw);}catch{throw Error('La biblioteca guardada no se puede leer. Sus datos originales se conservaron.');}
  if(data.version!==1||!Array.isArray(data.projects)||new Set(data.projects.map(p=>p.id)).size!==data.projects.length)throw Error('Formato de biblioteca inválido. Sus datos originales se conservaron.');
  return data;
 }
 write(data){this.storage.setItem(libraryKey,JSON.stringify(data));}
 initialize(){
  if(this.storage.getItem(libraryKey)!==null){this.read();return false;}
  const raw=this.storage.getItem(legacyKey),data={version:1,projects:[]};
  if(raw){
   let graph;try{graph=validate(JSON.parse(raw));}catch{throw Error('El grafo anterior no se puede recuperar. Conservamos su guardado original.');}
   if(Object.keys(graph.nodes).length){const now=new Date().toISOString();data.projects.push({id:crypto.randomUUID(),name:'Grafo recuperado',createdAt:now,updatedAt:now,graph});}
  }
  this.write(data);return data.projects.length>0;
 }
 list(archived=false){return this.read().projects.filter(p=>Boolean(p.archivedAt)===archived).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
 get(id){const p=this.read().projects.find(p=>p.id===id&&!p.archivedAt);if(!p)throw Error('Este proyecto ya no está disponible. Vuelve a la biblioteca.');return {...p,graph:validate(p.graph)};}
 create(name,graph=emptyGraph()){
  const data=this.read(),now=new Date().toISOString();
  const project={id:crypto.randomUUID(),name:nameOf(name),createdAt:now,updatedAt:now,graph:validate(copy(graph))};
  data.projects.push(project);this.write(data);return project;
 }
 update(id,change,expectedRevision){
  const data=this.read(),p=data.projects.find(p=>p.id===id&&!p.archivedAt);
  if(!p)throw Error('El proyecto se eliminó o ya no está disponible. Exporta tu grafo antes de continuar.');
  if(expectedRevision!==undefined&&expectedRevision!==(p.revision??0))throw Error('Este proyecto cambió en otra pestaña. Exporta tus cambios antes de recargar para evitar sobrescribirlos.');
  change(p);p.revision=(p.revision??0)+1;p.updatedAt=new Date().toISOString();this.write(data);return copy(p);
 }
 saveGraph(id,graph,expectedRevision){return this.update(id,p=>{p.graph=validate(copy(graph));},expectedRevision);}
 rename(id,name){return this.update(id,p=>{p.name=nameOf(name);});}
 duplicate(id){const p=this.get(id);return this.create((p.name+' · copia').slice(0,80),p.graph);}
 archive(id){return this.update(id,p=>{p.archivedAt=new Date().toISOString();});}
 restore(id){const data=this.read(),p=data.projects.find(p=>p.id===id&&p.archivedAt);if(!p)throw Error('No se encontró el proyecto en la papelera.');delete p.archivedAt;p.updatedAt=new Date().toISOString();this.write(data);}
}
