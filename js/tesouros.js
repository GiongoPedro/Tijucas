/* ============================================
   Tesouros Tijucas — Engine do Canvas Interativo
   
   Como funciona:
   - Clique no canvas para "carimbar" uma imagem
   - Arraste o mouse/dedo para "pintar" a imagem seguindo o cursor
   - A cada clique, a próxima imagem do acervo é selecionada
   - As imagens são carregadas do <div id="slides"> no HTML
   
   Para adicionar imagens, edite o HTML:
   <div id="slides">
     <img src="caminho/imagem.jpg" data-caption="Legenda">
   </div>
   ============================================ */

(function () {
  // --- Configuração ---
  var overlay, headerEl, activeGifEl;
  var currentZIndex = 10;
  var isDrawing = false;
  var currentIndex = -1;
  var scaleFactor = 1;
  var images = [];
  var layers = []; // Lista de todas as camadas (canvases e gifs)
  var currentCtx = null;
  var currentImage = {};
  var lastPosition = { x: 0, y: 0 };
  var isTouch = 'ontouchstart' in window;

  // Eventos de interação (mouse ou touch)
  var EVT_START = isTouch ? 'touchstart' : 'mousedown';
  var EVT_MOVE = isTouch ? 'touchmove' : 'mousemove';
  var EVT_END = isTouch ? 'touchend' : 'mouseup';

  // Cursor original do canvas (salvo para restaurar)
  var originalCursor;

  // --- Inicialização ---
  function init() {
    // Só ativa na página de Tesouros (agora com classe .tesouros)
    if (!document.body.classList.contains('tesouros')) return;

    // Criar overlay invisível para capturar eventos de mouse/touch
    overlay = document.createElement('div');
    overlay.id = 'tesouros-overlay';
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '10000000'; // Sempre no topo para capturar eventos
    document.body.appendChild(overlay);

    headerEl = document.querySelector('header');

    // Carregar imagens do #slides
    loadImages();

    // Bindear eventos no overlay
    bindEvents();
    
    // Atualizar escala inicial
    updateScale();

    // Desenhar imagem inicial no centro
    drawInitialImage();
  }

  // --- Carregar imagens do HTML ---
  function loadImages() {
    var slidesEl = document.getElementById('slides');
    if (!slidesEl) return;

    var imgElements = slidesEl.getElementsByTagName('img');

    for (var i = 0; i < imgElements.length; i++) {
      var imgEl = imgElements[i];
      var src = imgEl.getAttribute('src') || '';
      images.push({
        img: imgEl,
        isGif: src.toLowerCase().endsWith('.gif')
      });
    }

    // Remover o contêiner de slides do DOM (já não é necessário)
    slidesEl.parentElement.removeChild(slidesEl);
  }

  // --- Eventos ---
  function bindEvents() {
    window.addEventListener('resize', onResize);
    overlay.addEventListener(EVT_START, onStart);
    overlay.addEventListener(EVT_MOVE, onMove);
    overlay.addEventListener(EVT_END, onEnd);
  }

  // --- Início do arrasto (clique/toque) ---
  function onStart(e) {
    if (images.length === 0) return;

    isDrawing = true;
    currentZIndex++;

    // Desabilitar cliques no header durante arrasto
    if (headerEl) headerEl.classList.add('nopointer');

    // Avançar para a próxima imagem
    advanceImage();

    // Selecionar imagem atual
    currentImage = images[currentIndex];

    if (currentImage.isGif) {
      activeGifEl = document.createElement('img');
      activeGifEl.src = currentImage.img.src;
      activeGifEl.className = 'floating-gif';
      activeGifEl.style.zIndex = currentZIndex;
      document.body.appendChild(activeGifEl);
      layers.push({ el: activeGifEl, type: 'gif' });
      updateGifSize(activeGifEl);
      moveGif(activeGifEl, e);
    } else {
      // Criar novo canvas para esta "camada" de pintura/carimbo
      var newCanvas = document.createElement('canvas');
      newCanvas.className = 'tesouros-layer';
      newCanvas.style.position = 'fixed';
      newCanvas.style.left = '0';
      newCanvas.style.top = '0';
      newCanvas.style.pointerEvents = 'none';
      newCanvas.style.zIndex = currentZIndex;
      
      var ratio = window.devicePixelRatio || 1;
      newCanvas.width = window.innerWidth * ratio;
      newCanvas.height = window.innerHeight * ratio;
      newCanvas.style.width = window.innerWidth + 'px';
      newCanvas.style.height = window.innerHeight + 'px';
      
      var ctx = newCanvas.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (ctx.imageSmoothingEnabled) {
        ctx.imageSmoothingQuality = 'high';
      }
      
      document.body.appendChild(newCanvas);
      layers.push({ el: newCanvas, type: 'canvas', ctx: ctx });
      currentCtx = ctx;
    }

    // Capturar posição inicial
    updatePosition(e);

    // Desenhar se não for GIF
    if (!currentImage.isGif) {
      drawImage(e);
    }
  }

  // --- Movimento (arrasto) ---
  function onMove(e) {
    if (!isDrawing) return;

    e.preventDefault();

    // Se for GIF, apenas move o elemento atual
    if (currentImage.isGif && activeGifEl) {
      moveGif(activeGifEl, e);
    } else if (!currentImage.isGif) {
      // Se for imagem normal, desenha o rastro
      drawImage(e);
    }
  }

  // --- Fim do arrasto (soltar) ---
  function onEnd() {
    isDrawing = false;
    activeGifEl = null;
    currentCtx = null;

    // Reabilitar header
    if (headerEl) headerEl.classList.remove('nopointer');
  }

  // --- Avançar para próxima imagem ---
  function advanceImage() {
    currentIndex = (currentIndex + 1) % images.length;
  }

  // --- Calcular escala responsiva ---
  function updateScale() {
    var w = window.innerWidth;
    if (w < 650) {
      scaleFactor = 0.25; // Aumentado de 0.2
    } else if (w < 1030) {
      scaleFactor = 0.45; // Aumentado de 0.35
    } else if (w < 1450) {
      scaleFactor = 0.65; // Aumentado de 0.5
    } else if (w < 1950) {
      scaleFactor = 0.85; // Aumentado de 0.75
    } else {
      scaleFactor = 1;
    }
  }

  // --- Desenhar imagem no canvas ---
  function drawImage(e) {
    if (!currentCtx) return;
    var img = currentImage.img;
    var w = img.naturalWidth * scaleFactor;
    var h = img.naturalHeight * scaleFactor;

    var prev = { x: lastPosition.x, y: lastPosition.y };
    updatePosition(e);
    var curr = { x: lastPosition.x, y: lastPosition.y };

    var dist = distance(prev, curr);
    var angle = angleBetween(prev, curr);

    var step = 20; // Espaçamento entre cada carimbo (em pixels) — quanto maior, mais leve
    for (var i = 0; i <= dist || i === 0; i += step) {
      var x = prev.x + Math.sin(angle) * i - w / 2;
      var y = prev.y + Math.cos(angle) * i - h / 2;
      currentCtx.drawImage(img, x, y, w, h);
    }
  }

  // --- Atualizar posição do cursor ---
  function updatePosition(e) {
    var point = isTouch ? e.touches[0] : e;
    lastPosition.x = point.pageX;
    lastPosition.y = point.pageY;
  }

  // --- Distância entre dois pontos ---
  function distance(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // --- Ângulo entre dois pontos ---
  function angleBetween(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    return Math.atan2(dx, dy);
  }

  // --- Funções auxiliares para GIF ---
  function moveGif(el, e) {
    var point = isTouch ? e.touches[0] : e;
    el.style.left = point.pageX + 'px';
    el.style.top = point.pageY + 'px';
  }

  function updateGifSize(el) {
    var w = currentImage.img.naturalWidth * scaleFactor;
    var h = currentImage.img.naturalHeight * scaleFactor;
    el.style.width = w + 'px';
    el.style.height = h + 'px';
  }

  function onResize() {
    updateScale();
    // Nota: Como cada camada é independente, o redimensionamento da janela 
    // não limpa o histórico, mas as camadas antigas podem não se ajustar 
    // perfeitamente ao novo tamanho da janela sem um tratamento complexo.
    // Para este design, mantemos as camadas onde foram criadas.
  }

  // --- Desenhar imagem inicial no centro ---
  function drawInitialImage() {
    if (images.length === 0) return;
    
    var initialIdx = -1;
    for (var i = 0; i < images.length; i++) {
      var src = images[i].img.getAttribute('src') || '';
      if (src.indexOf('GiongoTijucas_GIF') !== -1) {
        initialIdx = i;
        break;
      }
    }
    
    if (initialIdx === -1) initialIdx = 0;
    currentIndex = initialIdx;
    
    var imgObj = images[initialIdx];
    currentZIndex++;
    
    var centerX = window.innerWidth / 2;
    var centerY = window.innerHeight / 2;
    
    if (imgObj.isGif) {
      var gifEl = document.createElement('img');
      gifEl.src = imgObj.img.src;
      gifEl.className = 'floating-gif';
      gifEl.style.zIndex = currentZIndex;
      gifEl.style.left = centerX + 'px';
      gifEl.style.top = centerY + 'px';
      
      var setSize = function() {
        var w = imgObj.img.naturalWidth * scaleFactor;
        var h = imgObj.img.naturalHeight * scaleFactor;
        gifEl.style.width = w + 'px';
        gifEl.style.height = h + 'px';
      };

      if (imgObj.img.complete && imgObj.img.naturalWidth) {
        setSize();
      } else {
        imgObj.img.addEventListener('load', setSize);
      }
      
      document.body.appendChild(gifEl);
      layers.push({ el: gifEl, type: 'gif' });
    } else {
      var newCanvas = document.createElement('canvas');
      newCanvas.className = 'tesouros-layer';
      newCanvas.style.position = 'fixed';
      newCanvas.style.left = '0';
      newCanvas.style.top = '0';
      newCanvas.style.pointerEvents = 'none';
      newCanvas.style.zIndex = currentZIndex;
      
      var ratio = window.devicePixelRatio || 1;
      newCanvas.width = window.innerWidth * ratio;
      newCanvas.height = window.innerHeight * ratio;
      newCanvas.style.width = window.innerWidth + 'px';
      newCanvas.style.height = window.innerHeight + 'px';
      
      var ctx = newCanvas.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      
      document.body.appendChild(newCanvas);
      layers.push({ el: newCanvas, type: 'canvas', ctx: ctx });
      
      var drawOnCanvas = function() {
        var w = imgObj.img.naturalWidth * scaleFactor;
        var h = imgObj.img.naturalHeight * scaleFactor;
        ctx.drawImage(imgObj.img, centerX - w / 2, centerY - h / 2, w, h);
      };
      
      if (imgObj.img.complete) {
        drawOnCanvas();
      } else {
        imgObj.img.addEventListener('load', drawOnCanvas);
      }
    }
  }

  // --- Iniciar quando o DOM estiver pronto ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
