/**
 * Formulario de Degustación — Frontend (Cloudflare Pages)
 * Reemplaza google.script.run por fetch() al Apps Script desplegado como API JSON.
 *
 * CORS: usamos "simple requests":
 *   - GET sin headers custom
 *   - POST con Content-Type: text/plain (body es JSON stringified)
 * Esto evita el preflight OPTIONS que Apps Script no maneja.
 */

const API = window.API_URL;

async function apiGet(action) {
  const res = await fetch(API + '?action=' + encodeURIComponent(action));
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error desconocido');
  return json.data;
}

async function apiPost(action, data) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: action, data: data })
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error desconocido');
  return json.data;
}

    document.addEventListener('DOMContentLoaded', function () {
      const submitBtn = document.getElementById('submitBtn');
      const loadingSpinner = submitBtn.querySelector('.loading-spinner');
      const btnText = submitBtn.querySelector('.btn-text');

      const chkMismaEntrada = document.getElementById('usarMismaEntrada');
      const chkMismoFondo   = document.getElementById('usarMismoFondo');
      const bloqueSegundoFondo = document.getElementById('segundoFondo');
      const bloqueSegundaEntrada = document.getElementById('bloqueSegundaEntrada');

      const entradasErrorEl = document.getElementById('entradasError');
      const fondosErrorEl   = document.getElementById('fondosError');
      const coctelErrorEl   = document.getElementById('coctelError');
      const coctelCrossEl   = document.getElementById('coctelCrossError');

      const confirmModal = document.getElementById('confirmModal');
      const confirmBody = document.getElementById('confirmBody');
      const btnEditar = document.getElementById('btnEditar');
      const btnConfirmarEnviar = document.getElementById('btnConfirmarEnviar');

      let centrosEventos = [];

      // datosMenu: trasnoches vienen como objetos {nombre, foto}

      let validacionesFormulario = [];

      let datosMenu = {
        coctel: [],
        entrada: [],
        proteina: [],
        acompanamiento: [],
        fondos: [],
        trasnocheFijo: [],        // [{nombre, foto}]
        trasnocheAdicional: [],   // [{nombre, foto}]
      };

      function _norm(s){ return (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }

      const CARNE_PROTEINAS = new Set([ _norm('Plateada al vino tinto'), _norm('Punta de ganso'), _norm('Mini medallón de filete envuelto en tocino') ]);
      function esCarne(nombre){ return CARNE_PROTEINAS.has(_norm(nombre)); }

      function esMixVerde(nombre){ 
        const n = _norm(nombre);
        return n.startsWith('mix verde');
      }

      function normalizarFondos(datos){
        let prote = Array.isArray(datos.proteina) ? datos.proteina.slice() : [];
        let acomp = Array.isArray(datos.acompanamiento) ? datos.acompanamiento.slice() : [];
        if ((!acomp || acomp.length===0) && Array.isArray(datos.fondos) && datos.fondos.length){
          datos.fondos.forEach(it=>{
            if (typeof it === 'object' && it){
              if (it.tipo && /acompa/i.test(it.tipo)) acomp.push(it.nombre || String(it));
              else if (it.tipo && /prote/i.test(it.tipo)) prote.push(it.nombre || String(it));
            }
          });
        }
        return {prote, acomp};
      }

      // === Lightbox para fotos de trasnoche ===
      function openPhoto(url){
        if(!url) return;
        const modal = document.getElementById('photoModal');
        const img = document.getElementById('photoImg');
        img.src = url;
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden','false');
        document.body.style.overflow = 'hidden';
      }
      function closePhoto(){
        const modal = document.getElementById('photoModal');
        const img = document.getElementById('photoImg');
        img.src = '';
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden','true');
        document.body.style.overflow = '';
      }
      document.getElementById('photoModal').addEventListener('click', (e)=>{
        if(e.target.id === 'photoModal') closePhoto();
      });
      document.getElementById('photoCloseBtn').addEventListener('click', closePhoto);
      document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closePhoto(); });

      // Helpers trasnoche
      function getNombre(item){ return (typeof item === 'string') ? item : (item && item.nombre) ? item.nombre : ''; }
      function getFoto(item){ return (item && typeof item === 'object') ? (item.foto||'') : ''; }

      // === Autocomplete Centro de Eventos (UI) ===
      function setupCentroAutocomplete() {
        const input = document.getElementById('centro');
        const list  = document.getElementById('centroList');
        if (!input || !list) return;

        let activeIndex = -1;

        const norm = s => (s||'').toString()
          .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
          .toLowerCase().trim();

        function render(items) {
          list.innerHTML = '';
          if (!items.length) { list.style.display = 'none'; return; }
          items.forEach((nombre, idx) => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item' + (idx===activeIndex ? ' active' : '');
            div.textContent = nombre;
            div.addEventListener('mousedown', () => {
              input.value = nombre;
              list.style.display = 'none';
            });
            list.appendChild(div);
          });
          list.style.display = 'block';
        }

        function filtrar(q) {
          const nq = norm(q);
          if (!nq) return [];
          return (centrosEventos || [])
            .filter(c => c && norm(c).includes(nq))
            .slice(0, 20);
        }

        let t;
        input.addEventListener('input', () => {
          clearTimeout(t);
          t = setTimeout(() => {
            activeIndex = -1;
            render(filtrar(input.value));
          }, 80);
        });

        input.addEventListener('focus', () => {
          if (input.value) render(filtrar(input.value));
        });

        input.addEventListener('keydown', (e) => {
          const items = Array.from(list.querySelectorAll('.autocomplete-item'));
          if (!items.length) return;

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % items.length;
            render(items.map(i => i.textContent));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + items.length) % items.length;
            render(items.map(i => i.textContent));
          } else if (e.key === 'Enter') {
            if (activeIndex >= 0) {
              e.preventDefault();
              input.value = items[activeIndex].textContent;
              list.style.display = 'none';
            }
          } else if (e.key === 'Escape') {
            list.style.display = 'none';
          }
        });

        input.addEventListener('blur', () => {
          setTimeout(() => { list.style.display = 'none'; }, 100);
        });
      }

      // Cargar datos desde Google Sheets
      function cargarDatosMenu() {
        // Mostrar indicadores de carga
        const coctelContainer = document.getElementById('coctelOptions');
        const entrada1Container = document.getElementById('entrada1Options');
        const entrada2Container = document.getElementById('entrada2Options');
        const proteina1Container = document.getElementById('proteina1Options');
        const proteina2Container = document.getElementById('proteina2Options');
        const acomp1Container = document.getElementById('acompanamiento1Options');
        const acomp2Container = document.getElementById('acompanamiento2Options');
        const trasnocheAdicContainer = document.getElementById('trasnocheAdicionalOptions');
        const trasnocheDiaContainer = document.getElementById('trasnocheDiaOptions');
        const trasnocheFijoList = document.getElementById('trasnocheFijoList');
        
        const mensajeCarga = '<p style="text-align:center;color:#666;padding:20px;">⏳ Cargando opciones...</p>';
        
        coctelContainer.innerHTML = mensajeCarga;
        entrada1Container.innerHTML = mensajeCarga;
        entrada2Container.innerHTML = mensajeCarga;
        proteina1Container.innerHTML = mensajeCarga;
        proteina2Container.innerHTML = mensajeCarga;
        acomp1Container.innerHTML = mensajeCarga;
        acomp2Container.innerHTML = mensajeCarga;
        trasnocheAdicContainer.innerHTML = mensajeCarga;
        trasnocheDiaContainer.innerHTML = mensajeCarga;
        trasnocheFijoList.innerHTML = mensajeCarga;

        // Timeout de seguridad: si el servidor no responde en 15s, usar datos de respaldo
        var menuCargado = false;
        var timeoutRespaldo = setTimeout(function() {
          if (!menuCargado) {
            console.warn('⏰ Timeout: el servidor no respondió en 15s, cargando datos de respaldo');
            menuCargado = true;
            cargarDatosRespaldo();
          }
        }, 15000);

        apiGet('obtenerDatosMenu')
          .then(function(datos) {
            if (menuCargado) return;
            menuCargado = true;
            clearTimeout(timeoutRespaldo);
            console.log('✅ Datos del menú recibidos del servidor');
            datosMenu = datos || datosMenu;
            var split = normalizarFondos(datosMenu);
            datosMenu.proteina = split.prote;
            datosMenu.acompanamiento = split.acomp;

            datosMenu.trasnocheFijo = (datosMenu.trasnocheFijo||[]).map(function(x){ return typeof x === 'string' ? ({nombre:x, foto:''}) : x; });
            datosMenu.trasnocheAdicional = (datosMenu.trasnocheAdicional||[]).map(function(x){ return typeof x === 'string' ? ({nombre:x, foto:''}) : x; });

            if (!datosMenu.coctel || datosMenu.coctel.length === 0) {
              console.warn('⚠️ Datos del servidor vacíos, usando respaldo');
              cargarDatosRespaldo();
              return;
            }

            llenarOpciones();
          })
          .catch(function(error) {
            if (menuCargado) return;
            menuCargado = true;
            clearTimeout(timeoutRespaldo);
            console.error('❌ Error cargando datos del menú:', error);
            cargarDatosRespaldo();
          });

        // Centros de eventos
        apiGet('obtenerCentrosEventos')
          .then(function(lista) {
            centrosEventos = Array.isArray(lista) ? lista : [];
            setupCentroAutocomplete();
          })
          .catch(function(err){
            console.warn('No se pudieron cargar centros de eventos:', err);
            centrosEventos = [];
            setupCentroAutocomplete();
          });
      }

      // Datos de respaldo si corres el HTML suelto (demo)
      function cargarDatosRespaldo() {
        // Mostrar indicadores de carga también en el respaldo
        const coctelContainer = document.getElementById('coctelOptions');
        const mensajeCarga = '<p style="text-align:center;color:#666;padding:20px;">⏳ Cargando datos de respaldo...</p>';
        if (coctelContainer) coctelContainer.innerHTML = mensajeCarga;
        datosMenu = {
          coctel: ['Mini Empanadas de Pino','Canapés de Salmón','Bruschettas','Mini Quiches','Rollitos Primavera','Ceviche en Cuchara','Mini Hamburguesas','Ostiones al Parmesano','Tabla de Quesos','Mini Pizzas','Antipasto','Dips Variados','Tártaro de filete en crostini'],
          entrada: ['Ensalada César','Carpaccio de Res','Sopa de Mariscos','Ensalada de Quinoa','Tartare de Salmón','Crema de Espárragos','Crudo de res al estilo valdiviano','Mix verde con atún sellado, semillas de zapallo, tomate cherry','Mix verde con queso de cabra y crunch de jamón serrano y pistachos'],
          fondos: [
            {nombre:'Salmón Grillado', tipo:'Proteína'},{nombre:'Lomo de Res', tipo:'Proteína'},{nombre:'Pollo al Limón', tipo:'Proteína'},{nombre:'Plateada al vino tinto', tipo:'Proteína'},{nombre:'Punta de ganso', tipo:'Proteína'},{nombre:'Mini medallón de filete envuelto en tocino', tipo:'Proteína'},
            {nombre:'Papas Doradas', tipo:'Acompañamientos'},{nombre:'Arroz Pilaf', tipo:'Acompañamientos'},{nombre:'Verduras Grilladas', tipo:'Acompañamientos'},{nombre:'Puré de Papas', tipo:'Acompañamientos'},{nombre:'Risotto de Hongos', tipo:'Acompañamientos'},{nombre:'Ensalada Mixta', tipo:'Acompañamientos'}
          ],
          trasnocheFijo: [
            {nombre:'Sopaipillas', foto:'https://via.placeholder.com/800x600?text=Sopaipillas'},
            {nombre:'Completos Italianos', foto:'https://via.placeholder.com/800x600?text=Completos'},
            {nombre:'Empanadas Fritas', foto:''},
            {nombre:'Churros con Manjar', foto:''},
            {nombre:'Café y Té', foto:''}
          ],
          trasnocheAdicional: [
            {nombre:'Asado a la Parrilla', foto:'https://via.placeholder.com/800x600?text=Asado'},
            {nombre:'Pizza Party', foto:'https://via.placeholder.com/800x600?text=Pizza'},
            {nombre:'Sandwich de Mechada', foto:''},
            {nombre:'Hot Dogs Gourmet', foto:''},
            {nombre:'Marraqueta con Palta', foto:''}
          ]
        };

        const split = normalizarFondos(datosMenu);
        datosMenu.proteina = split.prote;
        datosMenu.acompanamiento = split.acomp;

        centrosEventos = ['CasaPiedra','Club de Golf La Dehesa','Viña Santa Rita','CentroParque','Hacienda Santa Martina','Hotel W Santiago','Casona Lo Aguirre','Hotel Plaza El Bosque','Las Majadas de Pirque','Viña Casas del Bosque'];

        llenarOpciones();
        setupCentroAutocomplete();                     // <<<<<<<<<<<< INICIALIZA AUTOCOMPLETE (respaldo)
      }

      function cargarValidaciones() {
        apiGet('obtenerValidacionesFormulario')
          .then(function(validaciones) {
            validacionesFormulario = validaciones || [];
            console.log('Validaciones dinámicas cargadas:', validacionesFormulario.length);
          })
          .catch(function(error) {
            console.error('Error cargando validaciones:', error);
            validacionesFormulario = [];
          });
      }

// Llenar opciones dinámicamente
      function llenarOpciones() {
        const coctelContainer = document.getElementById('coctelOptions');
        coctelContainer.innerHTML = '';
        datosMenu.coctel.forEach(item => {
          const text = (typeof item === 'string') ? item : (item.nombre || String(item));
          const div = document.createElement('div');
          div.className = 'checkbox-item';
          div.innerHTML = `
            <input type="checkbox" id="coctel_${text.replace(/\s+/g, '_')}" name="coctel" value="${text}">
            <label for="coctel_${text.replace(/\s+/g, '_')}">${text}</label>
          `;
          coctelContainer.appendChild(div);
        });

        ['entrada1Options','entrada2Options'].forEach(containerId=>{
          const container = document.getElementById(containerId);
          container.innerHTML = '';
          datosMenu.entrada.forEach(item=>{
            const text = (typeof item === 'string') ? item : (item.nombre || String(item));
            const div = document.createElement('div');
            div.className = 'radio-option';
            div.innerHTML = `
              <input type="radio" id="${containerId}_${text.replace(/\s+/g,'_')}" name="${containerId}" value="${text}">
              <label for="${containerId}_${text.replace(/\s+/g,'_')}">${text}</label>
            `;
            container.appendChild(div);
          });
          container.classList.add('two-cols');
        });

        ['proteina1Options','proteina2Options'].forEach(id=>{
          const c = document.getElementById(id);
          c.innerHTML = '';
          datosMenu.proteina.forEach(item=>{
            const text = (typeof item === 'string') ? item : (item.nombre || String(item));
            const div = document.createElement('div');
            div.className = 'radio-option';
            div.innerHTML = `
              <input type="radio" id="${id}_${text.replace(/\s+/g,'_')}" name="${id}" value="${text}">
              <label for="${id}_${text.replace(/\s+/g,'_')}">${text}</label>
            `;
            c.appendChild(div);
          });
          c.classList.add('two-cols');
        });

        ['acompanamiento1Options','acompanamiento2Options'].forEach(id=>{
          const c = document.getElementById(id);
          c.innerHTML = '';
          datosMenu.acompanamiento.forEach(item=>{
            const text = (typeof item === 'string') ? item : (item.nombre || String(item));
            const div = document.createElement('div');
            div.className = 'radio-option';
            div.innerHTML = `
              <input type="radio" id="${id}_${text.replace(/\s+/g,'_')}" name="${id}" value="${text}">
              <label for="${id}_${text.replace(/\s+/g,'_')}">${text}</label>
            `;
            c.appendChild(div);
          });
          c.classList.add('two-cols');
        });

        // ===== Trasnoche Fijo (grid 2 columnas) con botón de foto (logo) =====
        const logoUrl = 'https://res.cloudinary.com/dqjuqri5z/image/upload/v1757442195/mode-landscape_10446985_iqddkj.png';
        const trasnocheFijoContainer = document.getElementById('trasnocheFijoList');
        trasnocheFijoContainer.innerHTML = '';
        datosMenu.trasnocheFijo.forEach(item => {
          const nombre = getNombre(item);
          const foto   = getFoto(item);

          const wrap = document.createElement('div');
          wrap.className = 'trasnoche-tag item-with-photo';
          wrap.style.justifyContent = 'flex-start';
          wrap.style.gap = '10px';

          const label = document.createElement('span');
          label.textContent = nombre;

          const spacer = document.createElement('div');
          spacer.className = 'spacer';

          wrap.appendChild(label);
          wrap.appendChild(spacer);

        if (foto) {
          const img = document.createElement('img');
          img.src = foto;
          img.alt = nombre;
          img.className = 'photo-thumbnail';
          img.title = 'Click para ver en grande';
          img.addEventListener('click', ()=> openPhoto(foto));
          wrap.appendChild(img);  // ← CORRECTO: agregar a wrap, no a div
        }

        trasnocheFijoContainer.appendChild(wrap);
        });

        // ===== Trasnoche Adicional (radios) con botón de foto (logo) =====
        const trasnocheContainer = document.getElementById('trasnocheAdicionalOptions');
        trasnocheContainer.innerHTML = '';
        datosMenu.trasnocheAdicional.forEach(item => {
          const nombre = getNombre(item);
          const foto   = getFoto(item);

          const div = document.createElement('div');
          div.className = 'radio-option item-with-photo';

          const inputId = `adicional_${nombre.replace(/\s+/g, '_')}`;
          div.innerHTML = `
            <input type="radio" id="${inputId}" name="trasnocheAdicional" value="${nombre}">
            <label for="${inputId}" style="flex:0 1 auto;">${nombre}</label>
            <div class="spacer"></div>
          `;

          if (foto) {
            const img = document.createElement('img');
            img.src = foto;
            img.alt = nombre;
            img.className = 'photo-thumbnail';
            img.title = 'Click para ver en grande';
            img.addEventListener('click', ()=> openPhoto(foto));
            div.appendChild(img);
          }

          trasnocheContainer.appendChild(div);
        });
        trasnocheContainer.classList.add('two-cols');

        // ===== Trasnoche Día (igual que el segundo adicional) =====
        const trasnocheDiaContainer = document.getElementById('trasnocheDiaOptions');
        trasnocheDiaContainer.innerHTML = '';
        datosMenu.trasnocheAdicional.forEach(item => {
          const nombre = getNombre(item);
          const foto   = getFoto(item);

          const div = document.createElement('div');
          div.className = 'radio-option item-with-photo';

          const inputId = `dia_${nombre.replace(/\s+/g, '_')}`;
          div.innerHTML = `
            <input type="radio" id="${inputId}" name="trasnocheDia" value="${nombre}">
            <label for="${inputId}" style="flex:0 1 auto;">${nombre}</label>
            <div class="spacer"></div>
          `;

          if (foto) {
            const img = document.createElement('img');
            img.src = foto;
            img.alt = nombre;
            img.className = 'photo-thumbnail';
            img.title = 'Click para ver en grande';
            img.addEventListener('click', ()=> openPhoto(foto));
            div.appendChild(img);
          }

          trasnocheDiaContainer.appendChild(div);
        });
        trasnocheDiaContainer.classList.add('two-cols');
      }

      function setEntradasError(msg){ entradasErrorEl.textContent = msg||''; entradasErrorEl.style.display = msg ? 'block' : 'none'; }
      function setFondosError(msg){ fondosErrorEl.textContent = msg||''; fondosErrorEl.style.display = msg ? 'block' : 'none'; }
      function setCoctelCrossError(msg){ coctelCrossEl.textContent = msg||''; coctelCrossEl.style.display = msg ? 'block' : 'none'; }

      function actualizarContadorCoctel() {
        const seleccionados = document.querySelectorAll('input[name="coctel"]:checked');
        document.getElementById('coctelContador').textContent = `${seleccionados.length}/8`;
        document.querySelectorAll('input[name="coctel"]').forEach(cb => {
          if (!cb.checked && seleccionados.length >= 8) { cb.disabled = true; cb.parentElement.style.opacity = '0.5'; }
          else { cb.disabled = false; cb.parentElement.style.opacity = '1'; }
        });
        validarCruceCoctelEntradaEnVivo();
      }

      function manejarMismoFondo(){
        chkMismoFondo.addEventListener('change', function(){
          if (this.checked){
            bloqueSegundoFondo.style.display = 'none';
            document.querySelectorAll('#proteina2Options input, #acompanamiento2Options input').forEach(i => { i.checked = false; });
          } else {
            bloqueSegundoFondo.style.display = 'block';
          }
          validarFondosEnVivo();
        });
      }

      function manejarMismaEntrada(){
        chkMismaEntrada.addEventListener('change', function(){
          if (this.checked){
            bloqueSegundaEntrada.style.display = 'none';
            document.querySelectorAll('#entrada2Options input').forEach(i => { i.checked = false; });
          } else {
            bloqueSegundaEntrada.style.display = 'block';
          }
        });
      }

      function manejarMatrimonioDia(){
        const chkDia = document.getElementById('matrimonioDeDia');
        const bloqueTrasnocheDia = document.getElementById('bloqueTrasnocheDia');
        
        chkDia.addEventListener('change', function(){
          if (this.checked){
            // Es matrimonio de día: mostrar trasnoche día, ocultar cotizado
            bloqueTrasnocheDia.style.display = 'block';
          } else {
            // NO es de día: ocultar trasnoche día, mostrar cotizado
            bloqueTrasnocheDia.style.display = 'none';
            // Limpiar selección de día
            document.querySelectorAll('#trasnocheDiaOptions input').forEach(i => { i.checked = false; });
          }
        });
      }

      function validarEntradasEnVivo(){
        const e1 = document.querySelector('input[name="entrada1Options"]:checked');
        const e2 = document.querySelector('input[name="entrada2Options"]:checked');
        const usarMismaEntrada = chkMismaEntrada.checked;

        // Validación de mix verde ELIMINADA
        
        setEntradasError('');
        
        // Validaciones dinámicas
        const errorDinamico = validarRestriccionesDinamicas();
        if (errorDinamico) {
          setEntradasError(errorDinamico);
          return;
        }
        
        validarCruceCoctelEntradaEnVivo();
      }      

      function validarFondosEnVivo(){
        setFondosError('');
        const usarMismoFondo = chkMismoFondo.checked;
        const p1 = document.querySelector('input[name="proteina1Options"]:checked');
        const a1 = document.querySelector('input[name="acompanamiento1Options"]:checked');
        const p2 = usarMismoFondo ? null : document.querySelector('input[name="proteina2Options"]:checked');
        const a2 = usarMismoFondo ? null : document.querySelector('input[name="acompanamiento2Options"]:checked');

        if (!usarMismoFondo && p1 && p2 && esCarne(p1.value) && esCarne(p2.value)){
          setFondosError('No se pueden elegir dos carnes como proteínas de platos de fondo distintos.');
          return;
        }
        if (!usarMismoFondo){
          if ((p1 && !a1) || (!p1 && a1) || (p2 && !a2) || (!p2 && a2)){
            setFondosError('Cada plato de fondo debe tener proteína y acompañamiento.');
            return;
          }
        }
        
        // Validaciones dinámicas
        const errorDinamico = validarRestriccionesDinamicas();
        if (errorDinamico) {
          setFondosError(errorDinamico);
          return;
        }
      }

      function validarCruceCoctelEntradaEnVivo(){
        // Solo validaciones dinámicas (tártaro/crudo ya está cubierto allí)
        const errorDinamico = validarRestriccionesDinamicas();
        if (errorDinamico) {
          setCoctelCrossError(errorDinamico);
          setEntradasError(errorDinamico);
        } else {
          setCoctelCrossError('');
          setEntradasError('');
        }
      }

      function validarRestriccionesDinamicas() {
        if (!validacionesFormulario || !validacionesFormulario.length) return '';
        
        const selecciones = [];
        
        // Cócteles
        document.querySelectorAll('input[name="coctel"]:checked').forEach(cb => {
          selecciones.push(cb.value);
        });
        
        // Entradas
        const e1 = document.querySelector('input[name="entrada1Options"]:checked');
        const e2 = document.querySelector('input[name="entrada2Options"]:checked');
        if (e1) selecciones.push(e1.value);
        if (e2 && !chkMismaEntrada.checked) selecciones.push(e2.value);
        
        // Fondos (proteínas)
        const p1 = document.querySelector('input[name="proteina1Options"]:checked');
        const p2 = document.querySelector('input[name="proteina2Options"]:checked');
        if (p1) selecciones.push(p1.value);
        if (p2 && !chkMismoFondo.checked) selecciones.push(p2.value);
        
        // Buscar conflictos
        const gruposSeleccionados = {};
        
        for (const seleccion of selecciones) {
          const validacion = validacionesFormulario.find(v => v.plato === seleccion);
          if (validacion) {
            const grupo = validacion.grupo;
            
            if (gruposSeleccionados[grupo]) {
              console.log('Conflicto detectado - Grupo:', grupo);
              return validacion.mensaje;
            }
            
            gruposSeleccionados[grupo] = seleccion;
          }
        }
        
        return '';
      }

      // ==== MODAL DE CONFIRMACIÓN ====
      function openConfirmModal(html){
        confirmBody.innerHTML = html;
        confirmModal.style.display = 'flex';
        confirmModal.setAttribute('aria-hidden','false');
        document.body.style.overflow = 'hidden';
      }
      function closeConfirmModal(){
        confirmModal.style.display = 'none';
        confirmModal.setAttribute('aria-hidden','true');
        document.body.style.overflow = '';
      }
      btnEditar.addEventListener('click', closeConfirmModal);
      confirmModal.addEventListener('click', (e)=>{ if (e.target.id === 'confirmModal') closeConfirmModal(); });

      function buildResumenHTML(res){
        // Concat lugar + fecha (fecha ya viene como yyyy-mm-dd)
        let fechaLegible = res.fecha || '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(fechaLegible)){
          const [y,m,d] = fechaLegible.split('-').map(Number);
          const f = new Date(y, m-1, d);
          const dd = String(f.getDate()).padStart(2,'0');
          const mm = String(f.getMonth()+1).padStart(2,'0');
          const yyyy = f.getFullYear();
          fechaLegible = `${dd}/${mm}/${yyyy}`;
        }
        const lugarFecha = `${res.centro || ''} ${fechaLegible ? '- ' + fechaLegible : ''}`;

        // Cóctel (8)
        const coctelLis = res.coctel.map((c, i)=> `<li>${i+1}.- ${c}</li>`).join('');

        // Entradas
        const entradas = [];
        if (res.entrada1) entradas.push(res.entrada1);
        if (res.entrada2 && res.entrada2 !== 'Misma entrada para todos') entradas.push(res.entrada2);
        const entradasLis = entradas.map((e,i)=> `<li>${i+1}.- ${e}</li>`).join('');

        // Fondos: concat proteína + acompañamiento
        const fondos = [];
        if (res.proteina1 && res.acompanamiento1) fondos.push(`${res.proteina1} con ${res.acompanamiento1}`);
        if (!res.mismoFondo && res.proteina2 && res.acompanamiento2) fondos.push(`${res.proteina2} con ${res.acompanamiento2}`);
        const fondosLis = fondos.map((f,i)=> `<li>${i+1}.- ${f}</li>`).join('');

        // Trasnoche: fijos 1..5 + sexto adicional
        const fijos = (datosMenu.trasnocheFijo||[]).map(getNombre).filter(Boolean);
        const adicional = res.trasnocheAdicional || '';
        const adicional2 = res.trasnocheAdicional2 || '';
        const tnLis = [
          ...fijos.map((t,i)=> `<li>${i+1}.- ${t}</li>`),
          adicional ? `<li>6.- ${adicional}</li>` : '',
          adicional2 ? `<li>7.- ${adicional2}</li>` : ''
        ].join('');

        return `
          <div class="summary-row">Nombre de la novia:</div>
          <div class="summary-value">${res.nombres || ''}</div>

          <div class="summary-row">Lugar y Fecha del matrimonio:</div>
          <div class="summary-value">${lugarFecha}</div>

          <div class="summary-row">Correo electrónico:</div>
          <div class="summary-value">${res.correo || ''}</div>

          <div class="summary-row">Cóctel:</div>
          <ul class="summary-list">${coctelLis}</ul>

          <div class="summary-row">Entrada:</div>
          <ul class="summary-list">${entradasLis || '<li>Pendiente</li>'}</ul>

          <div class="summary-row">Plato de fondo:</div>
          <ul class="summary-list">${fondosLis || '<li>Pendiente</li>'}</ul>

          <div class="summary-row">Trasnoche:</div>
          <ul class="summary-list">${tnLis || '<li>Pendiente</li>'}</ul>
        `;
      }

      // ===== Modal de Progreso =====
      function showProgressModal() {
        // Resetear íconos de pasos
        ['step1Icon','step2Icon','step3Icon'].forEach((id, i) => {
          const el = document.getElementById(id);
          el.textContent = i === 0 ? '⏳' : '○';
          el.className = 'step-icon ' + (i === 0 ? 'active' : 'waiting');
        });
        document.getElementById('progressModal').style.display = 'flex';
      }

      function advanceProgressStep(step) {
        // step: 1, 2 o 3
        const icons = ['step1Icon','step2Icon','step3Icon'];
        // Marcar el paso anterior como hecho
        if (step > 1) {
          const prev = document.getElementById(icons[step - 2]);
          prev.textContent = '✓';
          prev.className = 'step-icon done';
        }
        // Activar paso actual
        if (step <= 3) {
          const cur = document.getElementById(icons[step - 1]);
          cur.textContent = '⏳';
          cur.className = 'step-icon active';
        }
      }

      function hideProgressModal() {
        document.getElementById('progressModal').style.display = 'none';
      }

      // Envío real al servidor (post-confirmación)
      function enviarAlServidor(respuestas){
        // Cerrar modal de confirmación y mostrar modal de progreso
        closeConfirmModal();
        showProgressModal();

        // Simular avance de pasos cada ~8s para dar feedback visual
        const stepTimer1 = setTimeout(() => advanceProgressStep(2), 8000);
        const stepTimer2 = setTimeout(() => advanceProgressStep(3), 20000);

        function limpiarTimers() {
          clearTimeout(stepTimer1);
          clearTimeout(stepTimer2);
        }

        apiPost('procesarDegustacion', respuestas)
          .then(function() {
            limpiarTimers();
            hideProgressModal();
            showSuccessModal();
          })
          .catch(function(err) {
            limpiarTimers();
            hideProgressModal();
            btnConfirmarEnviar.disabled = false;
            const modalBtnSpinner = btnConfirmarEnviar.querySelector('.loading-spinner');
            const modalBtnText = btnConfirmarEnviar.querySelector('.btn-text');
            if (modalBtnSpinner) modalBtnSpinner.style.display = 'none';
            if (modalBtnText) modalBtnText.textContent = 'Confirmar y Enviar';
            console.error('Error:', err);
            alert('❌ Hubo un error al enviar el formulario.\n\n' + (err.message || err) + '\n\nPor favor, intenta nuevamente o contacta a soporte.');
          });
      }

      // ==== SUBMIT del formulario: ahora abre modal de confirmación ====
      document.getElementById('degustacionForm').addEventListener('submit', function(e) {
        e.preventDefault();
        if (!validarFormulario()) return;

        const formData = new FormData(this);
        const respuestas = procesarRespuestas(formData);
        const html = buildResumenHTML(respuestas);
        openConfirmModal(html);

        // Atar el click “Confirmar y Enviar” para esta confirmación
        btnConfirmarEnviar.onclick = () => enviarAlServidor(respuestas);
      });

      function validarFormulario() {
        const coctelSeleccionados = document.querySelectorAll('input[name="coctel"]:checked');
        if (coctelSeleccionados.length !== 8) {
          coctelErrorEl.style.display = 'block';
          coctelErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return false;
        } else {
          coctelErrorEl.style.display = 'none';
        }

        const e1 = document.querySelector('input[name="entrada1Options"]:checked');
        const e2 = document.querySelector('input[name="entrada2Options"]:checked');
        const usarMismaEntrada = chkMismaEntrada.checked;

        if (!e1) {
          setEntradasError('Debes elegir al menos la Primera Entrada.');
          entradasErrorEl.scrollIntoView({behavior:'smooth', block:'center'});
          return false;
        }
        // Validación de mix verde ELIMINADA

        if (!usarMismaEntrada && (!e1 || !e2)){
          setEntradasError('Debes elegir dos entradas o marcar "Usar la misma entrada para todos".');
          entradasErrorEl.scrollIntoView({behavior:'smooth', block:'center'});
          return false;
        }
        setEntradasError('');

        const usarMismoFondo = chkMismoFondo.checked;
        const p1 = document.querySelector('input[name="proteina1Options"]:checked');
        const a1 = document.querySelector('input[name="acompanamiento1Options"]:checked');
        const p2 = usarMismoFondo ? null : document.querySelector('input[name="proteina2Options"]:checked');
        const a2 = usarMismoFondo ? null : document.querySelector('input[name="acompanamiento2Options"]:checked');

        const okFondos = (p1 && a1 && usarMismoFondo) || (p1 && a1 && p2 && a2);
        if (!okFondos) {
          setFondosError('Debes elegir dos platos de fondo completos (2 proteínas y 2 acompañamientos) o bien un solo plato de fondo y marcar "Usar el mismo plato de fondo para todos".');
          fondosErrorEl.scrollIntoView({behavior:'smooth', block:'center'});
          return false;
        }
        if (!usarMismoFondo && p1 && p2 && esCarne(p1.value) && esCarne(p2.value)) {
          setFondosError('No se pueden elegir dos carnes como proteínas de platos de fondo distintos.');
          fondosErrorEl.scrollIntoView({behavior:'smooth', block:'center'});
          return false;
        }
        setFondosError('');

        return true;
      }

      function procesarRespuestas(formData) {
        const usarMismoFondo = chkMismoFondo.checked;

        const respuestas = {
          nombres: formData.get('nombres'),
          fecha: formData.get('fecha'),
          centro: formData.get('centro'),
          correo: formData.get('correo'),

          comentariosCoctel: formData.get('comentariosCoctel') || '',
          comentariosEntrada: formData.get('comentariosEntrada') || '',
          comentariosFondo: formData.get('comentariosFondo') || '',
          comentariosTrasnoche: formData.get('comentariosTrasnoche') || '',

          coctel: [],
          entrada1: formData.get('entrada1Options'),
          entrada2: document.getElementById('usarMismaEntrada').checked ? 'Misma entrada para todos' : formData.get('entrada2Options'),

          proteina1: formData.get('proteina1Options'),
          acompanamiento1: formData.get('acompanamiento1Options'),
          proteina2: usarMismoFondo ? '' : formData.get('proteina2Options'),
          acompanamiento2: usarMismoFondo ? '' : formData.get('acompanamiento2Options'),

          marca_proteina1: 'x',
          marca_acompanamiento1: 'x',
          marca_proteina2: usarMismoFondo ? '' : 'xx',
          marca_acompanamiento2: usarMismoFondo ? '' : 'xx',

          trasnocheAdicional: formData.get('trasnocheAdicional'),
          trasnocheAdicional2: document.getElementById('matrimonioDeDia').checked ? formData.get('trasnocheDia') : '',
          mismaEntrada: document.getElementById('usarMismaEntrada').checked,
          mismoFondo: usarMismoFondo
        };

        document.querySelectorAll('input[name="coctel"]:checked').forEach(cb => {
          respuestas.coctel.push(cb.value);
        });

        return respuestas;
      }

      function showLoading(show) {
        if (show) { loadingSpinner.style.display = 'inline-block'; btnText.textContent = 'Enviando...'; submitBtn.disabled = true; }
        else { loadingSpinner.style.display = 'none'; btnText.textContent = 'Enviar Selección'; submitBtn.disabled = false; }
      }

      function showSuccessModal() { document.getElementById('successModal').style.display = 'flex'; }
      window.closeModal = function() {
        document.getElementById('successModal').style.display = 'none';
        document.getElementById('degustacionForm').reset();
        setEntradasError(''); setFondosError(''); setCoctelCrossError(''); coctelErrorEl.style.display='none';
        // reset UI
        document.getElementById('segundoFondo').style.display = 'block';
        document.getElementById('bloqueSegundaEntrada').style.display = 'block';
      };

      document.addEventListener('change', function(e) { 
        if (e.target.name === 'coctel') {
          actualizarContadorCoctel();
          validarCruceCoctelEntradaEnVivo();
        }
      });
      ['entrada1Options','entrada2Options'].forEach(id=> document.getElementById(id).addEventListener('change', validarEntradasEnVivo));
      chkMismaEntrada.addEventListener('change', validarEntradasEnVivo);
      ['proteina1Options','proteina2Options','acompanamiento1Options','acompanamiento2Options'].forEach(id=>{
        document.getElementById(id).addEventListener('change', validarFondosEnVivo);
      });

      manejarMismoFondo();
      manejarMismaEntrada();
      manejarMatrimonioDia();
      // Siempre cargar desde la API (estamos en Cloudflare Pages, no en iframe de Apps Script)
      cargarDatosMenu();
      cargarValidaciones();
      actualizarContadorCoctel();
    });

    document.getElementById('reportesBtn').addEventListener('click', function () {
      const password = prompt('Ingrese la contraseña para acceder a reportes:');
      if (password !== 'Pagoda1234') {
        if (password !== null) alert('Contraseña incorrecta');
        return;
      }

      // Abrir reportes usando la URL de la API
      try {
        const u = new URL(API);
        u.searchParams.set('page', 'reportes');
        window.open(u.toString(), '_blank');
      } catch (e) {
        window.open(API + (API.includes('?') ? '&' : '?') + 'page=reportes', '_blank');
      }
    });
