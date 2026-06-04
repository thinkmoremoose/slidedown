(function() {
  'use strict';

  /* ==========================================================
     STATE
     ========================================================== */
  var state = {
    currentSlide: 0,
    currentFragment: -1,
    transitioning: false,
    overviewActive: false,
    helpActive: false,
    overviewIndex: 0,
    presenterWin: null
  };

  /* ==========================================================
     DOM REFERENCES
     ========================================================== */
  var viewport = document.getElementById('viewport');
  var deck     = document.getElementById('deck');
  var slides   = [];
  var counter  = document.getElementById('counter');
  var barFill  = document.getElementById('barFill');
  var overview = document.getElementById('overview');
  var helpEl   = document.getElementById('help');
  var startBtn = document.getElementById('startBtn');

  var numberBuffer  = '';
  var numberTimeout = null;

  /* ==========================================================
     SCALING — fit 1920×1080 into viewport
     ========================================================== */
  function updateScale() {
    var vw = viewport.clientWidth;
    var vh = viewport.clientHeight;
    var scale = Math.min(vw / 1920, vh / 1080);
    deck.style.transform = 'scale(' + scale + ')';
  }

  /* ==========================================================
     SLIDE STATE MANAGEMENT
     ========================================================== */
  function updateSlideClasses(index) {
    slides.forEach(function(s, i) {
      s.classList.remove('past', 'present', 'future');
      if (i < index)       s.classList.add('past');
      else if (i === index) s.classList.add('present');
      else                  s.classList.add('future');
    });
  }

  /* ==========================================================
     GO TO SLIDE
     ========================================================== */
  function goTo(index, opts) {
    opts = opts || {};
    if (index < 0) index = 0;
    if (index >= slides.length) index = slides.length - 1;
    if (index === state.currentSlide && !opts.force) return;

    var targetSlide = slides[index];
    var type = targetSlide.dataset.transition || 'fade';

    // Set deck transition mode
    deck.className = 'sd-deck sd-deck--' + type;

    // Update slide position classes
    updateSlideClasses(index);

    // Handle fragments on old slide — reset
    if (!opts.force) {
      resetFragments(state.currentSlide);
    }

    state.currentSlide = index;

    // Handle fragments on new slide
    if (opts.revealAll) {
      revealAllFragments(index);
    } else {
      resetFragments(index);
    }

    updateProgress();
    updateHash();
    syncPresenter();
  }

  /* ==========================================================
     NAVIGATION
     ========================================================== */
  function next() {
    if (state.overviewActive || state.helpActive) return;
    var frags = getFragments(state.currentSlide);
    var nextFrag = state.currentFragment + 1;
    if (nextFrag < frags.length) {
      frags[nextFrag].classList.add('visible');
      state.currentFragment = nextFrag;
      syncPresenter();
    } else if (state.currentSlide + 1 < slides.length) {
      goTo(state.currentSlide + 1);
    }
  }

  function prev() {
    if (state.overviewActive || state.helpActive) return;
    if (state.currentFragment >= 0) {
      var frags = getFragments(state.currentSlide);
      frags[state.currentFragment].classList.remove('visible');
      state.currentFragment--;
      syncPresenter();
    } else if (state.currentSlide > 0) {
      goTo(state.currentSlide - 1, { revealAll: true });
    }
  }

  /* ==========================================================
     FRAGMENTS
     ========================================================== */
  function getFragments(slideIndex) {
    var slide = slides[slideIndex];
    var frags = Array.from(slide.querySelectorAll('.fragment'));
    frags.sort(function(a, b) {
      return (parseInt(a.dataset.index) || 9999) - (parseInt(b.dataset.index) || 9999);
    });
    return frags;
  }

  function resetFragments(slideIndex) {
    var frags = getFragments(slideIndex);
    frags.forEach(function(f) { f.classList.remove('visible'); });
    if (slideIndex === state.currentSlide) {
      state.currentFragment = -1;
    }
  }

  function revealAllFragments(slideIndex) {
    var frags = getFragments(slideIndex);
    frags.forEach(function(f) { f.classList.add('visible'); });
    if (slideIndex === state.currentSlide) {
      state.currentFragment = frags.length - 1;
    }
  }

  /* ==========================================================
     PROGRESS
     ========================================================== */
  function updateProgress() {
    var cur = state.currentSlide + 1;
    var tot = slides.length;
    counter.textContent = cur + ' / ' + tot;
    barFill.style.width = ((cur / tot) * 100) + '%';
  }

  /* ==========================================================
     HASH ROUTING
     ========================================================== */
  function readHash() {
    var m = location.hash.match(/^#\/(\d+)/);
    if (m) {
      var i = parseInt(m[1], 10);
      return (i >= 0 && i < slides.length) ? i : 0;
    }
    return 0;
  }

  function updateHash() {
    if (history.replaceState) {
      history.replaceState(null, '', '#/' + state.currentSlide);
    } else {
      location.hash = '#/' + state.currentSlide;
    }
  }

  /* ==========================================================
     FULLSCREEN
     ========================================================== */
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      (document.documentElement.requestFullscreen ||
       document.documentElement.webkitRequestFullscreen ||
       function(){}).call(document.documentElement);
    } else {
      (document.exitFullscreen ||
       document.webkitExitFullscreen ||
       function(){}).call(document);
    }
  }

  /* ==========================================================
     PRESENTER VIEW
     ========================================================== */
  function openPresenter() {
    if (state.presenterWin && !state.presenterWin.closed) {
      state.presenterWin.focus();
      return;
    }

    var slideData = slides.map(function(s) {
      var clone = s.cloneNode(true);
      var notes = clone.querySelector('.notes');
      var notesHTML = notes ? notes.innerHTML : '';
      if (notes) notes.remove();
      clone.querySelectorAll('.fragment').forEach(function(f) {
        f.classList.add('visible');
      });
      return { html: clone.innerHTML, notes: notesHTML };
    });

    var presenterHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<title>Presenter View</title><style>' +
      document.querySelector('style').innerHTML +
      '</style></head><body>' +
      '<div class="pv">' +
        '<div class="pv-main">' +
          '<div class="pv-label">Current Slide</div>' +
          '<div class="pv-frame" id="pvCurrent"><div class="pv-slide" id="pvCurrentInner"></div></div>' +
          '<div class="pv-label">Notes</div>' +
          '<div class="pv-notes" id="pvNotes"></div>' +
        '</div>' +
        '<div class="pv-side">' +
          '<div class="pv-label">Next Slide</div>' +
          '<div class="pv-frame pv-frame-sm" id="pvNext"><div class="pv-slide" id="pvNextInner"></div></div>' +
          '<div class="pv-info">' +
            '<div class="pv-timer" id="pvTimer">00:00:00</div>' +
            '<div class="pv-counter" id="pvCounter">1 / ' + slides.length + '</div>' +
            '<button id="pvReset">Reset Timer</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<script>' +
        'var slideData=' + JSON.stringify(slideData) + ';' +
        'var total=' + slides.length + ';' +
        'var cur=' + state.currentSlide + ';' +
        'var frag=' + state.currentFragment + ';' +
        pvJS() +
      '<\/script></body></html>';

    var win = window.open('', 'sd-presenter', 'width=1200,height=800');
    if (!win) { alert('Popup blocked. Please allow popups for presenter view.'); return; }
    win.document.open();
    win.document.write(presenterHTML);
    win.document.close();
    state.presenterWin = win;
  }

  function pvJS() {
    return '' +
      'var startTime=Date.now();' +
      'function pad(n){return n<10?"0"+n:""+n;}' +
      'function updateTimer(){' +
        'var e=Math.floor((Date.now()-startTime)/1000);' +
        'document.getElementById("pvTimer").textContent=' +
          'pad(Math.floor(e/3600))+":"+pad(Math.floor(e%3600/60))+":"+pad(e%60);}' +
      'setInterval(updateTimer,1000);' +
      'document.getElementById("pvReset").addEventListener("click",function(){startTime=Date.now();updateTimer();});' +
      'function scaleSlide(frameId,innerId){' +
        'var f=document.getElementById(frameId);' +
        'if(!f)return;var s=f.clientWidth/1920;' +
        'var inner=document.getElementById(innerId);' +
        'if(inner)inner.style.transform="scale("+s+")";}' +
      'function updateDisplay(){' +
        'var cd=slideData[cur];' +
        'document.getElementById("pvCurrentInner").innerHTML=cd.html;' +
        'var cFrags=document.getElementById("pvCurrentInner").querySelectorAll(".fragment");' +
        'cFrags.forEach(function(f,i){f.style.opacity=i<=frag?"1":"0.15";f.style.transform="none";});' +
        'if(cur+1<total){' +
          'document.getElementById("pvNextInner").innerHTML=slideData[cur+1].html;' +
        '}else{' +
          'document.getElementById("pvNextInner").innerHTML=' +
            '"<div style=\\"display:flex;align-items:center;justify-content:center;height:100%;\\">' +
            '<p style=\\"font-size:48px;color:var(--text-muted)\\">End of Presentation</p></div>";}' +
        'document.getElementById("pvNotes").innerHTML=cd.notes||"<em style=\\"color:var(--text-muted)\\">No notes for this slide.</em>";' +
        'document.getElementById("pvCounter").textContent=(cur+1)+" / "+total;' +
        'scaleSlide("pvCurrent","pvCurrentInner");scaleSlide("pvNext","pvNextInner");}' +
      'window.addEventListener("message",function(e){' +
        'if(e.data&&e.data.type==="sd-state"){cur=e.data.slide;frag=e.data.fragment;updateDisplay();}});' +
      'document.addEventListener("keydown",function(e){' +
        'if(e.ctrlKey||e.metaKey)return;' +
        'switch(e.key){' +
          'case"ArrowRight":case"ArrowDown":case" ":case"PageDown":' +
            'window.opener&&window.opener.postMessage({type:"sd-nav",action:"next"},"*");e.preventDefault();break;' +
          'case"ArrowLeft":case"ArrowUp":case"PageUp":' +
            'window.opener&&window.opener.postMessage({type:"sd-nav",action:"prev"},"*");e.preventDefault();break;}});' +
      'window.addEventListener("resize",function(){scaleSlide("pvCurrent","pvCurrentInner");scaleSlide("pvNext","pvNextInner");});' +
      'setTimeout(function(){updateDisplay();},50);';
  }

  function syncPresenter() {
    if (state.presenterWin && !state.presenterWin.closed) {
      state.presenterWin.postMessage({
        type: 'sd-state',
        slide: state.currentSlide,
        fragment: state.currentFragment
      }, '*');
    }
  }

  /* ==========================================================
     OVERVIEW MODE
     ========================================================== */
  function toggleOverview() {
    state.overviewActive = !state.overviewActive;
    if (state.overviewActive) {
      buildOverview();
      overview.classList.add('active');
    } else {
      overview.classList.remove('active');
    }
  }

  function buildOverview() {
    overview.innerHTML = '';
    state.overviewIndex = state.currentSlide;

    slides.forEach(function(slide, i) {
      var thumb = document.createElement('div');
      thumb.className = 'sd-ov-thumb';
      if (i === state.currentSlide) thumb.classList.add('current');
      if (i === state.overviewIndex) thumb.classList.add('focused');
      thumb.dataset.index = i;

      var inner = document.createElement('div');
      inner.className = 'sd-ov-inner';
      var clone = slide.cloneNode(true);
      var notes = clone.querySelector('.notes');
      if (notes) notes.remove();
      // Copy special layout classes
      if (slide.classList.contains('title-slide')) inner.classList.add('title-slide');
      if (slide.classList.contains('impact-slide')) inner.classList.add('impact-slide');
      inner.innerHTML = clone.innerHTML;

      var num = document.createElement('div');
      num.className = 'sd-ov-num';
      num.textContent = (i + 1);

      thumb.appendChild(inner);
      thumb.appendChild(num);
      thumb.addEventListener('click', function() {
        goTo(i, { force: true });
        toggleOverview();
      });
      overview.appendChild(thumb);
    });

    requestAnimationFrame(function() {
      overview.querySelectorAll('.sd-ov-thumb').forEach(function(thumb) {
        var inner = thumb.querySelector('.sd-ov-inner');
        if (inner) {
          var scale = thumb.clientWidth / 1920;
          inner.style.transform = 'scale(' + scale + ')';
        }
      });
    });
  }

  function getOverviewCols() {
    var thumbs = overview.querySelectorAll('.sd-ov-thumb');
    if (thumbs.length < 2) return 1;
    var firstTop = thumbs[0].offsetTop;
    var cols = 1;
    for (var i = 1; i < thumbs.length; i++) {
      if (thumbs[i].offsetTop === firstTop) cols++;
      else break;
    }
    return cols;
  }

  function updateOverviewFocus() {
    overview.querySelectorAll('.sd-ov-thumb').forEach(function(t, i) {
      t.classList.toggle('focused', i === state.overviewIndex);
    });
    var focused = overview.querySelector('.focused');
    if (focused) focused.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /* ==========================================================
     HELP OVERLAY
     ========================================================== */
  function toggleHelp() {
    state.helpActive = !state.helpActive;
    helpEl.classList.toggle('active', state.helpActive);
  }

  /* ==========================================================
     TOUCH SUPPORT
     ========================================================== */
  var touchStartX = 0;
  var touchStartY = 0;
  var SWIPE_THRESHOLD = 50;

  function onTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }

  function onTouchEnd(e) {
    var dx = e.changedTouches[0].clientX - touchStartX;
    var dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx < 0) next();
      else prev();
    }
  }

  /* ==========================================================
     EVENT BINDING
     ========================================================== */
  function bindEvents() {
    // Keyboard
    document.addEventListener('keydown', function(e) {
      // Help overlay captures keys
      if (state.helpActive) {
        if (e.key === 'Escape' || e.key === '?' || e.key === 'h' || e.key === 'H') {
          toggleHelp();
        }
        e.preventDefault();
        return;
      }

      // Overview mode captures keys
      if (state.overviewActive) {
        var cols = getOverviewCols();
        switch (e.key) {
          case 'ArrowRight':
            state.overviewIndex = Math.min(state.overviewIndex + 1, slides.length - 1);
            updateOverviewFocus(); break;
          case 'ArrowLeft':
            state.overviewIndex = Math.max(state.overviewIndex - 1, 0);
            updateOverviewFocus(); break;
          case 'ArrowDown':
            state.overviewIndex = Math.min(state.overviewIndex + cols, slides.length - 1);
            updateOverviewFocus(); break;
          case 'ArrowUp':
            state.overviewIndex = Math.max(state.overviewIndex - cols, 0);
            updateOverviewFocus(); break;
          case 'Enter': case ' ':
            goTo(state.overviewIndex, { force: true });
            toggleOverview(); break;
          case 'Escape': case 'o': case 'O': case 'g': case 'G':
            toggleOverview(); break;
        }
        e.preventDefault();
        return;
      }

      // Allow browser shortcuts
      if (e.ctrlKey || e.metaKey) return;

      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown':
          next(); e.preventDefault(); break;
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
          prev(); e.preventDefault(); break;
        case 'Home':
          goTo(0, { force: true }); e.preventDefault(); break;
        case 'End':
          goTo(slides.length - 1, { force: true }); e.preventDefault(); break;
        case 'f': case 'F':
          toggleFullscreen(); break;
        case 'F11':
          toggleFullscreen(); e.preventDefault(); break;
        case 's': case 'S':
          openPresenter(); break;
        case 'o': case 'O': case 'g': case 'G':
          toggleOverview(); break;
        case '?': case 'h': case 'H':
          toggleHelp(); break;
        case 'Escape':
          break; // let browser handle (exit fullscreen)
        case 'Enter':
          if (numberBuffer) {
            var target = parseInt(numberBuffer, 10) - 1;
            if (target >= 0 && target < slides.length) goTo(target, { force: true });
            numberBuffer = '';
          }
          break;
        default:
          if (e.key >= '0' && e.key <= '9') {
            numberBuffer += e.key;
            clearTimeout(numberTimeout);
            numberTimeout = setTimeout(function() { numberBuffer = ''; }, 2000);
          }
      }
    });

    // Click zones
    viewport.addEventListener('click', function(e) {
      if (state.overviewActive || state.helpActive) return;
      if (e.target.closest('button, a, input, select, textarea')) return;
      var x = e.clientX;
      var w = viewport.clientWidth;
      if (x < w / 3) prev();
      else if (x > w * 2 / 3) next();
    });

    // Help overlay click-outside
    helpEl.addEventListener('click', function(e) {
      if (e.target === helpEl) toggleHelp();
    });

    // Touch
    viewport.addEventListener('touchstart', onTouchStart, { passive: true });
    viewport.addEventListener('touchend', onTouchEnd, { passive: true });

    // Resize
    window.addEventListener('resize', updateScale);

    // Hash changes
    window.addEventListener('hashchange', function() {
      var i = readHash();
      if (i !== state.currentSlide) goTo(i, { force: true });
    });

    // Start / fullscreen button
    if (startBtn) {
      startBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleFullscreen();
      });
    }

    // Messages from presenter window
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'sd-nav') {
        if (e.data.action === 'next') next();
        else if (e.data.action === 'prev') prev();
        else if (e.data.action === 'goTo') goTo(e.data.index, { force: true });
      }
    });
  }

  /* ==========================================================
     INITIALIZATION
     ========================================================== */
  function init() {
    slides = Array.from(deck.querySelectorAll(':scope > section'));
    updateScale();
    var initialSlide = readHash();
    updateSlideClasses(initialSlide);
    state.currentSlide = initialSlide;
    state.currentFragment = -1;
    updateProgress();
    bindEvents();

    // Enable transitions after initial render
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        document.body.classList.add('ready');
      });
    });
  }

  window.addEventListener('DOMContentLoaded', init);
})();
