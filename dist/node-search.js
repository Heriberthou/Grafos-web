export const normalizeName=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim().replace(/\s+/g,' ');
function editDistance(a,b){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}return row[b.length];}
export function searchNodes(nodes,query){
 const q=normalizeName(query);if(!q)return nodes;
 const tokens=q.split(' ');
 return nodes.map(node=>{const name=normalizeName(node.name);let score;
 if(name===q)score=0;else if(name.startsWith(q))score=1;else if(name.includes(q))score=2;
 else{const words=name.split(' ');let cost=0;for(const token of tokens){const best=Math.min(...words.map(word=>word.startsWith(token)?0:editDistance(token,word)));if(best>(token.length<3?0:token.length<6?1:2))return null;cost+=best;}score=3+cost;}
 return {node,score};}).filter(Boolean).sort((a,b)=>a.score-b.score||a.node.name.localeCompare(b.node.name,'es')).map(x=>x.node);
}
export function setupNodeSearch(select){
 const container=document.createElement('div');container.className='node-search node-combobox';
 const input=document.createElement('input');input.id=select.id+'Input';input.type='text';input.maxLength=80;input.autocomplete='off';input.placeholder='Selecciona o escribe un nombre…';input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');
 document.querySelector(`label[for="${select.id}"]`).htmlFor=input.id;
 const toggle=document.createElement('button');toggle.type='button';toggle.className='node-dropdown';toggle.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>';toggle.setAttribute('aria-label',select.id==='origin'?'Mostrar lista de origen':'Mostrar lista de destino');toggle.tabIndex=-1;
 const list=document.createElement('div');list.id=select.id+'Suggestions';list.className='node-suggestions';list.setAttribute('role','listbox');list.setAttribute('aria-label','Nodos principales');list.hidden=true;input.setAttribute('aria-controls',list.id);
 const status=document.createElement('small');status.className='sr-only';status.setAttribute('role','status');
 container.append(input,toggle,list,status);select.before(container);select.hidden=true;
 let matches=[],active=-1,typing=false;
 const selectedName=()=>select.options[select.selectedIndex]?.textContent??'';
 const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
 const sync=()=>{input.value=selectedName();typing=false;status.textContent='';input.disabled=toggle.disabled=select.options.length===0;close();};
 const choose=index=>{if(!matches[index])return;select.value=matches[index].id;sync();select.dispatchEvent(new Event('change',{bubbles:true}));input.focus();};
 const highlight=()=>{Array.from(list.querySelectorAll('[role=option]')).forEach((el,i)=>el.setAttribute('aria-selected',String(i===active)));if(active>=0){input.setAttribute('aria-activedescendant',list.children[active].id);list.children[active].scrollIntoView({block:'nearest'});}};
 const open=(all=false)=>{
 const nodes=Array.from(select.options).map(o=>({id:o.value,name:o.textContent}));matches=searchNodes(nodes,all?'':input.value);list.replaceChildren();active=-1;input.removeAttribute('aria-activedescendant');
 for(const [i,node] of matches.entries()){const option=document.createElement('div');option.id=list.id+'-'+i;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.textContent=node.name;option.onmousedown=e=>e.preventDefault();option.onclick=()=>choose(i);list.append(option);}
 if(!matches.length){const empty=document.createElement('div');empty.className='no-node-results';empty.textContent='Sin coincidencias. Prueba otro nombre.';list.append(empty);}
 list.hidden=false;input.setAttribute('aria-expanded','true');status.textContent=matches.length+' resultados disponibles.';
 };
 input.oninput=()=>{typing=true;open();};
 input.onclick=()=>{if(list.hidden)open(!typing);};
 input.onfocus=()=>input.select();
 toggle.onmousedown=e=>e.preventDefault();toggle.onclick=()=>{input.focus();if(list.hidden)open(true);else close();};
 input.onkeydown=e=>{
 if(e.key==='Escape'){sync();e.stopPropagation();return;}
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(list.hidden)open(!typing);if(matches.length){active=active<0?(e.key==='ArrowDown'?0:matches.length-1):(active+(e.key==='ArrowDown'?1:-1)+matches.length)%matches.length;highlight();}}
 else if(e.key==='Enter'){e.preventDefault();if(!list.hidden&&matches.length)choose(active>=0?active:0);}
 };
 container.addEventListener('focusout',e=>{if(!container.contains(e.relatedTarget))sync();});
 return sync;
}
