# Rutas PXM

Aplicación 100 % cliente: Leaflet 1.9.4, Turf 7.2.0 y vis-network 9.1.9. Bibliotecas, fuentes y teselas requieren conexión a Internet. La biblioteca y sus proyectos permanecen en localStorage del navegador; exporta JSON para compartir o respaldar.

## Inicio

Ejecuta `npm start` y abre http://127.0.0.1:4173. Ejecuta `npm test` para verificar el motor del grafo.

## Uso

- En Calcular ruta, selecciona origen, destino y algoritmo. Comparar ejecuta los cuatro y permite mostrar cada resultado.
- En Editar grafo, Crear nodo activa la colocación sobre el mapa. Nuevo camino pide un origen, vértices intermedios y un destino. También puedes terminar en un nodo nuevo.
- Selecciona un nodo para renombrar, comenzar un camino o eliminar. Arrástralo para moverlo y recalcular las aristas incidentes.
- Selecciona un camino para editar sus vértices, subdividir segmentos o eliminarlo.
- La vista Grafo permite reorganizar nodos sin cambiar sus coordenadas geográficas. Las posiciones abstractas se guardan al arrastrar.
- Importar valida el esquema, normaliza extremos y recalcula pesos; nunca confía en pesos importados.

## Modelo y límites

El grafo es no dirigido; los caminos son polilíneas geodésicas con peso en metros. A* usa distancia directa con el mismo radio terrestre que los pesos; Dijkstra y A* minimizan distancia, BFS saltos y DFS no garantiza optimalidad. La lista de ruta y el orden de exploración se muestran por separado. Los tiempos son mediciones del navegador, no benchmarks estadísticos.

La aplicación abre la biblioteca sin cargar un ejemplo. Los proyectos nuevos no contienen nodos ni caminos: colócalos sobre las ubicaciones que necesites. La importación admite 5 MB, 2,000 nodos y 10,000 aristas. No hay backend, cuentas ni sincronización entre dispositivos.

Referencias: https://leafletjs.com/reference · https://turfjs.org/docs/api/length · https://visjs.github.io/vis-network/docs/network/


## Nodos de apoyo e intersecciones

- En **Editar grafo → Nodo de apoyo**, haz clic sobre un camino para insertar una intersección. El camino se divide conservando su geometría y recalculando los metros de sus tramos. Si otros caminos coinciden a menos de un metro, también se dividen y quedan unidos al mismo apoyo. Un cruce sin apoyo explícito no conecta caminos.
- También puedes crear un apoyo fuera de los caminos y conectarlo con **Desde aquí** o **Nuevo camino**. Conecta principal–apoyo, apoyo–apoyo y apoyo–principal; dibuja cada tramo compartido una sola vez. Se rechazan duplicados exactos de un tramo trazado en cualquier dirección.
- **Nombre / tipo** permite convertir un nodo existente en apoyo o principal sin perder conexiones. Mover un apoyo mueve sus extremos conectados; acercarlo a otro camino no crea una unión automáticamente.
- Seleccionar un apoyo muestra los principales alcanzables, su cantidad y la distancia mínima por caminos a cada uno. La búsqueda pasa por otros apoyos y se detiene en cada principal; la lista incluye la cadena de apoyos y los tramos incidentes.
- La vista **Grafo** solo dibuja principales. Sustituye las cadenas de apoyos por conexiones con la suma de metros, sin crear conexiones que atraviesen otro principal. Si hay varias alternativas, muestra la más corta; al visualizar una ruta BFS/DFS muestra la alternativa realmente utilizada y su distancia.
- Los algoritmos operan sobre la red física completa; no repiten nodos ni tramos dentro de la ruta encontrada. BFS minimiza tramos físicos, incluidos apoyos. El resumen enumera destinos y permite desplegar el recorrido completo con apoyos. Los apoyos no aparecen en los selectores de origen/destino.
- El JSON añade `type: "principal"` o `type: "support"` a cada nodo. Los archivos anteriores sin `type` se interpretan como nodos principales. Las conexiones abstractas se derivan; se exportan los tramos físicos originales.

El mapa inicia en 15°53'25.25"N, 97°04'31.54"W (15.8903472222, -97.0754277778), con vista satelital. Los grafos guardados conservan sus coordenadas; Centrar permite volver a encuadrarlos.


## Versiones históricas del mapa

El selector **Fondo del mapa → Satélite histórico** ofrece las versiones publicadas por Esri Wayback entre 2020 y 2025. En la primera apertura se selecciona **07/12/2023**. Elige año y fecha de publicación; puedes volver al satélite más reciente o al plano. La elección se guarda separadamente del grafo y nunca cambia nodos, geometrías ni pesos.

Las fechas corresponden a publicaciones de Esri, no necesariamente al año de captura. Diferentes versiones pueden mostrar la misma fotografía en el campus. El catálogo local `dist/wayback-catalog.json` contiene 84 versiones obtenidas del catálogo público oficial de Esri; las imágenes se consultan en línea. Si falla una versión, se muestra el error para que puedas elegir otra, sin sustituir silenciosamente la imagen por una actual.

Fuente: https://github.com/Esri/wayback-core · https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json

## Acercamiento del mapa

El mapa permite zoom hasta el nivel 24. Las capas satelitales amplían las imágenes del nivel 18 (comprobado en el campus), evitando pedir niveles superiores sin cobertura. El plano amplía desde el nivel 19. Los nodos y caminos mantienen sus coordenadas: ampliar facilita colocarlos, pero no aumenta la resolución ni la exactitud geográfica de la fotografía. La carga inicial y el desplazamiento a otras zonas todavía requieren Internet.


## Biblioteca de proyectos

La pantalla inicial ofrece **Nuevo grafo** y **Proyectos guardados**, con búsqueda por nombre. Cada tarjeta muestra su cantidad de principales, apoyos y caminos, y la fecha de actualización.

- **Nuevo grafo** solicita un nombre y abre un mapa vacío centrado en las coordenadas configuradas.
- **Abrir** recupera los nodos, apoyos, caminos y posiciones del grafo. Cada edición se guarda automáticamente en su propio proyecto.
- **Renombrar** cambia únicamente el nombre. **Duplicar** genera una copia independiente.
- **Eliminar** mueve el proyecto a la **Papelera**, desde donde se puede **Restaurar**; no hay borrado definitivo en la interfaz.
- **Importar** crea un proyecto nuevo desde un JSON, conservando todos los demás. **Exportar grafo** incluye el nombre del proyecto para recuperar ese nombre al importarlo.
- Al actualizar desde la versión anterior, el único grafo guardado se copia una sola vez a **Grafo recuperado**. Se mantiene intacto el guardado anterior como respaldo, incluso si la migración falla.

La biblioteca usa la clave `rutas-pxm-projects-v1`; el respaldo anterior permanece en `umar-atlas-v1`. Las escrituras releen los proyectos actuales, y las revisiones evitan sobrescribir silenciosamente cambios del mismo proyecto en otra pestaña. Si no se puede guardar, se avisa y se bloquea el cambio de proyecto para permitir exportar el trabajo en memoria.

Los proyectos pertenecen al navegador y al origen utilizado (por ejemplo, `localhost` y `127.0.0.1` tienen bibliotecas separadas). No se sincronizan entre equipos ni se guardan en una cuenta; conserva copias JSON antes de borrar los datos del navegador.

### Moldear caminos existentes
En «Editar grafo», pulsa «Moldear camino» y selecciona un tramo. Pulsa un signo + para insertar un vértice y arrastra el cuadrado para ajustar la curva. Haz clic en un cuadrado para quitar ese vértice. «Terminar edición del trazo» finaliza el modo de edición; cada cambio se guarda automáticamente. Los nodos principales y de apoyo permanecen conectados como antes y los metros se recalculan. Para curvas que atraviesan un apoyo, edita cada tramo a sus lados. Los vértices de forma no son nodos ni aparecen en el grafo abstracto.

### Rutas alternativas y recorrido
Dijkstra y A* muestran las dos rutas simples más cortas en metros (pueden empatar y compartir tramos). La segunda se obtiene buscando alternativas al excluir cada arista de la primera, sin modificar el grafo. Si no existe, se informa. BFS prioriza tramos; DFS ofrece recorridos sin garantía de mínima distancia. Los botones permiten mostrar ambas rutas o una sola y repetir/detener su animación de origen a destino. La vista abstracta mantiene ocultos los apoyos.
Activa «Elegir ruta con dos clics»: primer clic en un principal para origen, segundo para destino y cálculo automático; el tercer clic inicia otra selección. Las casillas de pesos permiten metros, pasos, ambos o ninguno. La longitud de paso inicia en 0.6521 m cada vez que se carga la página y puede ajustarse; los pasos se redondean al entero más cercano sin cambiar las distancias del grafo.
