(function () {
    var toggle = document.querySelector('.menu-toggle');
    var panel = document.getElementById('nav-panel');
    if (!toggle || !panel) return;

    function setOpen(open) {
      panel.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    var wide = window.matchMedia('(min-width: 861px)');
    var onChange = function (e) { if (e.matches) setOpen(false); };
    if (wide.addEventListener) wide.addEventListener('change', onChange);
    else wide.addListener(onChange);

    // 当前区块的导航高亮
    var links = Array.prototype.slice.call(panel.querySelectorAll('.nav-links a'));
    var map = {};
    links.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      var sec = document.getElementById(id);
      if (sec) map[id] = a;
    });
    if ('IntersectionObserver' in window) {
      var seen = {};
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          seen[en.target.id] = en.isIntersecting;
          if (en.isIntersecting) {
            links.forEach(function (l) { l.removeAttribute('aria-current'); });
            var a = map[en.target.id];
            if (a) a.setAttribute('aria-current', 'true');
          }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      Object.keys(map).forEach(function (id) {
        io.observe(document.getElementById(id));
      });
    }
  })();



(function(){
  var KEY='v5notes-site-theme';
  var btn=document.getElementById('themeBtn');
  var label=document.getElementById('themeLabel');
  var mq=window.matchMedia('(prefers-color-scheme: dark)');
  var modes=['auto','light','dark'];
  var names={auto:'自动',light:'浅色',dark:'深色'};
  var q=new URLSearchParams(location.search).get('theme');
  var mode=(q==='light'||q==='dark'||q==='auto')?q:(localStorage.getItem(KEY)||'auto');
  if(modes.indexOf(mode)<0) mode='auto';

  function resolved(m){ return m==='auto' ? (mq.matches?'dark':'light') : m; }
  function apply(){
    var t=resolved(mode);
    var h=document.documentElement;
    h.setAttribute('data-theme',t);
    h.setAttribute('data-theme-mode',mode);
    h.style.colorScheme=t;
    var meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content', t==='dark' ? '#0b1411' : '#fbf9f3');
    if(label) label.textContent=names[mode];
    if(btn){
      btn.setAttribute('aria-label','主题：'+names[mode]+'（点击切换）');
      btn.setAttribute('title','主题：'+names[mode]+'（自动 → 浅色 → 深色）');
    }
  }
  function setMode(m){
    mode=m;
    try{ localStorage.setItem(KEY,m); }catch(e){}
    apply();
  }
  if(btn){
    btn.addEventListener('click',function(){
      var i=modes.indexOf(mode);
      setMode(modes[(i+1)%3]);
    });
  }
  var onSystem=function(){ if(mode==='auto') apply(); };
  if(mq.addEventListener) mq.addEventListener('change',onSystem);
  else if(mq.addListener) mq.addListener(onSystem);
  apply();
})();
