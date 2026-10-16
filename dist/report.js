import {solveTwo,isSupport,supportConnections,principalGraph,length} from './graph.js';
import {geographicPreview} from './comparison.js';
const fmt=n=>Number(n).toFixed(1),steps=(n,stride)=>'≈ '+Math.round(n/stride).toLocaleString('es-MX')+' pasos';
export function reportModel({graph,project,origin,destination,stride=0.6521,author='',notes='',includeGeometry=true,imagery='',date=new Date().toISOString()}){
 const nodes=Object.values(graph.nodes),edges=Object.values(graph.edges),aliases={};let n=0,a=0;
 for(const node of nodes)aliases[node.id]=(isSupport(node)?'A'+String(++a).padStart(2,'0'):'N'+String(++n).padStart(2,'0'));
 const label=id=>aliases[id]+' '+graph.nodes[id].name;
 const blocks=[],text=t=>blocks.push({type:'text',text:t}),heading=t=>blocks.push({type:'heading',text:t}),table=(headers,rows,widths)=>blocks.push({type:'table',headers,rows,widths}),figure=(title,route)=>blocks.push({type:'figure',title,svg:geographicPreview(graph,route)});
 blocks.push({type:'title',text:'Reporte completo del grafo'});text(project.name);text('Generado el '+new Date(date).toLocaleString('es-MX')+(author.trim()?' · Elaborado por '+author.trim():''));
 text('Registro del proyecto y sus conexiones, con distancias geodésicas, pasos aproximados y análisis de rutas. Los pasos se estiman con una longitud de '+stride+' m; no son mediciones presenciales. Todas las conexiones son bidireccionales.');
 heading('Resumen del proyecto');
 const adjacency=Object.fromEntries(nodes.map(node=>[node.id,[]]));for(const e of edges){adjacency[e.source].push(e);adjacency[e.target].push(e);}
 const seen=new Set();let components=0;for(const node of nodes){if(seen.has(node.id))continue;components++;const queue=[node.id];seen.add(node.id);while(queue.length){const id=queue.pop();for(const e of adjacency[id]){const other=e.source===id?e.target:e.source;if(!seen.has(other)){seen.add(other);queue.push(other);}}}}
 table(['Dato','Valor'],[['Proyecto',project.name],['Identificador del proyecto',project.id??'Sin identificador'],['Creación',project.createdAt??'No registrada'],['Último guardado',project.updatedAt??'No registrado'],['Nodos principales',n],['Nodos de apoyo',a],['Caminos físicos',edges.length],['Longitud de la red',fmt(edges.reduce((s,e)=>s+e.weight,0))+' m'],['Componentes conectados',components],['Nodos aislados',nodes.filter(node=>!adjacency[node.id].length).length],['Fondo y versión del mapa',imagery||'No registrado']],[.29,.71]);
 if(notes.trim()){heading('Observaciones del reporte');text(notes.trim());}
 heading('Vista geográfica del grafo');text('La figura conserva las posiciones y curvas trazadas en el mapa. Círculos: destinos principales. Cuadrados: apoyos. No incluye la fotografía satelital. Los identificadores N y A se asignan para este reporte; el anexo conserva los identificadores originales.');
 if(nodes.length)figure('Distribución geográfica de la red',{found:false,nodes:[],edges:[],visited:[]});else text('El proyecto no contiene nodos.');
 heading('Registro de nodos y adyacencias');
 const inventory=[];for(const node of nodes){const incident=adjacency[node.id];for(const e of incident.length?incident:[null])inventory.push([aliases[node.id],node.name+(isSupport(node)?' (apoyo)':''),node.coordinates.lat.toFixed(7)+', '+node.coordinates.lng.toFixed(7),e?label(e.source===node.id?e.target:e.source):'Sin conexión',e?fmt(e.weight)+' m / '+steps(e.weight,stride):'No aplica',e?'Bidireccional':'No aplica',node.observations??'Sin observaciones registradas']);}
 text('Coordenadas WGS84 en grados decimales, en orden latitud y longitud. Cada fila corresponde a una adyacencia; una conexión aparece en los registros de ambos extremos.');
 table(['Identificador','Nombre o referencia','Coordenadas','Nodo adyacente','Distancia','Sentido','Observaciones'],inventory,[.07,.17,.17,.18,.15,.11,.15]);
 heading('Caminos físicos');
 table(['Camino','Origen','Destino','Metros','Pasos aproximados','Vértices intermedios'],edges.map((e,i)=>['C'+String(i+1).padStart(2,'0'),label(e.source),label(e.target),fmt(e.weight),steps(e.weight,stride),Math.max(0,e.geometry.length-2)]),[.08,.25,.25,.1,.19,.13]);
 heading('Conexiones de los apoyos');text('Para cada apoyo se indica la distancia mínima a los principales alcanzables pasando únicamente por otros apoyos hasta llegar a cada principal.');
 for(const node of nodes.filter(isSupport)){const connections=supportConnections(graph,node.id);text(label(node.id)+' · '+connections.length+' principales conectados.');if(connections.length)table(['Principal','Metros','Pasos aproximados','Cadena de conexión'],connections.map(c=>[label(c.target),fmt(c.weight),steps(c.weight,stride),c.nodes.map(label).join(' → ')]),[.25,.1,.18,.47]);}
 if(!a)text('No hay nodos de apoyo registrados.');
 heading('Conexiones del grafo abstracto');const reduced=principalGraph(graph);table(['Origen principal','Destino principal','Metros','Pasos aproximados','Apoyos intermedios'],Object.values(reduced.edges).map(e=>[label(e.source),label(e.target),fmt(e.weight),steps(e.weight,stride),e.via.map(label).join(' → ')||'Ninguno']),[.23,.23,.1,.17,.27]);
 heading('Comparación de rutas');
 const canRoute=graph.nodes[origin]&&graph.nodes[destination]&&!isSupport(graph.nodes[origin])&&!isSupport(graph.nodes[destination]);
 const comparisons=canRoute?['Dijkstra','A*','BFS','DFS'].map(algorithm=>solveTwo(graph,origin,destination,algorithm)):[];
 if(!canRoute)text('No hay un par válido de nodos principales seleccionado. Selecciona origen y destino en la aplicación para incluir el análisis de rutas.');
 else{
 text('Origen: '+label(origin)+'. Destino: '+label(destination)+'.');text('Dijkstra y A* minimizan metros. BFS minimiza tramos; DFS sigue el orden de exploración. BFS y DFS no garantizan la menor distancia. Las alternativas no repiten nodos y pueden compartir caminos. Los tiempos son de esta exportación y excluyen el dibujo y la preparación del reporte.');
 const best=comparisons[0][0];table(['Algoritmo','Ruta','Metros','Pasos','Tramos','Explorados','Tiempo ms','Distancia mínima'],comparisons.flatMap(rs=>rs.map((r,i)=>[r.algorithm,i+1,r.found?fmt(r.distance):'Sin ruta',r.found?steps(r.distance,stride):'No aplica',r.edges.length,r.visited.length,r.time.toFixed(3),r.found&&best.found&&Math.abs(r.distance-best.distance)<1e-6?'Sí':'No'])),[.14,.06,.12,.18,.09,.12,.13,.16]);
 for(const rs of comparisons){heading('Recorridos con '+rs[0].algorithm);if(!rs[0].found){text('No existe una ruta entre los nodos seleccionados.');continue;}if(rs.length===1)text('No existe una segunda ruta sin repetir nodos.');for(const [i,r] of rs.entries()){text('Ruta '+(i+1)+' · '+fmt(r.distance)+' m · '+steps(r.distance,stride));figure(r.algorithm+' · Ruta '+(i+1),r);text('Recorrido completo: '+r.nodes.map(label).join(' → '));text('Orden de exploración: '+r.visited.map(label).join(' → '));}}
 }
 heading('Identificadores y posiciones del proyecto');table(['Código','Identificador original','Nombre','Posición en el grafo abstracto'],nodes.map(node=>[aliases[node.id],node.id,node.name,node.ui_position?node.ui_position.x.toFixed(2)+', '+node.ui_position.y.toFixed(2):'Automática']),[.08,.38,.29,.25]);
 table(['Camino','Identificador original'],edges.map((e,i)=>['C'+String(i+1).padStart(2,'0'),e.id]),[.15,.85]);
 if(includeGeometry){heading('Geometría completa de los caminos');text('Vértices en orden de origen a destino. El primero y el último corresponden a los nodos extremos; los demás describen las curvas.');table(['Camino','Vértice','Latitud','Longitud'],edges.flatMap((e,i)=>e.geometry.map((p,j)=>['C'+String(i+1).padStart(2,'0'),j+1,p.lat.toFixed(8),p.lng.toFixed(8)])),[.16,.14,.35,.35]);}
 return {title:'Reporte de '+project.name,blocks,date,comparisons};
}
const libraryPromises={};
function loadLibrary(name){if(libraryPromises[name])return libraryPromises[name];libraryPromises[name]=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('./vendor/'+name+'.js',import.meta.url);script.onload=resolve;script.onerror=()=>{delete libraryPromises[name];script.remove();reject(Error('No se pudo cargar el generador de '+name+'. Intenta de nuevo.'));};document.head.append(script);});return libraryPromises[name];}
async function raster(svg){return new Promise((resolve,reject)=>{const image=new Image(),url=URL.createObjectURL(new Blob([svg.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ')],{type:'image/svg+xml'}));image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=720;canvas.getContext('2d').drawImage(image,0,0,1200,720);URL.revokeObjectURL(url);resolve(canvas);};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('No se pudo generar la figura del grafo.'));};image.src=url;});}
function bytes(canvas){return Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0));}
export async function makeWord(model){
 await loadLibrary('docx');const d=window.docx,children=[];
 const paragraph=(text,options={})=>new d.Paragraph({children:[new d.TextRun({text:String(text),font:'Calibri',size:20})],spacing:{after:140},...options});
 for(const [blockIndex,b] of model.blocks.entries()){
 if(b.type==='title'||b.type==='heading')children.push(new d.Paragraph({text:b.text,heading:b.type==='title'?d.HeadingLevel.TITLE:d.HeadingLevel.HEADING_1,spacing:{before:b.type==='title'?0:260,after:160},keepNext:true}));
 else if(b.type==='text')children.push(paragraph(b.text,{keepNext:model.blocks[blockIndex+1]?.type==='figure'}));
 else if(b.type==='figure'){const canvas=await raster(b.svg);children.push(paragraph(b.title,{keepNext:true}));children.push(new d.Paragraph({children:[new d.ImageRun({type:'png',data:bytes(canvas),transformation:{width:360,height:216}})],spacing:{after:200}}));}
 else if(b.type==='table'){
 if(!b.rows.length){children.push(paragraph('Sin registros.'));continue;}
 const widths=b.widths.map(w=>Math.round(w*14040));
 const rows=[b.headers,...b.rows].map((cells,i)=>new d.TableRow({tableHeader:i===0,cantSplit:true,children:cells.map((cell,j)=>new d.TableCell({width:{size:widths[j],type:d.WidthType.DXA},verticalAlign:d.VerticalAlign.CENTER,shading:{fill:i===0?'E8EEEA':i%2?'FFFFFF':'F7F9F6'},children:[new d.Paragraph({children:[new d.TextRun({text:String(cell),font:'Calibri',size:18,bold:i===0})],spacing:{after:60,before:60}})]}))}));
 const border={style:d.BorderStyle.SINGLE,size:4,color:'D9D9D9'};
 children.push(new d.Table({rows,width:{size:14040,type:d.WidthType.DXA},columnWidths:widths,layout:d.TableLayoutType.FIXED,margins:{top:70,bottom:70,left:100,right:100},borders:{top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border}}));children.push(new d.Paragraph({children:[new d.TextRun({text:'',size:2})],spacing:{before:0,after:0,line:20}}));
 }
 }
 const doc=new d.Document({title:model.title,creator:'Rutas PXM',styles:{default:{document:{run:{font:'Calibri',size:20,color:'000000'}}},paragraphStyles:[{id:'Title',name:'Title',basedOn:'Normal',run:{font:'Calibri',size:36,bold:true,color:'000000'},paragraph:{spacing:{after:200}}},{id:'Heading1',name:'Heading 1',basedOn:'Normal',run:{font:'Calibri',size:26,bold:true,color:'000000'},paragraph:{keepNext:true}}]},sections:[{properties:{page:{size:{width:12240,height:15840,orientation:d.PageOrientation.LANDSCAPE},margin:{top:900,bottom:900,left:900,right:900}}},footers:{default:new d.Footer({children:[new d.Paragraph({alignment:d.AlignmentType.RIGHT,children:[new d.TextRun({children:['Rutas PXM · Página ',d.PageNumber.CURRENT],size:16})]})]})},children}]});
 return d.Packer.toBlob(doc);
}
export async function makePDF(model){
 await loadLibrary('pdf-lib');const pdf=await window.PDFLib.PDFDocument.create();pdf.setTitle(model.title);pdf.setProducer('Rutas PXM');
 // Rasterized at 2x for consistent Unicode and identical wrapping across browsers.
 const W=792,H=612,M=36,usable=W-2*M,bottom=H-42;let canvas,ctx,y=0,pageCount=0;
 async function finish(){if(!canvas)return;ctx.font='8px Arial';ctx.fillStyle='#71826f';ctx.fillText('Rutas PXM · Página '+pageCount,M,H-20);const image=await pdf.embedPng(bytes(canvas)),page=pdf.addPage([W,H]);page.drawImage(image,{x:0,y:0,width:W,height:H});}
 async function page(){await finish();canvas=document.createElement('canvas');canvas.width=W*2;canvas.height=H*2;ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.fillStyle='white';ctx.fillRect(0,0,W,H);y=M;pageCount++;}
 function wrap(value,width,size=9,bold=false){ctx.font=(bold?'bold ':'')+size+'px Arial';const lines=[];for(const part of String(value).split('\n')){let line='';for(const char of part){if(ctx.measureText(line+char).width>width&&line){lines.push(line);line='';}line+=char;}lines.push(line);}return lines;}
 async function paragraph(value,size=10,bold=false){const lines=wrap(value,usable,size,bold),lh=size*1.4;for(const line of lines){if(y+lh>bottom)await page();ctx.font=(bold?'bold ':'')+size+'px Arial';ctx.fillStyle='#17251d';ctx.fillText(line,M,y+size);y+=lh;}y+=8;}
 await page();for(const [blockIndex,b] of model.blocks.entries()){
 if(b.type==='title'||b.type==='heading'){if(y+(model.blocks.slice(blockIndex+1,blockIndex+3).some(b=>b.type==='figure')?270:65)>bottom)await page();y+=b.type==='heading'?12:0;await paragraph(b.text,b.type==='title'?22:14,true);}
 else if(b.type==='text'){if(model.blocks[blockIndex+1]?.type==='figure'&&y+250>bottom)await page();await paragraph(b.text);}
 else if(b.type==='figure'){if(y+210>bottom)await page();await paragraph(b.title,10,true);const figure=await raster(b.svg);ctx.drawImage(figure,M,y,300,180);y+=192;}
 else if(b.type==='table'){
 if(!b.rows.length){await paragraph('Sin registros.');continue;}
 const widths=b.widths.map(w=>w*usable),size=8.5,lh=12;
 const linesFor=cells=>cells.map((v,j)=>wrap(v,widths[j]-12,size));
 async function row(cells,header=false){let lines=linesFor(cells),remaining=Math.max(...lines.map(l=>l.length)),offset=0;
 while(remaining>0){if(y+lh+12>bottom){await page();if(!header)await row(b.headers,true);}
 const count=Math.min(remaining,Math.floor((bottom-y-12)/lh)),height=count*lh+12;
 let x=M;for(let j=0;j<cells.length;j++){ctx.fillStyle=header?'#e8eeea':'#ffffff';ctx.fillRect(x,y,widths[j],height);ctx.strokeStyle='#d9d9d9';ctx.lineWidth=.5;ctx.strokeRect(x,y,widths[j],height);ctx.fillStyle='#17251d';ctx.font=(header?'bold ':'')+size+'px Arial';lines[j].slice(offset,offset+count).forEach((line,k)=>ctx.fillText(line,x+6,y+6+size+k*lh));x+=widths[j];}y+=height;remaining-=count;offset+=count;
 }
 }
 const headerHeight=Math.max(...linesFor(b.headers).map(l=>l.length))*lh+12;
 if(y+headerHeight+30>bottom)await page();await row(b.headers,true);
 for(const cells of b.rows){const height=Math.max(...linesFor(cells).map(l=>l.length))*lh+12;if(y+height>bottom&&height<bottom-M-headerHeight){await page();await row(b.headers,true);}await row(cells);}
 y+=16;
 }
 }
 await finish();return new Blob([await pdf.save()],{type:'application/pdf'});
}
export async function downloadReport(input,format){const model=reportModel(input),blob=format==='docx'?await makeWord(model):await makePDF(model);const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(input.project.name.replace(/[^a-zA-Z0-9áéíóúñ_-]/gi,'-')||'Rutas-PXM')+'-reporte.'+format;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);return model;}
